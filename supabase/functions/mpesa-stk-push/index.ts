import { createAdminClient } from "../_shared/admin.ts";
import { corsHeaders, json } from "../_shared/cors.ts";
import { initiateStkPush, loadMpesaConfig } from "../_shared/mpesa.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PHONE_PATTERN = /^254[17]\d{8}$/;
const RETRY_AFTER_MS = 90_000;

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  try {
    // 1. Who is calling?
    const token = (request.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return json({ error: "Please sign in again." }, 401);
    }

    const admin = createAdminClient();
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) {
      return json({ error: "Your session has expired. Please sign in again." }, 401);
    }
    const userId = userData.user.id;

    // 2. What are they asking for?
    const body = await request.json().catch(() => null);
    const orderId = typeof body?.order_id === "string" ? body.order_id : "";
    const phone = typeof body?.phone === "string" ? body.phone.trim() : "";

    if (!UUID_PATTERN.test(orderId)) {
      return json({ error: "Invalid order." }, 400);
    }
    if (!PHONE_PATTERN.test(phone)) {
      return json({ error: "Enter a valid Safaricom number, for example 0712 345 678." }, 400);
    }

    // 3. Is the order theirs, and ready to be paid?
    const { data: order, error: orderError } = await admin
      .from("orders")
      .select("id, order_number, patient_id, status, payment_method, payment_status, total")
      .eq("id", orderId)
      .maybeSingle();

    if (orderError) throw new Error(`Could not read the order: ${orderError.message}`);
    if (!order || order.patient_id !== userId) {
      return json({ error: "Order not found." }, 404);
    }
    if (order.payment_method !== "mpesa") {
      return json({ error: "This order was not placed with M-Pesa." }, 400);
    }
    if (order.payment_status === "paid") {
      return json({ error: "This order has already been paid." }, 409);
    }
    if (order.status !== "pending_payment") {
      return json({ error: "This order is not waiting for payment right now." }, 409);
    }

    const amount = Math.round(Number(order.total));
    if (!Number.isFinite(amount) || amount < 1) {
      return json({ error: "This order has no amount to pay." }, 400);
    }

    // 4. Avoid double prompts
    const { data: latest } = await admin
      .from("payments")
      .select("id, status, created_at")
      .eq("order_id", order.id)
      .eq("method", "mpesa")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latest && (latest.status === "pending" || latest.status === "processing")) {
      const age = Date.now() - new Date(latest.created_at).getTime();
      if (age < RETRY_AFTER_MS) {
        return json(
          { error: "A payment request is already in progress. Please check your phone." },
          409,
        );
      }
      await admin
        .from("payments")
        .update({ status: "failed", result_desc: "No response received (timed out)" })
        .eq("id", latest.id);
    }

    // 5. Record the attempt first, then ask Safaricom
    const { data: payment, error: insertError } = await admin
      .from("payments")
      .insert({
        order_id: order.id,
        method: "mpesa",
        status: "pending",
        amount,
        phone,
      })
      .select("id")
      .single();

    if (insertError || !payment) {
      throw new Error(`Could not record the payment: ${insertError?.message ?? "unknown error"}`);
    }

    let result;
    try {
      const config = loadMpesaConfig();
      result = await initiateStkPush(config, {
        amount,
        phone,
        accountReference: order.order_number,
        description: "Similife",
      });
    } catch (error) {
      console.error("STK push failed:", error instanceof Error ? error.message : error);
      await admin
        .from("payments")
        .update({
          status: "failed",
          result_desc: error instanceof Error ? error.message.slice(0, 300) : "STK push failed",
        })
        .eq("id", payment.id);
      return json(
        { error: "We could not reach M-Pesa. Please try again in a moment." },
        502,
      );
    }

    await admin
      .from("payments")
      .update({
        status: "processing",
        merchant_request_id: result.merchantRequestId,
        checkout_request_id: result.checkoutRequestId,
      })
      .eq("id", payment.id);

    await admin.from("orders").update({ payment_status: "processing" }).eq("id", order.id);

    return json({
      ok: true,
      message: "Check your phone and enter your M-Pesa PIN to complete the payment.",
    });
  } catch (error) {
    console.error("mpesa-stk-push error:", error instanceof Error ? error.message : error);
    return json({ error: "Something went wrong on our side. Please try again." }, 500);
  }
});

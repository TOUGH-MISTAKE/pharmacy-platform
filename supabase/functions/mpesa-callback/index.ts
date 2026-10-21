import { createAdminClient, type AdminClient } from "../_shared/admin.ts";
import { json } from "../_shared/cors.ts";

interface CallbackItem {
  Name: string;
  Value?: string | number;
}

interface StkCallback {
  MerchantRequestID?: string;
  CheckoutRequestID?: string;
  ResultCode?: number;
  ResultDesc?: string;
  CallbackMetadata?: { Item?: CallbackItem[] };
}

function metadataValue(callback: StkCallback, name: string): string | number | undefined {
  return callback.CallbackMetadata?.Item?.find((item) => item.Name === name)?.Value;
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return difference === 0;
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/** Returns a note for the audit log when something needs a human to look at it. */
async function processCallback(admin: AdminClient, callback: StkCallback): Promise<string | null> {
  const checkoutRequestId = String(callback.CheckoutRequestID);

  let payment = null;
  for (let attempt = 0; attempt < 3 && !payment; attempt += 1) {
    const { data } = await admin
      .from("payments")
      .select("id, order_id, status, amount, merchant_request_id")
      .eq("checkout_request_id", checkoutRequestId)
      .maybeSingle();
    payment = data;
    if (!payment) await sleep(1500);
  }

  if (!payment) {
    return "No matching payment was found for this CheckoutRequestID.";
  }
  if (payment.status === "paid") {
    return null;
  }
  if (
    payment.merchant_request_id &&
    callback.MerchantRequestID &&
    payment.merchant_request_id !== callback.MerchantRequestID
  ) {
    return "MerchantRequestID does not match our record. Ignored.";
  }

  const resultCode = Number(callback.ResultCode);
  const resultDesc = String(callback.ResultDesc ?? "");

  // ---- Failed or cancelled by the customer ----
  if (resultCode !== 0) {
    const mapped = resultCode === 1032 ? "cancelled" : "failed";
    await admin
      .from("payments")
      .update({
        status: mapped,
        result_code: resultCode,
        result_desc: resultDesc,
        raw_callback: callback,
      })
      .eq("id", payment.id);

    await admin
      .from("orders")
      .update({ payment_status: mapped })
      .eq("id", payment.order_id)
      .eq("payment_status", "processing");
    return null;
  }

  // ---- Successful payment ----
  const receipt = String(metadataValue(callback, "MpesaReceiptNumber") ?? "");
  const paidAmount = Number(metadataValue(callback, "Amount") ?? 0);

  if (!receipt) {
    return "Successful callback without an M-Pesa receipt number. Needs review.";
  }

  if (Math.abs(paidAmount - Number(payment.amount)) > 0.009) {
    await admin
      .from("payments")
      .update({
        status: "failed",
        result_code: resultCode,
        result_desc: `Amount mismatch (paid ${paidAmount}, expected ${payment.amount}). Needs review.`,
        mpesa_receipt_number: receipt,
        raw_callback: callback,
      })
      .eq("id", payment.id);
    return `Amount mismatch on receipt ${receipt}: paid ${paidAmount}, expected ${payment.amount}.`;
  }

  const { error: paymentError } = await admin
    .from("payments")
    .update({
      status: "paid",
      result_code: resultCode,
      result_desc: resultDesc,
      mpesa_receipt_number: receipt,
      raw_callback: callback,
      paid_at: new Date().toISOString(),
    })
    .eq("id", payment.id);

  if (paymentError) {
    throw new Error(`Could not save the successful payment: ${paymentError.message}`);
  }

  const { data: order } = await admin
    .from("orders")
    .select("id, status, payment_status")
    .eq("id", payment.order_id)
    .single();

  if (!order) {
    return `Payment ${receipt} saved, but its order was not found.`;
  }

  if (order.payment_status === "paid") {
    return `Duplicate payment ${receipt}: the order was already paid. Refund needed.`;
  }

  const nextStatus = order.status === "pending_payment" ? "confirmed" : order.status;
  const { error: orderError } = await admin
    .from("orders")
    .update({ payment_status: "paid", status: nextStatus })
    .eq("id", order.id);

  if (orderError) {
    throw new Error(`Payment ${receipt} saved, but the order could not be updated: ${orderError.message}`);
  }

  if (order.status === "cancelled") {
    return `Payment ${receipt} received for a cancelled order. Refund needed.`;
  }
  return null;
}

Deno.serve(async (request: Request) => {
  const accepted = () => json({ ResultCode: 0, ResultDesc: "Accepted" });

  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  // The callback URL contains a secret token that only Safaricom (via our request) knows.
  const expectedToken = Deno.env.get("MPESA_CALLBACK_TOKEN") ?? "";
  const receivedToken = new URL(request.url).searchParams.get("token") ?? "";
  if (!expectedToken || !safeEqual(receivedToken, expectedToken)) {
    console.warn("Rejected an M-Pesa callback with a missing or wrong token.");
    return json({ error: "Forbidden." }, 403);
  }

  const payload = await request.json().catch(() => null);
  const callback = payload?.Body?.stkCallback as StkCallback | undefined;
  if (!callback?.CheckoutRequestID) {
    return accepted();
  }

  const admin = createAdminClient();
  const eventId = String(callback.CheckoutRequestID);

  try {
    // Record the event once. If Safaricom sends it twice, we do not process it twice.
    const { data: existing } = await admin
      .from("webhook_events")
      .select("id, processed")
      .eq("provider", "mpesa")
      .eq("event_id", eventId)
      .maybeSingle();

    if (existing?.processed) {
      return accepted();
    }

    if (!existing) {
      const { error: insertError } = await admin
        .from("webhook_events")
        .insert({ provider: "mpesa", event_id: eventId, payload });
      if (insertError && insertError.code !== "23505") {
        throw new Error(`Could not record the webhook event: ${insertError.message}`);
      }
    }

    const note = await processCallback(admin, callback);

    await admin
      .from("webhook_events")
      .update({ processed: true, processed_at: new Date().toISOString(), error: note })
      .eq("provider", "mpesa")
      .eq("event_id", eventId);

    if (note) console.warn("M-Pesa callback note:", note);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("mpesa-callback error:", message);
    await admin
      .from("webhook_events")
      .update({ error: message.slice(0, 500) })
      .eq("provider", "mpesa")
      .eq("event_id", eventId);
  }

  // Always answer Safaricom with success so they do not keep retrying.
  return accepted();
});

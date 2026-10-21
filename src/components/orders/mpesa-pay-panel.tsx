"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, LoaderCircle, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { FormField } from "@/components/auth/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatKes } from "@/lib/format";
import { useProfile } from "@/lib/hooks/use-profile";
import { normalizeKenyanPhone } from "@/lib/phone";
import type { PaymentStatus } from "@/lib/orders/types";
import { createClient } from "@/lib/supabase/client";

interface MpesaPayPanelProps {
  orderId: string;
  amount: number;
  paymentStatus: PaymentStatus;
  /** Reason from the most recent failed attempt, if any. */
  lastFailureReason: string | null;
  /** When the most recent payment attempt started (ISO string), if any. */
  lastAttemptAt: string | null;
}

const RETRY_AFTER_SECONDS = 90;

async function readFunctionError(error: unknown): Promise<string> {
  if (error && typeof error === "object" && "context" in error) {
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      try {
        const body = (await context.json()) as { error?: unknown };
        if (typeof body.error === "string") return body.error;
      } catch {
        // fall through to the generic message
      }
    }
  }
  return "We could not start the M-Pesa payment. Please try again.";
}

function toLocalFormat(phone: string | null | undefined): string {
  if (!phone) return "";
  return phone.startsWith("254") ? `0${phone.slice(3)}` : phone;
}

export function MpesaPayPanel({
  orderId,
  amount,
  paymentStatus,
  lastFailureReason,
  lastAttemptAt,
}: MpesaPayPanelProps) {
  const queryClient = useQueryClient();
  const { profile } = useProfile();

  const [phone, setPhone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const phoneValue = phone ?? toLocalFormat(profile?.phone);
  const processing = paymentStatus === "processing";

  useEffect(() => {
    if (!processing) return;
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, [processing]);

  const secondsSinceAttempt = lastAttemptAt
    ? Math.floor((now - new Date(lastAttemptAt).getTime()) / 1000)
    : RETRY_AFTER_SECONDS;
  const canRetry = !processing || secondsSinceAttempt >= RETRY_AFTER_SECONDS;

  const payMutation = useMutation({
    mutationFn: async () => {
      const normalized = normalizeKenyanPhone(phoneValue);
      if (!normalized) {
        throw new Error("Enter a valid Safaricom number, for example 0712 345 678.");
      }
      const { error: invokeError } = await createClient().functions.invoke("mpesa-stk-push", {
        body: { order_id: orderId, phone: normalized },
      });
      if (invokeError) {
        throw new Error(await readFunctionError(invokeError));
      }
    },
    onSuccess: () => {
      setError(null);
      setNow(Date.now());
      toast.success("Check your phone and enter your M-Pesa PIN.");
      void queryClient.invalidateQueries({ queryKey: ["order", orderId] });
    },
    onError: (mutationError: Error) => {
      setError(mutationError.message);
      void queryClient.invalidateQueries({ queryKey: ["order", orderId] });
    },
  });

  return (
    <section className="rounded-2xl border-2 border-brand-200 bg-white p-5">
      <h2 className="flex items-center gap-2 text-base font-extrabold text-brand-900">
        <Smartphone className="h-5 w-5 text-brand-600" />
        Pay with M-Pesa
      </h2>

      {processing ? (
        <div className="mt-3 space-y-3 rounded-xl bg-brand-50 p-4 text-sm text-brand-900">
          <p className="flex items-center gap-2 font-bold">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Waiting for your payment...
          </p>
          <p>
            Check your phone for the M-Pesa prompt and enter your PIN. This page updates by itself
            as soon as the payment is confirmed.
          </p>
        </div>
      ) : (
        <>
          {(paymentStatus === "failed" || paymentStatus === "cancelled") && lastFailureReason ? (
            <div
              role="alert"
              className="mt-3 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            >
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                <span className="font-bold">The last payment did not go through.</span>{" "}
                {lastFailureReason}
              </p>
            </div>
          ) : null}
          <p className="mt-3 text-sm text-muted-foreground">
            We will send a payment prompt for {formatKes(amount)} to your phone.
          </p>
        </>
      )}

      {canRetry ? (
        <div className="mt-4 space-y-4">
          <FormField id="mpesa-phone" label="M-Pesa phone number">
            <Input
              id="mpesa-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phoneValue}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="0712 345 678"
              className="h-11"
            />
          </FormField>

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <Button
            type="button"
            size="lg"
            disabled={payMutation.isPending}
            onClick={() => {
              setError(null);
              payMutation.mutate();
            }}
            className="w-full rounded-full"
          >
            {payMutation.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            {processing
              ? "Did not get the prompt? Send it again"
              : `Pay ${formatKes(amount)} with M-Pesa`}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

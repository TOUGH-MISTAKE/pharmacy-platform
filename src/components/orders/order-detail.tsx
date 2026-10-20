"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowLeft, Check, CircleAlert, Info, LoaderCircle, MapPin, Phone } from "lucide-react";
import { toast } from "sonner";
import { OrderStatusBadge } from "@/components/orders/status-badge";
import { StatusBadge as PrescriptionStatusBadge } from "@/components/prescriptions/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatKes } from "@/lib/format";
import { useAuthUser } from "@/lib/hooks/use-auth-user";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  canCancelOrder,
  timelineIndex,
  timelineSteps,
  type FulfilmentType,
  type OrderStatus,
  type PaymentMethod,
  type PaymentStatus,
} from "@/lib/orders/types";
import { one, type PrescriptionStatus } from "@/lib/prescriptions/types";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface BranchInfo {
  name: string;
  address: string;
  town: string;
  phone: string | null;
}

interface OrderDetailRow {
  id: string;
  order_number: string;
  status: OrderStatus;
  fulfilment_type: FulfilmentType;
  delivery_address: {
    label?: string;
    address_line?: string;
    town?: string;
    county?: string;
  } | null;
  subtotal: number | string;
  discount_total: number | string;
  delivery_fee: number | string;
  total: number | string;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  notes: string | null;
  created_at: string;
  branch: BranchInfo | BranchInfo[] | null;
  prescription: { id: string; status: PrescriptionStatus } | { id: string; status: PrescriptionStatus }[] | null;
  order_items: {
    id: string;
    product_name: string;
    unit_price: number | string;
    quantity: number;
    line_total: number | string;
  }[];
}

export function OrderDetail({ orderId }: { orderId: string }) {
  const queryClient = useQueryClient();
  const { loading: authLoading, userId } = useAuthUser();
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  const query = useQuery({
    queryKey: ["order", orderId, userId],
    enabled: Boolean(userId),
    refetchInterval: 20_000,
    queryFn: async (): Promise<OrderDetailRow | null> => {
      const { data, error } = await createClient()
        .from("orders")
        .select(
          "id, order_number, status, fulfilment_type, delivery_address, subtotal, discount_total, delivery_fee, total, payment_method, payment_status, notes, created_at, branch:branches(name, address, town, phone), prescription:prescriptions(id, status), order_items(id, product_name, unit_price, quantity, line_total)"
        )
        .eq("id", orderId)
        .eq("patient_id", userId ?? "")
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data as unknown as OrderDetailRow | null) ?? null;
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await createClient()
        .from("orders")
        .update({ status: "cancelled" })
        .eq("id", orderId)
        .in("status", ["pending_payment", "awaiting_verification"])
        .select("id");
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) {
        throw new Error("This order can no longer be cancelled.");
      }
    },
    onSuccess: () => {
      toast.success("Your order has been cancelled.");
      setConfirmingCancel(false);
      void queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      void queryClient.invalidateQueries({ queryKey: ["my-orders"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
      setConfirmingCancel(false);
      void queryClient.invalidateQueries({ queryKey: ["order", orderId] });
    },
  });

  if (authLoading || query.isLoading) {
    return (
      <div className="space-y-4" aria-hidden>
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        We could not load this order. Please refresh the page.
      </div>
    );
  }

  const order = query.data;
  if (!order) {
    return (
      <div className="rounded-3xl border border-brand-100 bg-white p-10 text-center">
        <h2 className="text-xl font-extrabold text-brand-900">Order not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          It may belong to a different account, or the link may be wrong.
        </p>
        <Link
          href="/account/orders"
          className={cn(buttonVariants({ variant: "outline" }), "mt-6 rounded-full")}
        >
          Back to my orders
        </Link>
      </div>
    );
  }

  const branch = one(order.branch);
  const prescription = one(order.prescription);
  const steps = timelineSteps(order.fulfilment_type);
  const currentStep = timelineIndex(order.status);
  const closed = order.status === "cancelled" || order.status === "refunded";
  const cancellable = canCancelOrder(order.status, order.payment_status);
  const address = order.delivery_address;

  return (
    <div>
      <Link
        href="/account/orders"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        All orders
      </Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-brand-900 sm:text-3xl">{order.order_number}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Placed {format(new Date(order.created_at), "d MMM yyyy, h:mm a")}
          </p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      {!closed ? (
        <ol
          aria-label="Order progress"
          className="mt-6 grid grid-cols-5 gap-2 rounded-2xl border border-brand-100 bg-white p-4"
        >
          {steps.map((step, index) => {
            const done = index <= currentStep;
            return (
              <li key={step.label} className="flex flex-col items-center gap-2 text-center">
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold",
                    done ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-400"
                  )}
                >
                  {done ? <Check className="h-4 w-4" /> : index + 1}
                </span>
                <span
                  className={cn(
                    "text-[0.7rem] font-semibold leading-tight sm:text-xs",
                    done ? "text-brand-800" : "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>
      ) : null}

      {order.status === "awaiting_verification" ? (
        <div className="mt-4 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <Info className="mt-0.5 h-5 w-5 shrink-0" />
          <p>
            A pharmacist is checking your prescription. Once it is approved you can pay, and we
            will start packing your order. We hold your stock in the meantime.
          </p>
        </div>
      ) : null}

      {order.status === "pending_payment" ? (
        <div className="mt-4 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <Info className="mt-0.5 h-5 w-5 shrink-0" />
          <p>
            Your order is placed and your stock is reserved. Online payment with{" "}
            {PAYMENT_METHOD_LABELS[order.payment_method]} is being switched on, and the Pay button
            will appear here as soon as it is ready.
          </p>
        </div>
      ) : null}

      {order.status === "cancelled" ? (
        <div className="mt-4 flex gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
          <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
          <p>This order was cancelled. Any reserved stock has been released.</p>
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <section className="rounded-2xl border border-brand-100 bg-white p-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-brand-800">Items</h2>
          <ul className="mt-3 divide-y divide-brand-100">
            {order.order_items.map((item) => (
              <li key={item.id} className="flex justify-between gap-4 py-3 text-sm">
                <div>
                  <p className="font-semibold text-brand-900">{item.product_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.quantity} x {formatKes(Number(item.unit_price))}
                  </p>
                </div>
                <p className="shrink-0 font-semibold">{formatKes(Number(item.line_total))}</p>
              </li>
            ))}
          </ul>

          <dl className="mt-3 space-y-2 border-t border-brand-100 pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="font-semibold">{formatKes(Number(order.subtotal))}</dd>
            </div>
            {Number(order.discount_total) > 0 ? (
              <div className="flex justify-between text-brand-700">
                <dt>Discount</dt>
                <dd className="font-semibold">-{formatKes(Number(order.discount_total))}</dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Delivery</dt>
              <dd className="font-semibold">
                {Number(order.delivery_fee) === 0 ? "Free" : formatKes(Number(order.delivery_fee))}
              </dd>
            </div>
            <div className="flex justify-between border-t border-brand-100 pt-3 text-base">
              <dt className="font-bold text-brand-900">Total</dt>
              <dd className="font-extrabold text-brand-900">{formatKes(Number(order.total))}</dd>
            </div>
          </dl>
        </section>

        <div className="space-y-6">
          <section className="rounded-2xl border border-brand-100 bg-white p-5 text-sm">
            <h2 className="text-sm font-bold uppercase tracking-wider text-brand-800">
              {order.fulfilment_type === "delivery" ? "Delivery" : "Pickup"}
            </h2>

            {branch ? (
              <div className="mt-3 space-y-1">
                <p className="font-bold text-brand-900">{branch.name}</p>
                <p className="flex items-center gap-1.5 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  {branch.address}, {branch.town}
                </p>
                {branch.phone ? (
                  <p className="flex items-center gap-1.5 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" />
                    {branch.phone}
                  </p>
                ) : null}
              </div>
            ) : null}

            {order.fulfilment_type === "delivery" && address ? (
              <div className="mt-3 rounded-lg bg-brand-50 p-3 text-brand-900">
                <p className="text-xs font-bold uppercase tracking-wide text-brand-700">
                  Delivering to
                </p>
                <p className="mt-1">
                  {address.address_line}, {address.town}, {address.county}
                </p>
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-brand-100 bg-white p-5 text-sm">
            <h2 className="text-sm font-bold uppercase tracking-wider text-brand-800">Payment</h2>
            <dl className="mt-3 space-y-2">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Method</dt>
                <dd className="font-semibold">{PAYMENT_METHOD_LABELS[order.payment_method]}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Status</dt>
                <dd className="font-semibold">{PAYMENT_STATUS_LABELS[order.payment_status]}</dd>
              </div>
            </dl>
          </section>

          {prescription ? (
            <section className="rounded-2xl border border-brand-100 bg-white p-5 text-sm">
              <h2 className="text-sm font-bold uppercase tracking-wider text-brand-800">
                Prescription
              </h2>
              <div className="mt-3 flex items-center justify-between gap-3">
                <PrescriptionStatusBadge status={prescription.status} />
                <Link
                  href="/account/prescriptions"
                  className="font-semibold text-brand-600 hover:underline"
                >
                  View
                </Link>
              </div>
            </section>
          ) : null}

          {order.notes ? (
            <section className="rounded-2xl border border-brand-100 bg-white p-5 text-sm">
              <h2 className="text-sm font-bold uppercase tracking-wider text-brand-800">Your notes</h2>
              <p className="mt-2 text-muted-foreground">{order.notes}</p>
            </section>
          ) : null}

          {cancellable ? (
            <div className="rounded-2xl border border-brand-100 bg-white p-5">
              {confirmingCancel ? (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-brand-900">
                    Cancel this order? Your reserved items will be released.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={cancelMutation.isPending}
                      onClick={() => cancelMutation.mutate()}
                      className="rounded-full border-red-300 text-red-700 hover:bg-red-50"
                    >
                      {cancelMutation.isPending ? (
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                      ) : null}
                      Yes, cancel order
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmingCancel(false)}
                      className="rounded-full"
                    >
                      Keep order
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setConfirmingCancel(true)}
                  className="rounded-full text-red-700 hover:bg-red-50 hover:text-red-800"
                >
                  Cancel order
                </Button>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

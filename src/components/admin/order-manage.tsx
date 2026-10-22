"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowLeft, LoaderCircle, MapPin, Phone, Printer, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { OrderStatusBadge } from "@/components/orders/status-badge";
import { StatusBadge as PrescriptionStatusBadge } from "@/components/prescriptions/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { availableActions, type OrderAction } from "@/lib/admin/orders";
import { formatKes } from "@/lib/format";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  type FulfilmentType,
  type OrderStatus,
  type PaymentMethod,
  type PaymentStatus,
} from "@/lib/orders/types";
import { one, type PrescriptionStatus } from "@/lib/prescriptions/types";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface Person {
  full_name: string;
  phone: string | null;
  email: string | null;
}

interface Branch {
  name: string;
  address: string;
  town: string;
}

interface Rx {
  id: string;
  status: PrescriptionStatus;
}

interface ManageRow {
  id: string;
  order_number: string;
  status: OrderStatus;
  fulfilment_type: FulfilmentType;
  delivery_address: { address_line?: string; town?: string; county?: string; label?: string; phone?: string } | null;
  subtotal: number | string;
  discount_total: number | string;
  delivery_fee: number | string;
  total: number | string;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  notes: string | null;
  created_at: string;
  patient: Person | Person[] | null;
  branch: Branch | Branch[] | null;
  prescription: Rx | Rx[] | null;
  order_items: {
    id: string;
    product_name: string;
    sku: string;
    unit_price: number | string;
    quantity: number;
    line_total: number | string;
  }[];
  payments: { id: string; status: PaymentStatus; mpesa_receipt_number: string | null; result_desc: string | null }[] | null;
}

export function OrderManage({ orderId }: { orderId: string }) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<OrderAction | null>(null);

  const query = useQuery({
    queryKey: ["admin-order", orderId],
    refetchInterval: 15_000,
    queryFn: async (): Promise<ManageRow | null> => {
      const { data, error } = await createClient()
        .from("orders")
        .select(
          "id, order_number, status, fulfilment_type, delivery_address, subtotal, discount_total, delivery_fee, total, payment_method, payment_status, notes, created_at, patient:profiles!patient_id(full_name, phone, email), branch:branches(name, address, town), prescription:prescriptions(id, status), order_items(id, product_name, sku, unit_price, quantity, line_total), payments(id, status, mpesa_receipt_number, result_desc)"
        )
        .eq("id", orderId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data as unknown as ManageRow | null) ?? null;
    },
  });

  const advance = useMutation({
    mutationFn: async (status: OrderStatus) => {
      const { error } = await createClient().rpc("staff_advance_order", {
        p_order_id: orderId,
        p_new_status: status,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Order updated.");
      setPending(null);
      void queryClient.invalidateQueries({ queryKey: ["admin-order", orderId] });
      void queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
      setPending(null);
      void queryClient.invalidateQueries({ queryKey: ["admin-order", orderId] });
    },
  });

  if (query.isLoading) {
    return (
      <div className="space-y-4" aria-hidden>
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        We could not load this order. {query.error instanceof Error ? query.error.message : ""}
      </div>
    );
  }

  const order = query.data;
  if (!order) {
    return (
      <div className="rounded-3xl border border-brand-100 bg-white p-10 text-center">
        <h2 className="text-xl font-extrabold text-brand-900">Order not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          It may belong to another branch, or the link may be wrong.
        </p>
        <Link href="/admin/orders" className={cn(buttonVariants({ variant: "outline" }), "mt-6 rounded-full")}>
          Back to orders
        </Link>
      </div>
    );
  }

  const patient = one(order.patient);
  const branch = one(order.branch);
  const prescription = one(order.prescription);
  const actions = availableActions({
    status: order.status,
    fulfilment: order.fulfilment_type,
    paymentMethod: order.payment_method,
    paymentStatus: order.payment_status,
  });
  const receipt = (order.payments ?? []).find((payment) => payment.mpesa_receipt_number)?.mpesa_receipt_number;
  const address = order.delivery_address;
  const rxBlocking =
    order.status === "awaiting_verification" && prescription && prescription.status !== "approved";

  return (
    <div>
      <Link
        href="/admin/orders"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:underline print:hidden"
      >
        <ArrowLeft className="h-4 w-4" />
        All orders
      </Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-brand-900 sm:text-3xl">{order.order_number}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Placed {format(new Date(order.created_at), "d MMM yyyy, h:mm a")}
            {branch ? ` - ${branch.name}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <OrderStatusBadge status={order.status} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="rounded-full"
          >
            <Printer className="h-4 w-4" />
            Print
          </Button>
        </div>
      </div>

      {rxBlocking ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 print:hidden">
          <p className="flex items-center gap-2">
            <Stethoscope className="h-4 w-4" />
            This order is waiting for a pharmacist to approve the prescription.
          </p>
          {prescription ? (
            <Link
              href={`/pharmacist/${prescription.id}`}
              className={cn(buttonVariants({ size: "sm" }), "rounded-full")}
            >
              Review prescription
            </Link>
          ) : null}
        </div>
      ) : null}

      {actions.length > 0 ? (
        <section className="mt-4 rounded-2xl border-2 border-brand-200 bg-white p-5 print:hidden">
          <h2 className="text-sm font-bold uppercase tracking-wider text-brand-800">Next step</h2>

          {pending ? (
            <div className="mt-3 space-y-3 rounded-xl bg-brand-50 p-4">
              <p className="text-sm font-semibold text-brand-900">{pending.confirmText}</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={advance.isPending}
                  onClick={() => advance.mutate(pending.status)}
                  className={cn(
                    "rounded-full",
                    pending.tone === "danger" && "bg-red-700 text-white hover:bg-red-800"
                  )}
                >
                  {advance.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                  Yes, {pending.label.toLowerCase()}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={advance.isPending}
                  onClick={() => setPending(null)}
                  className="rounded-full"
                >
                  Back
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-3">
              {actions.map((action) => (
                <Button
                  key={action.status}
                  type="button"
                  size="lg"
                  variant={action.tone === "danger" ? "outline" : "default"}
                  onClick={() => setPending(action)}
                  className={cn(
                    "rounded-full",
                    action.tone === "danger" && "border-red-300 text-red-700 hover:bg-red-50"
                  )}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          )}
        </section>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <section className="rounded-2xl border border-brand-100 bg-white p-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-brand-800">Items to pack</h2>
          <ul className="mt-3 divide-y divide-brand-100">
            {order.order_items.map((item) => (
              <li key={item.id} className="flex justify-between gap-4 py-3 text-sm">
                <div>
                  <p className="font-semibold text-brand-900">
                    {item.quantity} x {item.product_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.sku} - {formatKes(Number(item.unit_price))} each
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

          {order.notes ? (
            <div className="mt-4 rounded-lg bg-brand-50 p-3 text-sm text-brand-900">
              <p className="text-xs font-bold uppercase tracking-wide text-brand-700">Customer notes</p>
              <p className="mt-1">{order.notes}</p>
            </div>
          ) : null}
        </section>

        <div className="space-y-6">
          <section className="rounded-2xl border border-brand-100 bg-white p-5 text-sm">
            <h2 className="text-sm font-bold uppercase tracking-wider text-brand-800">Customer</h2>
            <p className="mt-3 font-bold text-brand-900">{patient?.full_name || "Customer"}</p>
            {patient?.phone ? (
              <a
                href={`tel:+${patient.phone}`}
                className="mt-1 inline-flex items-center gap-1.5 font-semibold text-brand-600 hover:underline"
              >
                <Phone className="h-3.5 w-3.5" />+{patient.phone}
              </a>
            ) : null}
            {patient?.email ? <p className="mt-1 text-muted-foreground">{patient.email}</p> : null}
          </section>

          <section className="rounded-2xl border border-brand-100 bg-white p-5 text-sm">
            <h2 className="text-sm font-bold uppercase tracking-wider text-brand-800">
              {order.fulfilment_type === "delivery" ? "Deliver to" : "Customer collects from"}
            </h2>
            {order.fulfilment_type === "delivery" && address ? (
              <p className="mt-3 flex items-start gap-1.5 text-brand-900">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
                <span>
                  {address.label ? <strong>{address.label}: </strong> : null}
                  {address.address_line}, {address.town}, {address.county}
                  {address.phone ? ` (phone +${address.phone})` : ""}
                </span>
              </p>
            ) : branch ? (
              <p className="mt-3 text-brand-900">
                {branch.name}, {branch.address}, {branch.town}
              </p>
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
                <dd
                  className={cn(
                    "font-semibold",
                    order.payment_status === "paid" ? "text-green-700" : "text-amber-700"
                  )}
                >
                  {PAYMENT_STATUS_LABELS[order.payment_status]}
                </dd>
              </div>
              {receipt ? (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">M-Pesa receipt</dt>
                  <dd className="font-semibold">{receipt}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          {prescription ? (
            <section className="rounded-2xl border border-brand-100 bg-white p-5 text-sm print:hidden">
              <h2 className="text-sm font-bold uppercase tracking-wider text-brand-800">Prescription</h2>
              <div className="mt-3 flex items-center justify-between gap-3">
                <PrescriptionStatusBadge status={prescription.status} />
                <Link
                  href={`/pharmacist/${prescription.id}`}
                  className="font-semibold text-brand-600 hover:underline"
                >
                  Open
                </Link>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

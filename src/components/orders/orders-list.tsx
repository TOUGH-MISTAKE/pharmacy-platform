"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ChevronRight, PackageOpen } from "lucide-react";
import { OrderStatusBadge } from "@/components/orders/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatKes } from "@/lib/format";
import { useAuthUser } from "@/lib/hooks/use-auth-user";
import { PAYMENT_METHOD_LABELS, type OrderStatus, type PaymentMethod } from "@/lib/orders/types";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface OrderRow {
  id: string;
  order_number: string;
  status: OrderStatus;
  total: number | string;
  created_at: string;
  fulfilment_type: "pickup" | "delivery";
  payment_method: PaymentMethod;
  order_items: { quantity: number }[] | null;
}

export function OrdersList() {
  const { loading: authLoading, userId } = useAuthUser();

  const query = useQuery({
    queryKey: ["my-orders", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<OrderRow[]> => {
      const { data, error } = await createClient()
        .from("orders")
        .select(
          "id, order_number, status, total, created_at, fulfilment_type, payment_method, order_items(quantity)"
        )
        .eq("patient_id", userId ?? "")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as OrderRow[];
    },
  });

  if (authLoading || query.isLoading) {
    return (
      <div className="space-y-3" aria-hidden>
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        We could not load your orders. Please refresh the page.
      </div>
    );
  }

  const orders = query.data ?? [];

  if (orders.length === 0) {
    return (
      <div className="rounded-3xl border border-brand-100 bg-white p-10 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <PackageOpen className="h-7 w-7" />
        </span>
        <h2 className="mt-4 text-xl font-extrabold text-brand-900">No orders yet</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          When you place an order, you can track it here.
        </p>
        <Link
          href="/products"
          className={cn(buttonVariants({ size: "lg" }), "mt-6 rounded-full px-6")}
        >
          Start shopping
        </Link>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {orders.map((order) => {
        const itemCount = (order.order_items ?? []).reduce((sum, item) => sum + item.quantity, 0);
        return (
          <li key={order.id}>
            <Link
              href={`/account/orders/${order.id}`}
              className="flex items-center gap-4 rounded-2xl border border-brand-100 bg-white p-4 transition hover:border-brand-300 hover:shadow-md"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-brand-900">{order.order_number}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {format(new Date(order.created_at), "d MMM yyyy, h:mm a")} - {itemCount}{" "}
                  {itemCount === 1 ? "item" : "items"} -{" "}
                  {order.fulfilment_type === "delivery" ? "Delivery" : "Pickup"} -{" "}
                  {PAYMENT_METHOD_LABELS[order.payment_method]}
                </p>
                <p className="mt-1 text-sm font-extrabold text-brand-900">
                  {formatKes(Number(order.total))}
                </p>
              </div>
              <OrderStatusBadge status={order.status} />
              <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

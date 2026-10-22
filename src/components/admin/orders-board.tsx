"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ChevronRight, Search, Store, Truck } from "lucide-react";
import { OrderStatusBadge } from "@/components/orders/status-badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { BOARD_TABS } from "@/lib/admin/orders";
import { formatKes } from "@/lib/format";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  type OrderStatus,
  type PaymentMethod,
  type PaymentStatus,
} from "@/lib/orders/types";
import { sanitizeSearchText } from "@/lib/products/filters";
import { one } from "@/lib/prescriptions/types";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface Person {
  full_name: string;
  phone: string | null;
}

interface BoardRow {
  id: string;
  order_number: string;
  status: OrderStatus;
  total: number | string;
  created_at: string;
  fulfilment_type: "pickup" | "delivery";
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  patient: Person | Person[] | null;
  branch: { name: string } | { name: string }[] | null;
  order_items: { quantity: number }[] | null;
}

export function OrdersBoard() {
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const initialTab = BOARD_TABS.some((tab) => tab.value === requestedTab)
    ? (requestedTab as string)
    : "action";

  const [tab, setTab] = useState(initialTab);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(sanitizeSearchText(search)), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const activeTab = BOARD_TABS.find((item) => item.value === tab) ?? BOARD_TABS[0];

  const query = useQuery({
    queryKey: ["admin-orders", activeTab.value, debounced],
    refetchInterval: 20_000,
    queryFn: async (): Promise<BoardRow[]> => {
      let request = createClient()
        .from("orders")
        .select(
          "id, order_number, status, total, created_at, fulfilment_type, payment_method, payment_status, patient:profiles!patient_id(full_name, phone), branch:branches(name), order_items(quantity)"
        );

      if (debounced) {
        request = request.ilike("order_number", `%${debounced}%`);
      } else if (activeTab.statuses.length > 0) {
        request = request.in("status", activeTab.statuses);
      }

      const { data, error } = await request.order("created_at", { ascending: false }).limit(100);
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as BoardRow[];
    },
  });

  const rows = query.data ?? [];

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-brand-900 sm:text-3xl">Orders</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Newest first. The list refreshes automatically every 20 seconds.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Order groups" className="flex flex-wrap gap-2">
          {BOARD_TABS.map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={!debounced && tab === item.value}
              onClick={() => {
                setTab(item.value);
                setSearch("");
              }}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-semibold transition",
                !debounced && tab === item.value
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-brand-200 bg-white text-brand-800 hover:bg-brand-50"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="relative ml-auto w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Find an order number"
            aria-label="Find an order by number"
            className="h-10 rounded-full border-brand-200 bg-white pl-10"
          />
        </div>
      </div>

      <div className="mt-6">
        {query.isLoading ? (
          <div className="space-y-3" aria-hidden>
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
          </div>
        ) : query.isError ? (
          <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
            We could not load the orders. {query.error instanceof Error ? query.error.message : ""}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-3xl border border-brand-100 bg-white p-10 text-center">
            <h2 className="text-lg font-extrabold text-brand-900">No orders here</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {debounced ? "No order number matches your search." : "There is nothing in this group right now."}
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {rows.map((order) => {
              const patient = one(order.patient);
              const branch = one(order.branch);
              const itemCount = (order.order_items ?? []).reduce((sum, item) => sum + item.quantity, 0);

              return (
                <li key={order.id}>
                  <Link
                    href={`/admin/orders/${order.id}`}
                    className="flex items-center gap-4 rounded-2xl border border-brand-100 bg-white p-4 transition hover:border-brand-300 hover:shadow-md"
                  >
                    <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 sm:flex">
                      {order.fulfilment_type === "delivery" ? (
                        <Truck className="h-6 w-6" />
                      ) : (
                        <Store className="h-6 w-6" />
                      )}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-x-2 text-sm font-bold text-brand-900">
                        {order.order_number}
                        <span className="text-xs font-semibold text-muted-foreground">
                          {patient?.full_name || "Customer"}
                        </span>
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })} - {itemCount}{" "}
                        {itemCount === 1 ? "item" : "items"} -{" "}
                        {order.fulfilment_type === "delivery" ? "Delivery" : "Pickup"}
                        {branch ? ` - ${branch.name}` : ""}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {PAYMENT_METHOD_LABELS[order.payment_method]}:{" "}
                        <span
                          className={cn(
                            "font-semibold",
                            order.payment_status === "paid" ? "text-green-700" : "text-amber-700"
                          )}
                        >
                          {PAYMENT_STATUS_LABELS[order.payment_status]}
                        </span>
                      </p>
                    </div>

                    <div className="hidden text-right sm:block">
                      <p className="text-sm font-extrabold text-brand-900">
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
        )}
      </div>
    </div>
  );
}

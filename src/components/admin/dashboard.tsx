"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { TriangleAlert, ChevronRight, ClipboardCheck, PackageCheck, Truck, Wallet } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatKes } from "@/lib/format";
import { useProfile } from "@/lib/hooks/use-profile";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface LowStockRow {
  inventory_id: string;
  product_name: string;
  sku: string;
  available_quantity: number;
  reorder_level: number;
  branch_name: string;
}

interface Stats {
  toProcess: number;
  readyOrOut: number;
  waiting: number;
  pendingRx: number;
  lowStockCount: number;
  lowStock: LowStockRow[];
  salesToday: number;
  paidOrdersToday: number;
}

async function countOrders(statuses: string[]): Promise<number> {
  const { count, error } = await createClient()
    .from("orders")
    .select("id", { count: "exact", head: true })
    .in("status", statuses);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

function StatCard({
  href,
  label,
  value,
  icon: Icon,
  highlight,
}: {
  href: string;
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-4 rounded-2xl border bg-white p-5 transition hover:shadow-md",
        highlight ? "border-amber-300" : "border-brand-100 hover:border-brand-300"
      )}
    >
      <span
        className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
          highlight ? "bg-amber-100 text-amber-800" : "bg-brand-50 text-brand-600"
        )}
      >
        <Icon className="h-6 w-6" />
      </span>
      <span className="flex-1">
        <span className="block text-2xl font-extrabold text-brand-900">{value}</span>
        <span className="block text-sm text-muted-foreground">{label}</span>
      </span>
      <ChevronRight className="h-5 w-5 text-muted-foreground" />
    </Link>
  );
}

export function AdminDashboard() {
  const { profile } = useProfile();
  const canSeePrescriptions = profile?.role === "pharmacist" || profile?.role === "admin";

  const query = useQuery({
    queryKey: ["admin-dashboard", canSeePrescriptions],
    enabled: Boolean(profile),
    refetchInterval: 30_000,
    queryFn: async (): Promise<Stats> => {
      const supabase = createClient();
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const [toProcess, readyOrOut, waiting, rx, lowStock, sales] = await Promise.all([
        countOrders(["confirmed", "packing"]),
        countOrders(["ready_for_pickup", "out_for_delivery"]),
        countOrders(["pending_payment", "awaiting_verification"]),
        canSeePrescriptions
          ? supabase
              .from("prescriptions")
              .select("id", { count: "exact", head: true })
              .eq("status", "pending")
          : Promise.resolve({ count: 0, error: null }),
        supabase
          .from("low_stock_alerts")
          .select("inventory_id, product_name, sku, available_quantity, reorder_level, branch_name", {
            count: "exact",
          })
          .order("available_quantity", { ascending: true })
          .limit(6),
        supabase
          .from("orders")
          .select("total")
          .eq("payment_status", "paid")
          .gte("created_at", startOfToday.toISOString()),
      ]);

      if (rx.error) throw new Error(rx.error.message);
      if (lowStock.error) throw new Error(lowStock.error.message);
      if (sales.error) throw new Error(sales.error.message);

      const salesRows = (sales.data ?? []) as { total: number | string }[];

      return {
        toProcess,
        readyOrOut,
        waiting,
        pendingRx: rx.count ?? 0,
        lowStockCount: lowStock.count ?? 0,
        lowStock: (lowStock.data ?? []) as LowStockRow[],
        salesToday: salesRows.reduce((sum, row) => sum + Number(row.total), 0),
        paidOrdersToday: salesRows.length,
      };
    },
  });

  if (query.isLoading || !profile) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-24 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        We could not load the overview. {query.error instanceof Error ? query.error.message : ""}
      </div>
    );
  }

  const stats = query.data;

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-brand-900 sm:text-3xl">
        Hello{profile.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Here is what needs attention. This page refreshes by itself.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          href="/admin/orders?tab=action"
          label="Orders to process"
          value={String(stats.toProcess)}
          icon={PackageCheck}
          highlight={stats.toProcess > 0}
        />
        <StatCard
          href="/admin/orders?tab=ready"
          label="Ready or on the way"
          value={String(stats.readyOrOut)}
          icon={Truck}
        />
        <StatCard
          href="/admin/orders?tab=waiting"
          label="Waiting for payment or prescription"
          value={String(stats.waiting)}
          icon={ClipboardCheck}
        />
        {canSeePrescriptions ? (
          <StatCard
            href="/pharmacist"
            label="Prescriptions awaiting review"
            value={String(stats.pendingRx)}
            icon={ClipboardCheck}
            highlight={stats.pendingRx > 0}
          />
        ) : null}
        <StatCard
          href="/admin/inventory"
          label="Items low or out of stock"
          value={String(stats.lowStockCount)}
          icon={TriangleAlert}
          highlight={stats.lowStockCount > 0}
        />
        <StatCard
          href="/admin/orders?tab=completed"
          label={`Paid today (${stats.paidOrdersToday} ${stats.paidOrdersToday === 1 ? "order" : "orders"})`}
          value={formatKes(stats.salesToday)}
          icon={Wallet}
        />
      </div>

      {stats.lowStock.length > 0 ? (
        <section className="mt-8 rounded-2xl border border-brand-100 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-extrabold text-brand-900">Low stock alerts</h2>
            <Link href="/admin/inventory" className="text-sm font-semibold text-brand-600 hover:underline">
              Manage stock
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-brand-100">
            {stats.lowStock.map((item) => (
              <li key={item.inventory_id} className="flex items-center justify-between gap-4 py-3 text-sm">
                <div>
                  <p className="font-semibold text-brand-900">{item.product_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.sku} - {item.branch_name}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-3 py-1 text-xs font-bold",
                    item.available_quantity <= 0
                      ? "bg-red-100 text-red-800"
                      : "bg-amber-100 text-amber-900"
                  )}
                >
                  {item.available_quantity <= 0
                    ? "Out of stock"
                    : `${item.available_quantity} left (reorder at ${item.reorder_level})`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

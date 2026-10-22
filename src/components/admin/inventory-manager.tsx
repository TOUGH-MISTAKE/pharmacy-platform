"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { LoaderCircle, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { selectClass, textareaClass } from "@/components/prescriptions/field-styles";
import { useProfile } from "@/lib/hooks/use-profile";
import { one } from "@/lib/prescriptions/types";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface ProductRow {
  id: string;
  sku: string;
  name: string;
  pack_size: string | null;
  requires_prescription: boolean;
  is_active: boolean;
}

interface InventoryRow {
  product_id: string;
  quantity: number;
  reserved_quantity: number;
  reorder_level: number;
}

interface AdjustmentRow {
  id: string;
  delta: number;
  quantity_after: number;
  reason: string;
  note: string | null;
  created_at: string;
  product: { name: string } | { name: string }[] | null;
  staff: { full_name: string } | { full_name: string }[] | null;
}

interface BranchOption {
  id: string;
  name: string;
}

type StockFilter = "all" | "low" | "out";

const REASONS: { value: string; label: string; sign: 1 | -1 | 0 }[] = [
  { value: "received", label: "Received new stock", sign: 1 },
  { value: "returned", label: "Customer return", sign: 1 },
  { value: "opening_stock", label: "Opening stock count", sign: 1 },
  { value: "correction", label: "Stock count correction", sign: 0 },
  { value: "damaged", label: "Damaged", sign: -1 },
  { value: "expired", label: "Expired", sign: -1 },
];

const REASON_LABELS: Record<string, string> = Object.fromEntries(
  REASONS.map((reason) => [reason.value, reason.label])
);

function stockState(row: { quantity: number; reserved: number; reorder: number }) {
  const available = row.quantity - row.reserved;
  if (row.quantity <= 0) return { label: "Out of stock", style: "bg-red-100 text-red-800", kind: "out" as const };
  if (available <= row.reorder)
    return { label: "Low", style: "bg-amber-100 text-amber-900", kind: "low" as const };
  return { label: "In stock", style: "bg-green-100 text-green-800", kind: "ok" as const };
}

function AdjustPanel({
  branchId,
  product,
  current,
  onDone,
}: {
  branchId: string;
  product: ProductRow;
  current: { quantity: number; reserved: number; reorder: number };
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("received");
  const [direction, setDirection] = useState<"add" | "remove">("add");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [reorder, setReorder] = useState(String(current.reorder));

  const reasonInfo = REASONS.find((item) => item.value === reason) ?? REASONS[0];

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["inventory"] });
    void queryClient.invalidateQueries({ queryKey: ["stock-adjustments"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
  }

  const adjust = useMutation({
    mutationFn: async () => {
      const amount = Number.parseInt(quantity, 10);
      if (!Number.isInteger(amount) || amount <= 0) {
        throw new Error("Enter a whole number greater than zero.");
      }
      const sign = reasonInfo.sign === 0 ? (direction === "add" ? 1 : -1) : reasonInfo.sign;
      const { error } = await createClient().rpc("adjust_stock", {
        p_branch_id: branchId,
        p_product_id: product.id,
        p_delta: sign * amount,
        p_reason: reason,
        p_note: note.trim() || null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Stock updated.");
      refresh();
      onDone();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const saveReorder = useMutation({
    mutationFn: async () => {
      const level = Number.parseInt(reorder, 10);
      if (!Number.isInteger(level) || level < 0) {
        throw new Error("Enter a reorder level of 0 or more.");
      }
      const { error } = await createClient().rpc("set_reorder_level", {
        p_branch_id: branchId,
        p_product_id: product.id,
        p_level: level,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Reorder level saved.");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="mt-4 grid gap-6 rounded-xl bg-brand-50 p-4 md:grid-cols-[1.5fr_1fr]">
      <div className="space-y-3">
        <h3 className="text-sm font-extrabold text-brand-900">Change stock</h3>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={`reason-${product.id}`} className="text-xs font-semibold text-brand-900">
              Reason
            </label>
            <select
              id={`reason-${product.id}`}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className={cn(selectClass, "mt-1 h-10")}
            >
              {REASONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor={`qty-${product.id}`} className="text-xs font-semibold text-brand-900">
              {reasonInfo.sign === 1
                ? "Quantity to add"
                : reasonInfo.sign === -1
                  ? "Quantity to remove"
                  : "Quantity"}
            </label>
            <Input
              id={`qty-${product.id}`}
              type="number"
              min={1}
              inputMode="numeric"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              className="mt-1 h-10 bg-white"
            />
          </div>
        </div>

        {reasonInfo.sign === 0 ? (
          <div role="radiogroup" aria-label="Add or remove" className="flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name={`dir-${product.id}`}
                checked={direction === "add"}
                onChange={() => setDirection("add")}
                className="accent-brand-600"
              />
              Add to stock
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name={`dir-${product.id}`}
                checked={direction === "remove"}
                onChange={() => setDirection("remove")}
                className="accent-brand-600"
              />
              Remove from stock
            </label>
          </div>
        ) : null}

        <div>
          <label htmlFor={`note-${product.id}`} className="text-xs font-semibold text-brand-900">
            Note (optional)
          </label>
          <textarea
            id={`note-${product.id}`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={200}
            placeholder="Supplier, batch number, or why it changed."
            className={cn(textareaClass, "mt-1 min-h-16 bg-white")}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={adjust.isPending}
            onClick={() => adjust.mutate()}
            className="rounded-full"
          >
            {adjust.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            Save stock change
          </Button>
          <Button type="button" variant="ghost" onClick={onDone} className="rounded-full">
            Close
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-extrabold text-brand-900">Low-stock warning</h3>
        <p className="text-xs text-muted-foreground">
          Warn me when the available quantity falls to this number or below.
        </p>
        <div className="flex gap-2">
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            value={reorder}
            onChange={(event) => setReorder(event.target.value)}
            aria-label="Reorder level"
            className="h-10 bg-white"
          />
          <Button
            type="button"
            variant="outline"
            disabled={saveReorder.isPending}
            onClick={() => saveReorder.mutate()}
            className="rounded-full"
          >
            {saveReorder.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

export function InventoryManager() {
  const { profile } = useProfile();
  const isAdmin = profile?.role === "admin";

  const [chosenBranchId, setChosenBranchId] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StockFilter>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const branchesQuery = useQuery({
    queryKey: ["inventory-branches"],
    enabled: Boolean(profile),
    queryFn: async (): Promise<BranchOption[]> => {
      const { data, error } = await createClient()
        .from("branches")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw new Error(error.message);
      return (data ?? []) as BranchOption[];
    },
  });

  const branches = branchesQuery.data ?? [];
  const branchId = isAdmin
    ? chosenBranchId || branches[0]?.id || ""
    : (profile?.branch_id ?? "");
  const branchName = branches.find((branch) => branch.id === branchId)?.name ?? "";

  const productsQuery = useQuery({
    queryKey: ["inventory-products"],
    enabled: Boolean(profile),
    queryFn: async (): Promise<ProductRow[]> => {
      const { data, error } = await createClient()
        .from("products")
        .select("id, sku, name, pack_size, requires_prescription, is_active")
        .order("name")
        .limit(1000);
      if (error) throw new Error(error.message);
      return (data ?? []) as ProductRow[];
    },
  });

  const stockQuery = useQuery({
    queryKey: ["inventory", branchId],
    enabled: Boolean(branchId),
    refetchInterval: 30_000,
    queryFn: async (): Promise<InventoryRow[]> => {
      const { data, error } = await createClient()
        .from("branch_inventory")
        .select("product_id, quantity, reserved_quantity, reorder_level")
        .eq("branch_id", branchId)
        .limit(2000);
      if (error) throw new Error(error.message);
      return (data ?? []) as InventoryRow[];
    },
  });

  const adjustmentsQuery = useQuery({
    queryKey: ["stock-adjustments", branchId],
    enabled: Boolean(branchId),
    queryFn: async (): Promise<AdjustmentRow[]> => {
      const { data, error } = await createClient()
        .from("stock_adjustments")
        .select(
          "id, delta, quantity_after, reason, note, created_at, product:products(name), staff:profiles!created_by(full_name)"
        )
        .eq("branch_id", branchId)
        .order("created_at", { ascending: false })
        .limit(15);
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as AdjustmentRow[];
    },
  });

  if (!profile || branchesQuery.isLoading) {
    return <Skeleton className="h-96 w-full rounded-2xl" />;
  }

  if (!branchId) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-10 text-center text-sm text-amber-900">
        Your account is not assigned to a branch yet. Ask an admin to assign you to one.
      </div>
    );
  }

  const stockByProduct = new Map((stockQuery.data ?? []).map((row) => [row.product_id, row]));
  const term = search.trim().toLowerCase();

  const rows = (productsQuery.data ?? [])
    .filter((product) => product.is_active || stockByProduct.has(product.id))
    .map((product) => {
      const stock = stockByProduct.get(product.id);
      const quantity = stock?.quantity ?? 0;
      const reserved = stock?.reserved_quantity ?? 0;
      const reorder = stock?.reorder_level ?? 10;
      return { product, quantity, reserved, reorder, state: stockState({ quantity, reserved, reorder }) };
    })
    .filter((row) => {
      if (term && !`${row.product.name} ${row.product.sku}`.toLowerCase().includes(term)) return false;
      if (filter === "low") return row.state.kind === "low";
      if (filter === "out") return row.state.kind === "out";
      return true;
    });

  const allRows = productsQuery.data ?? [];
  const lowCount = allRows.filter((product) => {
    const stock = stockByProduct.get(product.id);
    return stockState({
      quantity: stock?.quantity ?? 0,
      reserved: stock?.reserved_quantity ?? 0,
      reorder: stock?.reorder_level ?? 10,
    }).kind === "low";
  }).length;
  const outCount = allRows.filter((product) => (stockByProduct.get(product.id)?.quantity ?? 0) <= 0).length;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-brand-900 sm:text-3xl">Inventory</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {branchName ? `${branchName}. ` : ""}
            Every stock change is recorded with your name and the reason.
          </p>
        </div>

        {isAdmin && branches.length > 1 ? (
          <select
            value={branchId}
            onChange={(event) => {
              setChosenBranchId(event.target.value);
              setOpenId(null);
            }}
            aria-label="Branch"
            className={cn(selectClass, "h-10 w-auto rounded-full")}
          >
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Stock level" className="flex flex-wrap gap-2">
          {(
            [
              { value: "all", label: "All products" },
              { value: "low", label: `Low (${lowCount})` },
              { value: "out", label: `Out of stock (${outCount})` },
            ] as { value: StockFilter; label: string }[]
          ).map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={filter === item.value}
              onClick={() => setFilter(item.value)}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-semibold transition",
                filter === item.value
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-brand-200 bg-white text-brand-800 hover:bg-brand-50"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="relative ml-auto w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name or code"
            aria-label="Search products"
            className="h-10 rounded-full border-brand-200 bg-white pl-10"
          />
        </div>
      </div>

      <div className="mt-6">
        {productsQuery.isLoading || stockQuery.isLoading ? (
          <div className="space-y-3" aria-hidden>
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
          </div>
        ) : productsQuery.isError || stockQuery.isError ? (
          <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
            We could not load the inventory. Please refresh the page.
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-3xl border border-brand-100 bg-white p-10 text-center text-sm text-muted-foreground">
            No products match.
          </div>
        ) : (
          <ul className="space-y-3">
            {rows.map(({ product, quantity, reserved, reorder, state }) => (
              <li key={product.id} className="rounded-2xl border border-brand-100 bg-white p-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-brand-900">
                      {product.name}
                      {product.requires_prescription ? (
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 align-middle text-[0.65rem] font-bold text-amber-900">
                          Rx
                        </span>
                      ) : null}
                      {!product.is_active ? (
                        <span className="ml-2 rounded-full bg-gray-200 px-2 py-0.5 align-middle text-[0.65rem] font-bold text-gray-700">
                          Hidden
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {product.sku}
                      {product.pack_size ? ` - ${product.pack_size}` : ""}
                    </p>
                  </div>

                  <dl className="flex gap-6 text-center text-xs">
                    <div>
                      <dt className="text-muted-foreground">In stock</dt>
                      <dd className="text-base font-extrabold text-brand-900">{quantity}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Reserved</dt>
                      <dd className="text-base font-extrabold text-brand-900">{reserved}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Warn at</dt>
                      <dd className="text-base font-extrabold text-brand-900">{reorder}</dd>
                    </div>
                  </dl>

                  <span className={cn("rounded-full px-3 py-1 text-xs font-bold", state.style)}>
                    {state.label}
                  </span>

                  <Button
                    type="button"
                    size="sm"
                    variant={openId === product.id ? "secondary" : "outline"}
                    onClick={() => setOpenId(openId === product.id ? null : product.id)}
                    className="rounded-full"
                  >
                    {openId === product.id ? "Close" : "Adjust"}
                  </Button>
                </div>

                {openId === product.id ? (
                  <AdjustPanel
                    key={`${product.id}-${quantity}-${reorder}`}
                    branchId={branchId}
                    product={product}
                    current={{ quantity, reserved, reorder }}
                    onDone={() => setOpenId(null)}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-extrabold text-brand-900">Recent stock changes</h2>
        {adjustmentsQuery.isLoading ? (
          <Skeleton className="mt-3 h-32 w-full rounded-2xl" />
        ) : (adjustmentsQuery.data ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No stock changes recorded yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-brand-100 rounded-2xl border border-brand-100 bg-white">
            {(adjustmentsQuery.data ?? []).map((entry) => {
              const product = one(entry.product);
              const staff = one(entry.staff);
              return (
                <li key={entry.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div>
                    <p className="font-semibold text-brand-900">{product?.name ?? "Product"}</p>
                    <p className="text-xs text-muted-foreground">
                      {REASON_LABELS[entry.reason] ?? entry.reason}
                      {entry.note ? ` - ${entry.note}` : ""} - {staff?.full_name || "Staff"},{" "}
                      {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <p className="text-right">
                    <span
                      className={cn(
                        "font-extrabold",
                        entry.delta > 0 ? "text-green-700" : "text-red-700"
                      )}
                    >
                      {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
                    </span>
                    <span className="ml-2 text-xs text-muted-foreground">now {entry.quantity_after}</span>
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

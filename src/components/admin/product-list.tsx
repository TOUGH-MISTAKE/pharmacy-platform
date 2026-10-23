"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Pencil, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { ProductImage } from "@/components/shop/product-image";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatKes } from "@/lib/format";
import { one } from "@/lib/prescriptions/types";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface Row {
  id: string;
  sku: string;
  slug: string;
  name: string;
  price_kes: number | string;
  is_active: boolean;
  requires_prescription: boolean;
  image_urls: string[] | null;
  brand: { name: string } | { name: string }[] | null;
  category: { name: string } | { name: string }[] | null;
}

type Filter = "all" | "active" | "hidden";

export function ProductList() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const query = useQuery({
    queryKey: ["admin-products"],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await createClient()
        .from("products")
        .select(
          "id, sku, slug, name, price_kes, is_active, requires_prescription, image_urls, brand:brands(name), category:categories(name)"
        )
        .order("name")
        .limit(1000);
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as Row[];
    },
  });

  const toggle = useMutation({
    mutationFn: async (input: { id: string; isActive: boolean }) => {
      const { data, error } = await createClient()
        .from("products")
        .update({ is_active: input.isActive })
        .eq("id", input.id)
        .select("id");
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) throw new Error("You do not have permission to change products.");
    },
    onSuccess: (_result, input) => {
      toast.success(input.isActive ? "Product is now visible in the shop." : "Product hidden from the shop.");
      void queryClient.invalidateQueries({ queryKey: ["admin-products"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const term = search.trim().toLowerCase();
  const rows = (query.data ?? []).filter((row) => {
    if (filter === "active" && !row.is_active) return false;
    if (filter === "hidden" && row.is_active) return false;
    if (term && !`${row.name} ${row.sku}`.toLowerCase().includes(term)) return false;
    return true;
  });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-brand-900 sm:text-3xl">Products</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Add, edit and hide the items in your shop.
          </p>
        </div>
        <Link href="/admin/products/new" className={cn(buttonVariants(), "rounded-full")}>
          <Plus className="h-4 w-4" />
          Add product
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Visibility" className="flex gap-2">
          {(
            [
              { value: "all", label: "All" },
              { value: "active", label: "Visible" },
              { value: "hidden", label: "Hidden" },
            ] as { value: Filter; label: string }[]
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
        {query.isLoading ? (
          <div className="space-y-3" aria-hidden>
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
          </div>
        ) : query.isError ? (
          <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
            We could not load the products. Please refresh the page.
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-3xl border border-brand-100 bg-white p-10 text-center text-sm text-muted-foreground">
            No products match.
          </div>
        ) : (
          <ul className="space-y-3">
            {rows.map((row) => {
              const brand = one(row.brand);
              const category = one(row.category);
              return (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center gap-4 rounded-2xl border border-brand-100 bg-white p-3"
                >
                  <ProductImage
                    src={row.image_urls?.[0] ?? null}
                    alt={row.name}
                    className="h-16 w-16 shrink-0 rounded-xl border border-brand-100"
                  />

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-brand-900">
                      {row.name}
                      {row.requires_prescription ? (
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 align-middle text-[0.65rem] font-bold text-amber-900">
                          Rx
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {row.sku}
                      {brand ? ` - ${brand.name}` : ""}
                      {category ? ` - ${category.name}` : ""}
                    </p>
                  </div>

                  <p className="text-sm font-extrabold text-brand-900">{formatKes(Number(row.price_kes))}</p>

                  <span
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-bold",
                      row.is_active ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-700"
                    )}
                  >
                    {row.is_active ? "Visible" : "Hidden"}
                  </span>

                  <div className="flex items-center gap-2">
                    {row.is_active ? (
                      <Link
                        href={`/products/${row.slug}`}
                        target="_blank"
                        aria-label={`View ${row.name} in the shop`}
                        className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "rounded-full")}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={toggle.isPending}
                      onClick={() => toggle.mutate({ id: row.id, isActive: !row.is_active })}
                      className="rounded-full"
                    >
                      {row.is_active ? "Hide" : "Show"}
                    </Button>
                    <Link
                      href={`/admin/products/${row.id}`}
                      className={cn(buttonVariants({ size: "sm" }), "rounded-full")}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

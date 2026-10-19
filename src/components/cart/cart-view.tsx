"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, FileText, LoaderCircle, ShoppingBag, Tag, Trash2, X } from "lucide-react";
import { QuantityStepper } from "@/components/cart/quantity-stepper";
import { ProductImage } from "@/components/shop/product-image";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatKes } from "@/lib/format";
import { useAuthUser } from "@/lib/hooks/use-auth-user";
import {
  selectHasPrescriptionItems,
  selectItemCount,
  selectSubtotal,
  useCartStore,
} from "@/lib/stores/cart-store";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface DiscountResult {
  discount_id: string | null;
  discount_amount: number | string | null;
  message: string | null;
}

export function CartView() {
  const hydrated = useCartStore((state) => state.hydrated);
  const items = useCartStore((state) => state.items);
  const discountCode = useCartStore((state) => state.discountCode);
  const itemCount = useCartStore(selectItemCount);
  const subtotal = useCartStore(selectSubtotal);
  const hasPrescriptionItems = useCartStore(selectHasPrescriptionItems);
  const setQuantity = useCartStore((state) => state.setQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const setDiscountCode = useCartStore((state) => state.setDiscountCode);
  const clear = useCartStore((state) => state.clear);

  const { loading: authLoading, userId } = useAuthUser();
  const [codeInput, setCodeInput] = useState("");

  const discountQuery = useQuery({
    queryKey: ["cart-discount", discountCode, subtotal, userId],
    enabled: Boolean(discountCode) && Boolean(userId) && subtotal > 0,
    queryFn: async (): Promise<DiscountResult | null> => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("calculate_discount", {
        p_code: discountCode,
        p_subtotal: subtotal,
      });
      if (error) throw new Error(error.message);
      const rows = data as DiscountResult[] | null;
      return rows?.[0] ?? null;
    },
  });

  if (!hydrated) {
    return (
      <div aria-hidden className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-4">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
        </div>
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-md rounded-3xl border border-brand-100 bg-white p-10 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <ShoppingBag className="h-8 w-8" />
        </span>
        <h1 className="mt-5 text-2xl font-extrabold text-brand-900">Your cart is empty</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Browse our medicines and health products to get started.
        </p>
        <Link href="/products" className={cn(buttonVariants({ size: "lg" }), "mt-6 rounded-full px-6")}>
          Start shopping
        </Link>
      </div>
    );
  }

  const discountRow = discountQuery.data;
  const discountValid = Boolean(discountRow?.discount_id);
  const discountAmount = discountValid ? Number(discountRow?.discount_amount ?? 0) : 0;
  const total = Math.max(subtotal - discountAmount, 0);

  function handleApplyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = codeInput.trim().toUpperCase();
    if (!code) return;
    setDiscountCode(code);
    setCodeInput("");
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-brand-900 sm:text-3xl">Your cart</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {itemCount} {itemCount === 1 ? "item" : "items"}
          </p>
        </div>
        <button
          type="button"
          onClick={clear}
          className="text-sm font-semibold text-red-700 hover:underline"
        >
          Empty cart
        </button>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-start">
        <ul className="divide-y divide-brand-100 rounded-2xl border border-brand-100 bg-white px-4 sm:px-5">
          {items.map((item) => (
            <li key={item.productId} className="flex gap-4 py-5">
              <Link href={`/products/${item.slug}`} className="shrink-0">
                <ProductImage
                  src={item.imageUrl}
                  alt={item.name}
                  className="h-24 w-24 rounded-xl border border-brand-100"
                />
              </Link>

              <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:justify-between">
                <div className="space-y-1">
                  <Link
                    href={`/products/${item.slug}`}
                    className="text-sm font-bold text-brand-900 hover:text-brand-600"
                  >
                    {item.name}
                  </Link>
                  {item.packSize ? (
                    <p className="text-xs text-muted-foreground">{item.packSize}</p>
                  ) : null}
                  {item.requiresPrescription ? (
                    <span className="inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-[0.7rem] font-bold text-amber-900">
                      Prescription required
                    </span>
                  ) : null}
                  <p className="text-xs text-muted-foreground">{formatKes(item.price)} each</p>
                </div>

                <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end sm:justify-start">
                  <QuantityStepper
                    value={item.quantity}
                    onChange={(value) => setQuantity(item.productId, value)}
                    label={item.name}
                  />
                  <p className="text-sm font-extrabold text-brand-900">
                    {formatKes(item.price * item.quantity)}
                  </p>
                  <button
                    type="button"
                    onClick={() => removeItem(item.productId)}
                    aria-label={`Remove ${item.name} from cart`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 hover:underline"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <aside className="space-y-4 rounded-2xl border border-brand-100 bg-white p-5 lg:sticky lg:top-40">
          <h2 className="text-lg font-extrabold text-brand-900">Order summary</h2>

          <div className="space-y-2 border-b border-brand-100 pb-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-semibold">{formatKes(subtotal)}</span>
            </div>
            {discountValid ? (
              <div className="flex justify-between text-brand-700">
                <span>Discount ({discountCode})</span>
                <span className="font-semibold">-{formatKes(discountAmount)}</span>
              </div>
            ) : null}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Delivery</span>
              <span className="text-muted-foreground">Calculated at checkout</span>
            </div>
          </div>

          <div className="flex items-baseline justify-between">
            <span className="text-base font-bold text-brand-900">Estimated total</span>
            <span className="text-xl font-extrabold text-brand-900">{formatKes(total)}</span>
          </div>

          <div className="border-t border-brand-100 pt-4">
            <p className="flex items-center gap-2 text-sm font-bold text-brand-900">
              <Tag className="h-4 w-4 text-brand-600" />
              Discount code
            </p>

            {discountCode ? (
              <div className="mt-2 space-y-2">
                <div className="flex items-center justify-between rounded-lg bg-brand-50 px-3 py-2 text-sm">
                  <span className="font-bold text-brand-800">{discountCode}</span>
                  <button
                    type="button"
                    onClick={() => setDiscountCode(null)}
                    aria-label="Remove discount code"
                    className="text-muted-foreground hover:text-red-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {discountQuery.isFetching ? (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <LoaderCircle className="h-3 w-3 animate-spin" />
                    Checking code...
                  </p>
                ) : discountQuery.isError ? (
                  <p role="alert" className="text-xs text-destructive">
                    We could not check this code right now. It will be checked again at checkout.
                  </p>
                ) : discountRow && !discountValid ? (
                  <p role="alert" className="text-xs text-destructive">
                    {discountRow.message ?? "This code cannot be used."}
                  </p>
                ) : discountValid ? (
                  <p className="text-xs text-brand-700">{discountRow?.message}</p>
                ) : null}
              </div>
            ) : authLoading ? null : userId ? (
              <form onSubmit={handleApplyCode} className="mt-2 flex gap-2">
                <Input
                  value={codeInput}
                  onChange={(event) => setCodeInput(event.target.value)}
                  placeholder="Enter code"
                  aria-label="Discount code"
                  autoCapitalize="characters"
                  className="h-10 uppercase"
                />
                <Button type="submit" variant="outline" className="rounded-full">
                  Apply
                </Button>
              </form>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                <Link
                  href="/login?next=/cart"
                  className="font-semibold text-brand-600 hover:underline"
                >
                  Sign in
                </Link>{" "}
                to use a discount code.
              </p>
            )}
          </div>

          {hasPrescriptionItems ? (
            <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <FileText className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Your cart has prescription-only items. You will attach your prescription at
                checkout, and a pharmacist will verify it before we dispense.
              </p>
            </div>
          ) : null}

          <Link
            href="/checkout"
            className={cn(buttonVariants({ size: "lg" }), "w-full rounded-full")}
          >
            Proceed to checkout
            <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="text-center text-xs text-muted-foreground">
            Final prices and stock are confirmed at checkout.
          </p>
        </aside>
      </div>
    </div>
  );
}

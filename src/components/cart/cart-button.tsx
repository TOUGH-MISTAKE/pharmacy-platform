"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { selectItemCount, useCartStore } from "@/lib/stores/cart-store";
import { cn } from "@/lib/utils";

export function CartButton() {
  const count = useCartStore(selectItemCount);
  const hydrated = useCartStore((state) => state.hydrated);
  const visibleCount = hydrated ? count : 0;

  return (
    <Link
      href="/cart"
      aria-label={
        visibleCount > 0 ? `Shopping cart, ${visibleCount} items` : "Shopping cart, empty"
      }
      className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "relative")}
    >
      <ShoppingCart className="h-5 w-5" />
      {visibleCount > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1 text-[0.65rem] font-bold text-white">
          {visibleCount > 99 ? "99+" : visibleCount}
        </span>
      ) : null}
    </Link>
  );
}

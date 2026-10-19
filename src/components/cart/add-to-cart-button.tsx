"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { QuantityStepper } from "@/components/cart/quantity-stepper";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/lib/stores/cart-store";
import type { Product } from "@/lib/products/types";
import { cn } from "@/lib/utils";

interface AddToCartButtonProps {
  product: Pick<
    Product,
    "id" | "slug" | "name" | "price" | "imageUrls" | "packSize" | "requiresPrescription"
  >;
  showQuantity?: boolean;
  className?: string;
}

export function AddToCartButton({ product, showQuantity = false, className }: AddToCartButtonProps) {
  const router = useRouter();
  const addItem = useCartStore((state) => state.addItem);
  const [quantity, setQuantity] = useState(1);

  function handleAdd() {
    addItem(
      {
        productId: product.id,
        slug: product.slug,
        name: product.name,
        price: product.price,
        imageUrl: product.imageUrls[0] ?? null,
        packSize: product.packSize,
        requiresPrescription: product.requiresPrescription,
      },
      quantity
    );

    toast.success(`${product.name} added to your cart`, {
      action: { label: "View cart", onClick: () => router.push("/cart") },
    });
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      {showQuantity ? (
        <QuantityStepper value={quantity} onChange={setQuantity} label={product.name} />
      ) : null}
      <Button
        type="button"
        onClick={handleAdd}
        className={cn("rounded-full", showQuantity ? "px-6" : "w-full")}
        size={showQuantity ? "lg" : "default"}
      >
        <ShoppingCart className="h-4 w-4" />
        Add to cart
      </Button>
    </div>
  );
}

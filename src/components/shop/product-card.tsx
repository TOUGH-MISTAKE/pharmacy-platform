import Link from "next/link";
import { AddToCartButton } from "@/components/cart/add-to-cart-button";
import { ProductImage } from "@/components/shop/product-image";
import { formatKes } from "@/lib/format";
import type { Product } from "@/lib/products/types";

export function ProductCard({ product }: { product: Product }) {
  const compare = product.comparePrice;
  const hasDiscount = compare !== null && compare > product.price;
  const percentOff = hasDiscount ? Math.round((1 - product.price / compare) * 100) : 0;
  const details = [product.strength, product.packSize].filter(Boolean).join(" \u00B7 ");

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-sm transition hover:border-brand-300 hover:shadow-md">
      <Link href={`/products/${product.slug}`} className="relative block">
        <ProductImage
          src={product.imageUrls[0] ?? null}
          alt={product.name}
          className="aspect-square w-full"
        />
        <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
          {product.requiresPrescription ? (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[0.7rem] font-bold text-amber-900">
              Prescription required
            </span>
          ) : null}
          {hasDiscount ? (
            <span className="rounded-full bg-brand-600 px-2.5 py-1 text-[0.7rem] font-bold text-white">
              {percentOff}% off
            </span>
          ) : null}
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-1 p-4">
        {product.brand ? (
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
            {product.brand.name}
          </p>
        ) : null}
        <h3 className="text-sm font-bold leading-snug text-brand-900">
          <Link href={`/products/${product.slug}`} className="hover:text-brand-600">
            {product.name}
          </Link>
        </h3>
        {details ? <p className="text-xs text-muted-foreground">{details}</p> : null}

        <div className="mt-auto pt-3">
          <p className="flex items-baseline gap-2">
            <span className="text-base font-extrabold text-brand-900">
              {formatKes(product.price)}
            </span>
            {hasDiscount ? (
              <span className="text-xs text-muted-foreground line-through">
                {formatKes(compare)}
              </span>
            ) : null}
          </p>
          <AddToCartButton product={product} className="mt-3" />
        </div>
      </div>
    </article>
  );
}

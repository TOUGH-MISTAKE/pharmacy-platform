import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductResults } from "@/components/shop/product-results";
import { ProductResultsSkeleton } from "@/components/shop/product-results-skeleton";
import type { RawSearchParams } from "@/lib/products/filters";

export const metadata: Metadata = {
  title: "Shop medicines and health products",
  description: "Browse genuine medicines, vitamins, skincare and baby products at Similife Pharmacy.",
};

export default function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <Suspense fallback={<ProductResultsSkeleton />}>
        <ProductResults searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

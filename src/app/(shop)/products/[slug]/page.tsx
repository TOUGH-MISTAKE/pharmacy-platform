import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductDetail } from "@/components/shop/product-detail";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Product details",
};

function ProductDetailSkeleton() {
  return (
    <div aria-hidden>
      <Skeleton className="h-4 w-56" />
      <div className="mt-6 grid gap-8 md:grid-cols-2 lg:gap-12">
        <Skeleton className="aspect-square w-full rounded-3xl" />
        <div className="space-y-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-3/4" />
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-12 w-full rounded-full" />
        </div>
      </div>
    </div>
  );
}

export default function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <Suspense fallback={<ProductDetailSkeleton />}>
        <ProductDetail params={params} />
      </Suspense>
    </div>
  );
}

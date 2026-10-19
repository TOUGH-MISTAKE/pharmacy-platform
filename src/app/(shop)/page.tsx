import { Suspense } from "react";
import { CategoryGrid } from "@/components/home/category-grid";
import { Hero } from "@/components/home/hero";
import { PrescriptionSteps } from "@/components/home/prescription-steps";
import { TrustBar } from "@/components/home/trust-bar";
import { Skeleton } from "@/components/ui/skeleton";

function CategoryGridSkeleton() {
  return (
    <section aria-hidden className="mx-auto max-w-7xl px-4 pt-14">
      <Skeleton className="h-8 w-56" />
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-32 rounded-2xl" />
        ))}
      </div>
    </section>
  );
}

export default function HomePage() {
  return (
    <>
      <Hero />
      <TrustBar />
      <Suspense fallback={<CategoryGridSkeleton />}>
        <CategoryGrid />
      </Suspense>
      <PrescriptionSteps />
    </>
  );
}
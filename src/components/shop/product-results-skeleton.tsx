import { Skeleton } from "@/components/ui/skeleton";

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="overflow-hidden rounded-2xl border border-brand-100 bg-white">
          <Skeleton className="aspect-square w-full rounded-none" />
          <div className="space-y-2 p-4">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-9 w-full rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProductResultsSkeleton() {
  return (
    <div aria-hidden>
      <Skeleton className="h-9 w-64" />
      <Skeleton className="mt-2 h-4 w-32" />
      <div className="mt-8 grid gap-8 lg:grid-cols-[16rem_1fr]">
        <Skeleton className="hidden h-96 rounded-2xl lg:block" />
        <ProductGridSkeleton />
      </div>
    </div>
  );
}

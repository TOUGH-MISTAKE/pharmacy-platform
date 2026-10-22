import type { Metadata } from "next";
import { Suspense } from "react";
import { BranchLocator } from "@/components/branches/branch-locator";
import { Skeleton } from "@/components/ui/skeleton";
import { getActiveBranches } from "@/lib/branches/queries";

export const metadata: Metadata = {
  title: "Find a branch",
  description: "Find your nearest Similife Pharmacy branch, opening hours, directions and contact details.",
};

async function BranchesContent() {
  try {
    const branches = await getActiveBranches();

    if (branches.length === 0) {
      return (
        <div className="rounded-2xl border border-brand-100 bg-white p-10 text-center text-sm text-muted-foreground">
          Branch details are coming soon.
        </div>
      );
    }

    return <BranchLocator branches={branches} />;
  } catch (error) {
    console.error("Could not load branches:", error instanceof Error ? error.message : error);
    return (
      <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-sm text-red-700">
        We could not load our branches. Please refresh the page.
      </div>
    );
  }
}

export default function BranchesPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-extrabold text-brand-900 sm:text-3xl">Find a branch</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Collect your order in store, or find the branch closest to you.
      </p>

      <div className="mt-6">
        <Suspense
          fallback={
            <div className="grid gap-6 lg:grid-cols-[24rem_1fr]" aria-hidden>
              <div className="space-y-3">
                <Skeleton className="h-11 w-full rounded-full" />
                <Skeleton className="h-48 w-full rounded-2xl" />
                <Skeleton className="h-48 w-full rounded-2xl" />
              </div>
              <Skeleton className="h-80 w-full rounded-2xl lg:h-[34rem]" />
            </div>
          }
        >
          <BranchesContent />
        </Suspense>
      </div>
    </div>
  );
}

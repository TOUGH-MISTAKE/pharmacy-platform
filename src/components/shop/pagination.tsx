import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buildProductsUrl } from "@/lib/products/filters";
import type { ProductFilters } from "@/lib/products/types";
import { cn } from "@/lib/utils";

function pageWindow(current: number, total: number): (number | "gap")[] {
  const wanted = new Set<number>([1, total, current - 1, current, current + 1]);
  const pages = [...wanted].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b);

  const result: (number | "gap")[] = [];
  pages.forEach((page, index) => {
    if (index > 0 && page - pages[index - 1] > 1) {
      result.push("gap");
    }
    result.push(page);
  });
  return result;
}

export function Pagination({
  filters,
  totalPages,
}: {
  filters: ProductFilters;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;

  const current = Math.min(filters.page, totalPages);
  const baseLink =
    "inline-flex h-10 min-w-10 items-center justify-center rounded-full border px-3 text-sm font-semibold transition";

  return (
    <nav aria-label="Pagination" className="mt-10 flex flex-wrap items-center justify-center gap-2">
      {current > 1 ? (
        <Link
          href={buildProductsUrl(filters, { page: current - 1 })}
          className={cn(baseLink, "border-brand-200 bg-white text-brand-700 hover:bg-brand-50")}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Link>
      ) : null}

      {pageWindow(current, totalPages).map((item, index) =>
        item === "gap" ? (
          <span key={`gap-${index}`} className="px-1 text-muted-foreground">
            ...
          </span>
        ) : (
          <Link
            key={item}
            href={buildProductsUrl(filters, { page: item })}
            aria-current={item === current ? "page" : undefined}
            className={cn(
              baseLink,
              item === current
                ? "border-brand-600 bg-brand-600 text-white"
                : "border-brand-200 bg-white text-brand-700 hover:bg-brand-50"
            )}
          >
            {item}
          </Link>
        )
      )}

      {current < totalPages ? (
        <Link
          href={buildProductsUrl(filters, { page: current + 1 })}
          className={cn(baseLink, "border-brand-200 bg-white text-brand-700 hover:bg-brand-50")}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Link>
      ) : null}
    </nav>
  );
}

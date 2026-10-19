import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import { Pagination } from "@/components/shop/pagination";
import { ProductCard } from "@/components/shop/product-card";
import { ProductFiltersPanel } from "@/components/shop/product-filters";
import { SortSelect } from "@/components/shop/sort-select";
import { buttonVariants } from "@/components/ui/button";
import {
  PAGE_SIZE,
  SORT_OPTIONS,
  buildProductsUrl,
  hasActiveFilters,
  parseFilters,
  type RawSearchParams,
} from "@/lib/products/filters";
import { getFilterOptions, getProducts } from "@/lib/products/queries";
import type { ProductFilters } from "@/lib/products/types";
import { cn } from "@/lib/utils";

async function loadData(filters: ProductFilters) {
  try {
    const options = await getFilterOptions();
    const result = await getProducts(filters, options.categories, options.brands);
    return { options, result };
  } catch (error) {
    console.error("Could not load products:", error instanceof Error ? error.message : error);
    return null;
  }
}

export async function ProductResults({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const filters = parseFilters(await searchParams);
  const data = await loadData(filters);

  if (!data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
        <h1 className="text-xl font-extrabold text-red-800">We could not load the products</h1>
        <p className="mt-2 text-sm text-red-700">
          Please check your internet connection and refresh the page. If this keeps happening,
          contact us.
        </p>
      </div>
    );
  }

  const { options, result } = data;
  const totalPages = Math.max(Math.ceil(result.total / PAGE_SIZE), 1);
  const categoryName = options.categories.find((item) => item.slug === filters.category)?.name;
  const brandName = options.brands.find((item) => item.slug === filters.brand)?.name;

  const heading = filters.q
    ? `Results for "${filters.q}"`
    : (categoryName ?? brandName ?? "All products");

  const sortOptions = SORT_OPTIONS.map((option) => ({
    ...option,
    href: buildProductsUrl(filters, { sort: option.value }),
  }));

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-brand-900 sm:text-3xl">{heading}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {result.total} {result.total === 1 ? "product" : "products"}
          </p>
        </div>
        <SortSelect value={filters.sort} options={sortOptions} />
      </div>

      <details className="mt-6 rounded-2xl border border-brand-100 bg-white lg:hidden">
        <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-bold text-brand-800">
          <SlidersHorizontal className="h-4 w-4" />
          Filters
        </summary>
        <div className="border-t border-brand-100 p-3">
          <ProductFiltersPanel
            filters={filters}
            categories={options.categories}
            brands={options.brands}
          />
        </div>
      </details>

      <div className="mt-6 grid gap-8 lg:grid-cols-[16rem_1fr]">
        <aside className="hidden lg:block" aria-label="Product filters">
          <ProductFiltersPanel
            filters={filters}
            categories={options.categories}
            brands={options.brands}
          />
        </aside>

        <div>
          {result.products.length === 0 ? (
            <div className="rounded-2xl border border-brand-100 bg-white p-10 text-center">
              <h2 className="text-lg font-bold text-brand-900">No products found</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Try a different search, or remove some filters.
              </p>
              {hasActiveFilters(filters) ? (
                <Link
                  href="/products"
                  className={cn(buttonVariants({ variant: "outline" }), "mt-5 rounded-full")}
                >
                  Clear all filters
                </Link>
              ) : null}
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
              {result.products.map((product) => (
                <li key={product.id}>
                  <ProductCard product={product} />
                </li>
              ))}
            </ul>
          )}

          <Pagination filters={filters} totalPages={totalPages} />
        </div>
      </div>
    </div>
  );
}

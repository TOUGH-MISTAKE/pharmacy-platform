import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildProductsUrl, hasActiveFilters } from "@/lib/products/filters";
import type { BrandSummary, CategorySummary, ProductFilters } from "@/lib/products/types";
import { cn } from "@/lib/utils";

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "block rounded-lg px-3 py-2 text-sm transition-colors",
        active ? "bg-brand-50 font-bold text-brand-700" : "text-foreground hover:bg-brand-50"
      )}
    >
      {children}
    </Link>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-brand-100 pb-4 last:border-b-0">
      <h3 className="mb-2 px-3 text-xs font-bold uppercase tracking-wider text-brand-800">
        {title}
      </h3>
      <div className="space-y-0.5">{children}</div>
    </section>
  );
}

interface ProductFiltersPanelProps {
  filters: ProductFilters;
  categories: CategorySummary[];
  brands: BrandSummary[];
}

export function ProductFiltersPanel({ filters, categories, brands }: ProductFiltersPanelProps) {
  return (
    <div className="space-y-5">
      {hasActiveFilters(filters) ? (
        <Link
          href="/products"
          className="inline-block px-3 text-sm font-semibold text-brand-600 hover:underline"
        >
          Clear all filters
        </Link>
      ) : null}

      <FilterGroup title="Category">
        <FilterLink href={buildProductsUrl(filters, { category: null })} active={!filters.category}>
          All categories
        </FilterLink>
        {categories.map((category) => (
          <FilterLink
            key={category.id}
            href={buildProductsUrl(filters, { category: category.slug })}
            active={filters.category === category.slug}
          >
            {category.name}
          </FilterLink>
        ))}
      </FilterGroup>

      <FilterGroup title="Type">
        <FilterLink href={buildProductsUrl(filters, { type: "all" })} active={filters.type === "all"}>
          All products
        </FilterLink>
        <FilterLink href={buildProductsUrl(filters, { type: "otc" })} active={filters.type === "otc"}>
          Over the counter
        </FilterLink>
        <FilterLink href={buildProductsUrl(filters, { type: "rx" })} active={filters.type === "rx"}>
          Prescription only
        </FilterLink>
      </FilterGroup>

      {brands.length > 0 ? (
        <FilterGroup title="Brand">
          <FilterLink href={buildProductsUrl(filters, { brand: null })} active={!filters.brand}>
            All brands
          </FilterLink>
          {brands.map((brand) => (
            <FilterLink
              key={brand.id}
              href={buildProductsUrl(filters, { brand: brand.slug })}
              active={filters.brand === brand.slug}
            >
              {brand.name}
            </FilterLink>
          ))}
        </FilterGroup>
      ) : null}

      <FilterGroup title="Price (KES)">
        <form action="/products" method="get" className="space-y-2 px-3">
          {filters.q ? <input type="hidden" name="q" value={filters.q} /> : null}
          {filters.category ? <input type="hidden" name="category" value={filters.category} /> : null}
          {filters.brand ? <input type="hidden" name="brand" value={filters.brand} /> : null}
          {filters.type !== "all" ? <input type="hidden" name="type" value={filters.type} /> : null}
          {filters.sort !== "newest" ? <input type="hidden" name="sort" value={filters.sort} /> : null}

          <div className="flex items-center gap-2">
            <Input
              type="number"
              name="min"
              min={0}
              inputMode="numeric"
              placeholder="Min"
              aria-label="Minimum price"
              defaultValue={filters.min ?? ""}
              className="h-10"
            />
            <span className="text-muted-foreground">-</span>
            <Input
              type="number"
              name="max"
              min={0}
              inputMode="numeric"
              placeholder="Max"
              aria-label="Maximum price"
              defaultValue={filters.max ?? ""}
              className="h-10"
            />
          </div>
          <Button type="submit" variant="outline" size="sm" className="w-full rounded-full">
            Apply price
          </Button>
        </form>
      </FilterGroup>
    </div>
  );
}

import type { ProductFilters, SortOption, TypeFilter } from "@/lib/products/types";

export const PAGE_SIZE = 12;

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "name", label: "Name: A to Z" },
];

export type RawSearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function parseNumber(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

/** Keeps only letters, numbers, spaces and hyphens so search text can never break a database filter. */
export function sanitizeSearchText(input: string): string {
  return input
    .replace(/[^a-zA-Z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

export function parseFilters(raw: RawSearchParams): ProductFilters {
  const sortValue = first(raw.sort);
  const typeValue = first(raw.type);
  const pageNumber = Number.parseInt(first(raw.page), 10);

  const sort: SortOption = SORT_OPTIONS.some((option) => option.value === sortValue)
    ? (sortValue as SortOption)
    : "newest";
  const type: TypeFilter = typeValue === "otc" || typeValue === "rx" ? typeValue : "all";

  return {
    q: sanitizeSearchText(first(raw.q)),
    category: first(raw.category).trim() || null,
    brand: first(raw.brand).trim() || null,
    type,
    min: parseNumber(first(raw.min)),
    max: parseNumber(first(raw.max)),
    sort,
    page: Number.isFinite(pageNumber) && pageNumber > 0 ? pageNumber : 1,
  };
}

/**
 * Builds a /products link from the current filters plus changes.
 * Changing any filter sends the shopper back to page 1 unless a page is given.
 */
export function buildProductsUrl(
  filters: ProductFilters,
  overrides: Partial<ProductFilters> = {}
): string {
  const merged: ProductFilters = { ...filters, ...overrides };
  if (!("page" in overrides)) {
    merged.page = 1;
  }

  const params = new URLSearchParams();
  if (merged.q) params.set("q", merged.q);
  if (merged.category) params.set("category", merged.category);
  if (merged.brand) params.set("brand", merged.brand);
  if (merged.type !== "all") params.set("type", merged.type);
  if (merged.min !== null) params.set("min", String(merged.min));
  if (merged.max !== null) params.set("max", String(merged.max));
  if (merged.sort !== "newest") params.set("sort", merged.sort);
  if (merged.page > 1) params.set("page", String(merged.page));

  const query = params.toString();
  return query ? `/products?${query}` : "/products";
}

export function hasActiveFilters(filters: ProductFilters): boolean {
  return Boolean(
    filters.q ||
      filters.category ||
      filters.brand ||
      filters.type !== "all" ||
      filters.min !== null ||
      filters.max !== null
  );
}

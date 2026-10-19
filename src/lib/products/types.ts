export interface BrandSummary {
  id: string;
  name: string;
  slug: string;
}

export interface CategorySummary {
  id: string;
  name: string;
  slug: string;
}

export interface Product {
  id: string;
  sku: string;
  slug: string;
  name: string;
  genericName: string | null;
  description: string | null;
  packSize: string | null;
  strength: string | null;
  dosageForm: string | null;
  price: number;
  comparePrice: number | null;
  requiresPrescription: boolean;
  isChronicEligible: boolean;
  imageUrls: string[];
  brand: BrandSummary | null;
  category: CategorySummary | null;
}

export type SortOption = "newest" | "price-asc" | "price-desc" | "name";
export type TypeFilter = "all" | "otc" | "rx";

export interface ProductFilters {
  q: string;
  category: string | null;
  brand: string | null;
  type: TypeFilter;
  min: number | null;
  max: number | null;
  sort: SortOption;
  page: number;
}

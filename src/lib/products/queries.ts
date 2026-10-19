import { createPublicClient } from "@/lib/supabase/public";
import { PAGE_SIZE, sanitizeSearchText } from "@/lib/products/filters";
import type {
  BrandSummary,
  CategorySummary,
  Product,
  ProductFilters,
} from "@/lib/products/types";

const PRODUCT_COLUMNS =
  "id, sku, slug, name, generic_name, description, pack_size, strength, dosage_form, price_kes, compare_at_price_kes, requires_prescription, is_chronic_eligible, image_urls, brand:brands(id, name, slug), category:categories(id, name, slug)";

interface ProductRow {
  id: string;
  sku: string;
  slug: string;
  name: string;
  generic_name: string | null;
  description: string | null;
  pack_size: string | null;
  strength: string | null;
  dosage_form: string | null;
  price_kes: number | string;
  compare_at_price_kes: number | string | null;
  requires_prescription: boolean;
  is_chronic_eligible: boolean;
  image_urls: string[] | null;
  brand: BrandSummary | BrandSummary[] | null;
  category: CategorySummary | CategorySummary[] | null;
}

function firstOrNull<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    sku: row.sku,
    slug: row.slug,
    name: row.name,
    genericName: row.generic_name,
    description: row.description,
    packSize: row.pack_size,
    strength: row.strength,
    dosageForm: row.dosage_form,
    price: Number(row.price_kes),
    comparePrice: row.compare_at_price_kes === null ? null : Number(row.compare_at_price_kes),
    requiresPrescription: row.requires_prescription,
    isChronicEligible: row.is_chronic_eligible,
    imageUrls: row.image_urls ?? [],
    brand: firstOrNull(row.brand),
    category: firstOrNull(row.category),
  };
}

export async function getFilterOptions(): Promise<{
  categories: CategorySummary[];
  brands: BrandSummary[];
}> {
  const supabase = createPublicClient();

  const [categories, brands] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, slug")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase.from("brands").select("id, name, slug").eq("is_active", true).order("name"),
  ]);

  if (categories.error) throw new Error(categories.error.message);
  if (brands.error) throw new Error(brands.error.message);

  return {
    categories: (categories.data ?? []) as CategorySummary[],
    brands: (brands.data ?? []) as BrandSummary[],
  };
}

export async function getProducts(
  filters: ProductFilters,
  categories: CategorySummary[],
  brands: BrandSummary[]
): Promise<{ products: Product[]; total: number }> {
  const supabase = createPublicClient();

  let query = supabase
    .from("products")
    .select(PRODUCT_COLUMNS, { count: "exact" })
    .eq("is_active", true);

  if (filters.category) {
    const category = categories.find((item) => item.slug === filters.category);
    if (!category) return { products: [], total: 0 };
    query = query.eq("category_id", category.id);
  }

  if (filters.brand) {
    const brand = brands.find((item) => item.slug === filters.brand);
    if (!brand) return { products: [], total: 0 };
    query = query.eq("brand_id", brand.id);
  }

  if (filters.type === "rx") query = query.eq("requires_prescription", true);
  if (filters.type === "otc") query = query.eq("requires_prescription", false);
  if (filters.min !== null) query = query.gte("price_kes", filters.min);
  if (filters.max !== null) query = query.lte("price_kes", filters.max);

  const text = sanitizeSearchText(filters.q);
  if (text) {
    query = query.or(`name.ilike.%${text}%,generic_name.ilike.%${text}%`);
  }

  switch (filters.sort) {
    case "price-asc":
      query = query.order("price_kes", { ascending: true });
      break;
    case "price-desc":
      query = query.order("price_kes", { ascending: false });
      break;
    case "name":
      query = query.order("name", { ascending: true });
      break;
    default:
      query = query.order("created_at", { ascending: false });
  }
  query = query.order("id", { ascending: true });

  const from = (filters.page - 1) * PAGE_SIZE;
  query = query.range(from, from + PAGE_SIZE - 1);

  const { data, error, count } = await query;

  if (error) {
    // Asking for a page past the end of the results
    if (error.code === "PGRST103") return { products: [], total: 0 };
    throw new Error(error.message);
  }

  return {
    products: ((data ?? []) as unknown as ProductRow[]).map(mapProduct),
    total: count ?? 0,
  };
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapProduct(data as unknown as ProductRow);
}

export async function getRelatedProducts(
  categoryId: string,
  excludeProductId: string,
  limit = 4
): Promise<Product[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("is_active", true)
    .eq("category_id", categoryId)
    .neq("id", excludeProductId)
    .limit(limit);

  if (error) {
    console.error("Could not load related products:", error.message);
    return [];
  }
  return ((data ?? []) as unknown as ProductRow[]).map(mapProduct);
}

export interface BranchStock {
  id: string;
  name: string;
  town: string;
}

/** Branches that currently have this product in stock. Returns null if the lookup failed. */
export async function getProductAvailability(productId: string): Promise<BranchStock[] | null> {
  const supabase = createPublicClient();

  const [availability, branches] = await Promise.all([
    supabase
      .from("product_availability")
      .select("branch_id")
      .eq("product_id", productId)
      .eq("in_stock", true),
    supabase.from("branches").select("id, name, town").eq("is_active", true).order("name"),
  ]);

  if (availability.error || branches.error) {
    console.error(
      "Could not load stock availability:",
      availability.error?.message ?? branches.error?.message
    );
    return null;
  }

  const inStock = new Set(
    ((availability.data ?? []) as { branch_id: string }[]).map((row) => row.branch_id)
  );
  return ((branches.data ?? []) as BranchStock[]).filter((branch) => inStock.has(branch.id));
}

import Link from "next/link";
import {
  Apple,
  Baby,
  HeartPulse,
  Leaf,
  Pill,
  Smile,
  Sparkles,
  Stethoscope,
  Thermometer,
  Wind,
  type LucideIcon,
} from "lucide-react";
import { createPublicClient } from "@/lib/supabase/public";

interface Category {
  id: string;
  name: string;
  slug: string;
}

const ICONS: Record<string, LucideIcon> = {
  "prescription-medicines": Pill,
  "pain-relief": Thermometer,
  "vitamins-supplements": Leaf,
  "chronic-care": HeartPulse,
  skincare: Sparkles,
  "first-aid": Stethoscope,
  "baby-mum": Baby,
  "personal-care": Smile,
  "cold-flu-allergy": Wind,
  "digestive-health": Apple,
};

const FALLBACK_CATEGORIES: Category[] = [
  { id: "prescription-medicines", name: "Prescription Medicines", slug: "prescription-medicines" },
  { id: "pain-relief", name: "Pain Relief", slug: "pain-relief" },
  { id: "vitamins-supplements", name: "Vitamins & Supplements", slug: "vitamins-supplements" },
  { id: "chronic-care", name: "Chronic Care", slug: "chronic-care" },
  { id: "skincare", name: "Skincare", slug: "skincare" },
  { id: "first-aid", name: "First Aid & Antiseptics", slug: "first-aid" },
  { id: "baby-mum", name: "Baby & Mum", slug: "baby-mum" },
  { id: "personal-care", name: "Personal Care", slug: "personal-care" },
];

async function getCategories(): Promise<Category[]> {
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, slug")
      .is("parent_id", null)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("Could not load categories from Supabase:", error.message);
      return FALLBACK_CATEGORIES;
    }
    if (!data || data.length === 0) {
      return FALLBACK_CATEGORIES;
    }
    return data as Category[];
  } catch (err) {
    console.error("Could not load categories:", err instanceof Error ? err.message : err);
    return FALLBACK_CATEGORIES;
  }
}

export async function CategoryGrid() {
  const categories = await getCategories();

  return (
    <section aria-labelledby="categories-heading" className="mx-auto max-w-7xl px-4 pt-14">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 id="categories-heading" className="text-2xl font-extrabold text-brand-900 sm:text-3xl">
            Shop by category
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Find what you need for you and your family.
          </p>
        </div>
        <Link
          href="/products"
          className="shrink-0 text-sm font-semibold text-brand-600 hover:text-brand-700 hover:underline"
        >
          View all
        </Link>
      </div>

      <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 sm:gap-4">
        {categories.map((category) => {
          const Icon = ICONS[category.slug] ?? Pill;
          return (
            <li key={category.id}>
              <Link
                href={`/products?category=${category.slug}`}
                className="group flex h-full flex-col items-center gap-3 rounded-2xl border border-brand-100 bg-white p-5 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 transition group-hover:bg-brand-600 group-hover:text-white">
                  <Icon className="h-7 w-7" />
                </span>
                <span className="text-sm font-semibold text-brand-900">{category.name}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { FormAlert, FormField } from "@/components/auth/form-field";
import { InlineCreate } from "@/components/admin/inline-create";
import { ProductImages } from "@/components/admin/product-images";
import { selectClass, textareaClass } from "@/components/prescriptions/field-styles";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { slugify } from "@/lib/admin/slug";
import { createClient } from "@/lib/supabase/client";
import type { FieldErrors } from "@/lib/validators/auth";
import { cn } from "@/lib/utils";

interface Option {
  id: string;
  name: string;
}

interface FormValues {
  sku: string;
  slug: string;
  name: string;
  genericName: string;
  description: string;
  brandId: string;
  categoryId: string;
  dosageForm: string;
  strength: string;
  packSize: string;
  price: string;
  comparePrice: string;
  requiresPrescription: boolean;
  isChronicEligible: boolean;
  isActive: boolean;
  imageUrls: string[];
}

const EMPTY_VALUES: FormValues = {
  sku: "",
  slug: "",
  name: "",
  genericName: "",
  description: "",
  brandId: "",
  categoryId: "",
  dosageForm: "",
  strength: "",
  packSize: "",
  price: "",
  comparePrice: "",
  requiresPrescription: false,
  isChronicEligible: false,
  isActive: true,
  imageUrls: [],
};

interface ProductRow {
  id: string;
  sku: string;
  slug: string;
  name: string;
  generic_name: string | null;
  description: string | null;
  brand_id: string | null;
  category_id: string | null;
  dosage_form: string | null;
  strength: string | null;
  pack_size: string | null;
  price_kes: number | string;
  compare_at_price_kes: number | string | null;
  requires_prescription: boolean;
  is_chronic_eligible: boolean;
  is_active: boolean;
  image_urls: string[] | null;
}

function toFormValues(row: ProductRow): FormValues {
  return {
    sku: row.sku,
    slug: row.slug,
    name: row.name,
    genericName: row.generic_name ?? "",
    description: row.description ?? "",
    brandId: row.brand_id ?? "",
    categoryId: row.category_id ?? "",
    dosageForm: row.dosage_form ?? "",
    strength: row.strength ?? "",
    packSize: row.pack_size ?? "",
    price: String(Number(row.price_kes)),
    comparePrice: row.compare_at_price_kes === null ? "" : String(Number(row.compare_at_price_kes)),
    requiresPrescription: row.requires_prescription,
    isChronicEligible: row.is_chronic_eligible,
    isActive: row.is_active,
    imageUrls: row.image_urls ?? [],
  };
}

function validate(values: FormValues): FieldErrors {
  const errors: FieldErrors = {};

  if (!/^[A-Za-z0-9._-]{2,40}$/.test(values.sku.trim())) {
    errors.sku = "Use 2 to 40 letters, numbers, dots or dashes, with no spaces. Example: OTC-PANADOL-24";
  }
  if (values.name.trim().length < 2) {
    errors.name = "Enter the product name.";
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(values.slug.trim())) {
    errors.slug = "Use lowercase letters, numbers and single dashes only. Example: panadol-extra-24";
  }

  const price = Number(values.price);
  if (values.price.trim() === "" || !Number.isFinite(price) || price < 0 || price > 10_000_000) {
    errors.price = "Enter the selling price in KES, for example 320.";
  }

  if (values.comparePrice.trim() !== "") {
    const compare = Number(values.comparePrice);
    if (!Number.isFinite(compare) || compare < 0) {
      errors.comparePrice = "Enter the old price in KES, or leave it empty.";
    } else if (Number.isFinite(price) && compare < price) {
      errors.comparePrice = "The old price must be the same as or higher than the selling price.";
    }
  }

  if (values.description.length > 2000) {
    errors.description = "Keep the description under 2,000 characters.";
  }

  return errors;
}

function Toggle({
  checked,
  onChange,
  title,
  description,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  title: string;
  description: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-brand-200 bg-white p-3 text-sm hover:border-brand-400">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 shrink-0 accent-brand-600"
      />
      <span>
        <span className="block font-bold text-brand-900">{title}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </span>
    </label>
  );
}

interface InnerProps {
  mode: "create" | "edit";
  productId: string;
  initial: FormValues;
  brands: Option[];
  categories: Option[];
}

function ProductFormInner({ mode, productId, initial, brands, categories }: InnerProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [values, setValues] = useState<FormValues>(initial);
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function setField<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function refreshOptions() {
    void queryClient.invalidateQueries({ queryKey: ["admin-brands"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setFormError(null);

    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setFormError("Please fix the highlighted fields.");
      return;
    }

    const payload = {
      sku: values.sku.trim().toUpperCase(),
      slug: values.slug.trim(),
      name: values.name.trim(),
      generic_name: values.genericName.trim() || null,
      description: values.description.trim() || null,
      brand_id: values.brandId || null,
      category_id: values.categoryId || null,
      dosage_form: values.dosageForm.trim() || null,
      strength: values.strength.trim() || null,
      pack_size: values.packSize.trim() || null,
      price_kes: Number(values.price),
      compare_at_price_kes: values.comparePrice.trim() === "" ? null : Number(values.comparePrice),
      requires_prescription: values.requiresPrescription,
      is_chronic_eligible: values.isChronicEligible,
      is_active: values.isActive,
      image_urls: values.imageUrls,
    };

    setSaving(true);
    const supabase = createClient();

    const result =
      mode === "create"
        ? await supabase.from("products").insert({ id: productId, ...payload }).select("id")
        : await supabase.from("products").update(payload).eq("id", productId).select("id");

    if (result.error) {
      setFormError(
        result.error.code === "23505"
          ? "Another product already uses this product code or web address. Please change it."
          : `We could not save the product. ${result.error.message}`
      );
      setSaving(false);
      return;
    }
    if (!result.data || result.data.length === 0) {
      setFormError("The product was not saved. Your account may not have permission to change products.");
      setSaving(false);
      return;
    }

    void queryClient.invalidateQueries({ queryKey: ["admin-products"] });
    void queryClient.invalidateQueries({ queryKey: ["inventory-products"] });

    if (mode === "create") {
      toast.success("Product created. It has no stock yet.", {
        action: { label: "Add stock", onClick: () => router.push("/admin/inventory") },
      });
    } else {
      toast.success("Product saved.");
    }
    router.push("/admin/products");
  }

  return (
    <form onSubmit={handleSave} noValidate>
      <Link
        href="/admin/products"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        All products
      </Link>

      <h1 className="mt-4 text-2xl font-extrabold text-brand-900 sm:text-3xl">
        {mode === "create" ? "Add a product" : "Edit product"}
      </h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <div className="space-y-5">
          <section className="space-y-4 rounded-2xl border border-brand-100 bg-white p-5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-brand-800">Basics</h2>

            <FormField id="name" label="Product name" error={errors.name}>
              <Input
                id="name"
                value={values.name}
                onChange={(event) => {
                  const name = event.target.value;
                  setValues((current) => ({
                    ...current,
                    name,
                    slug: slugTouched ? current.slug : slugify(name),
                  }));
                }}
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? "name-error" : undefined}
                className="h-11"
              />
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                id="sku"
                label="Product code (SKU)"
                error={errors.sku}
                hint="Your own unique code for this item."
              >
                <Input
                  id="sku"
                  value={values.sku}
                  onChange={(event) => setField("sku", event.target.value)}
                  aria-invalid={Boolean(errors.sku)}
                  aria-describedby={errors.sku ? "sku-error" : "sku-hint"}
                  className="h-11 uppercase"
                />
              </FormField>

              <FormField
                id="slug"
                label="Web address ending"
                error={errors.slug}
                hint="Appears in the link to the product page."
              >
                <Input
                  id="slug"
                  value={values.slug}
                  onChange={(event) => {
                    setSlugTouched(true);
                    setField("slug", event.target.value.toLowerCase());
                  }}
                  aria-invalid={Boolean(errors.slug)}
                  aria-describedby={errors.slug ? "slug-error" : "slug-hint"}
                  className="h-11"
                />
              </FormField>
            </div>

            <FormField id="genericName" label="Active ingredient or generic name (optional)">
              <Input
                id="genericName"
                value={values.genericName}
                onChange={(event) => setField("genericName", event.target.value)}
                className="h-11"
              />
            </FormField>

            <FormField id="description" label="Description (optional)" error={errors.description}>
              <textarea
                id="description"
                value={values.description}
                onChange={(event) => setField("description", event.target.value)}
                maxLength={2000}
                className={cn(textareaClass, "min-h-32")}
              />
            </FormField>
          </section>

          <section className="space-y-4 rounded-2xl border border-brand-100 bg-white p-5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-brand-800">Price</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="price" label="Selling price (KES)" error={errors.price}>
                <Input
                  id="price"
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  value={values.price}
                  onChange={(event) => setField("price", event.target.value)}
                  aria-invalid={Boolean(errors.price)}
                  aria-describedby={errors.price ? "price-error" : undefined}
                  className="h-11"
                />
              </FormField>
              <FormField
                id="comparePrice"
                label="Old price (optional)"
                error={errors.comparePrice}
                hint="Shows a strike-through and a % off badge."
              >
                <Input
                  id="comparePrice"
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  value={values.comparePrice}
                  onChange={(event) => setField("comparePrice", event.target.value)}
                  aria-invalid={Boolean(errors.comparePrice)}
                  aria-describedby={errors.comparePrice ? "comparePrice-error" : "comparePrice-hint"}
                  className="h-11"
                />
              </FormField>
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-brand-100 bg-white p-5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-brand-800">Details</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="brandId" label="Brand (optional)">
                <select
                  id="brandId"
                  value={values.brandId}
                  onChange={(event) => setField("brandId", event.target.value)}
                  className={selectClass}
                >
                  <option value="">No brand</option>
                  {brands.map((brand) => (
                    <option key={brand.id} value={brand.id}>
                      {brand.name}
                    </option>
                  ))}
                </select>
                <InlineCreate
                  table="brands"
                  label="Brand"
                  onCreated={(id) => {
                    refreshOptions();
                    setField("brandId", id);
                  }}
                />
              </FormField>

              <FormField id="categoryId" label="Category">
                <select
                  id="categoryId"
                  value={values.categoryId}
                  onChange={(event) => setField("categoryId", event.target.value)}
                  className={selectClass}
                >
                  <option value="">No category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <InlineCreate
                  table="categories"
                  label="Category"
                  onCreated={(id) => {
                    refreshOptions();
                    setField("categoryId", id);
                  }}
                />
              </FormField>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField id="dosageForm" label="Form (optional)">
                <Input
                  id="dosageForm"
                  value={values.dosageForm}
                  onChange={(event) => setField("dosageForm", event.target.value)}
                  placeholder="Tablet, Syrup..."
                  className="h-11"
                />
              </FormField>
              <FormField id="strength" label="Strength (optional)">
                <Input
                  id="strength"
                  value={values.strength}
                  onChange={(event) => setField("strength", event.target.value)}
                  placeholder="500mg"
                  className="h-11"
                />
              </FormField>
              <FormField id="packSize" label="Pack size (optional)">
                <Input
                  id="packSize"
                  value={values.packSize}
                  onChange={(event) => setField("packSize", event.target.value)}
                  placeholder="24 tablets"
                  className="h-11"
                />
              </FormField>
            </div>
          </section>
        </div>

        <div className="space-y-5">
          <section className="rounded-2xl border border-brand-100 bg-white p-5">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-brand-800">Photos</h2>
            <ProductImages
              productId={productId}
              imageUrls={values.imageUrls}
              onChange={(urls) => setField("imageUrls", urls)}
            />
          </section>

          <section className="space-y-3 rounded-2xl border border-brand-100 bg-white p-5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-brand-800">Rules</h2>
            <Toggle
              checked={values.requiresPrescription}
              onChange={(value) => setField("requiresPrescription", value)}
              title="Prescription required"
              description="Customers must attach an approved prescription to buy it."
            />
            <Toggle
              checked={values.isChronicEligible}
              onChange={(value) => setField("isChronicEligible", value)}
              title="Refill eligible"
              description="Can be set up as a regular refill for long-term conditions."
            />
            <Toggle
              checked={values.isActive}
              onChange={(value) => setField("isActive", value)}
              title="Visible in the shop"
              description="Untick to hide it without deleting it."
            />
          </section>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {formError ? <FormAlert message={formError} /> : null}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" size="lg" disabled={saving} className="rounded-full px-8">
            {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            {saving ? "Saving..." : mode === "create" ? "Create product" : "Save changes"}
          </Button>
          <Link
            href="/admin/products"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "rounded-full px-6")}
          >
            Cancel
          </Link>
        </div>
      </div>
    </form>
  );
}

export function ProductEditor({ productId }: { productId?: string }) {
  const [newProductId] = useState(() => crypto.randomUUID());
  const isEdit = Boolean(productId);

  const brandsQuery = useQuery({
    queryKey: ["admin-brands"],
    queryFn: async (): Promise<Option[]> => {
      const { data, error } = await createClient().from("brands").select("id, name").order("name");
      if (error) throw new Error(error.message);
      return (data ?? []) as Option[];
    },
  });

  const categoriesQuery = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async (): Promise<Option[]> => {
      const { data, error } = await createClient()
        .from("categories")
        .select("id, name")
        .order("sort_order")
        .order("name");
      if (error) throw new Error(error.message);
      return (data ?? []) as Option[];
    },
  });

  const productQuery = useQuery({
    queryKey: ["admin-product", productId],
    enabled: isEdit,
    queryFn: async (): Promise<ProductRow | null> => {
      const { data, error } = await createClient()
        .from("products")
        .select(
          "id, sku, slug, name, generic_name, description, brand_id, category_id, dosage_form, strength, pack_size, price_kes, compare_at_price_kes, requires_prescription, is_chronic_eligible, is_active, image_urls"
        )
        .eq("id", productId ?? "")
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data as ProductRow | null) ?? null;
    },
  });

  if (brandsQuery.isLoading || categoriesQuery.isLoading || (isEdit && productQuery.isLoading)) {
    return <Skeleton className="h-96 w-full rounded-2xl" />;
  }

  if (brandsQuery.isError || categoriesQuery.isError || productQuery.isError) {
    return (
      <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        We could not load the form. Please refresh the page.
      </div>
    );
  }

  if (isEdit && !productQuery.data) {
    return (
      <div className="rounded-3xl border border-brand-100 bg-white p-10 text-center">
        <h2 className="text-xl font-extrabold text-brand-900">Product not found</h2>
        <Link href="/admin/products" className={cn(buttonVariants({ variant: "outline" }), "mt-6 rounded-full")}>
          Back to products
        </Link>
      </div>
    );
  }

  const existing = productQuery.data;

  return (
    <ProductFormInner
      key={existing?.id ?? newProductId}
      mode={isEdit ? "edit" : "create"}
      productId={existing?.id ?? newProductId}
      initial={existing ? toFormValues(existing) : EMPTY_VALUES}
      brands={brandsQuery.data ?? []}
      categories={categoriesQuery.data ?? []}
    />
  );
}

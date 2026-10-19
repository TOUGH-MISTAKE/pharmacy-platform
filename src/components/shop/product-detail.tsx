import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, Repeat, ShieldAlert } from "lucide-react";
import { AddToCartButton } from "@/components/cart/add-to-cart-button";
import { ProductCard } from "@/components/shop/product-card";
import { ProductImage } from "@/components/shop/product-image";
import { formatKes } from "@/lib/format";
import {
  getProductAvailability,
  getProductBySlug,
  getRelatedProducts,
} from "@/lib/products/queries";

export async function ProductDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let product: Awaited<ReturnType<typeof getProductBySlug>>;
  try {
    product = await getProductBySlug(slug);
  } catch (error) {
    console.error("Could not load product:", error instanceof Error ? error.message : error);
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
        <h1 className="text-xl font-extrabold text-red-800">We could not load this product</h1>
        <p className="mt-2 text-sm text-red-700">Please refresh the page and try again.</p>
      </div>
    );
  }

  if (!product) {
    notFound();
  }

  const [availability, related] = await Promise.all([
    getProductAvailability(product.id),
    product.category ? getRelatedProducts(product.category.id, product.id) : Promise.resolve([]),
  ]);

  const compare = product.comparePrice;
  const hasDiscount = compare !== null && compare > product.price;
  const percentOff = hasDiscount ? Math.round((1 - product.price / compare) * 100) : 0;

  const specs: { label: string; value: string }[] = [];
  if (product.genericName) specs.push({ label: "Active ingredient", value: product.genericName });
  if (product.strength) specs.push({ label: "Strength", value: product.strength });
  if (product.dosageForm) specs.push({ label: "Form", value: product.dosageForm });
  if (product.packSize) specs.push({ label: "Pack size", value: product.packSize });
  specs.push({ label: "Product code", value: product.sku });

  return (
    <div>
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/" className="hover:text-brand-600 hover:underline">
              Home
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link href="/products" className="hover:text-brand-600 hover:underline">
              Shop
            </Link>
          </li>
          {product.category ? (
            <>
              <li aria-hidden>/</li>
              <li>
                <Link
                  href={`/products?category=${product.category.slug}`}
                  className="hover:text-brand-600 hover:underline"
                >
                  {product.category.name}
                </Link>
              </li>
            </>
          ) : null}
        </ol>
      </nav>

      <div className="mt-6 grid gap-8 md:grid-cols-2 lg:gap-12">
        <div className="overflow-hidden rounded-3xl border border-brand-100 bg-white">
          <ProductImage
            src={product.imageUrls[0] ?? null}
            alt={product.name}
            className="aspect-square w-full"
          />
        </div>

        <div>
          {product.brand ? (
            <Link
              href={`/products?brand=${product.brand.slug}`}
              className="text-sm font-bold uppercase tracking-wide text-brand-600 hover:underline"
            >
              {product.brand.name}
            </Link>
          ) : null}
          <h1 className="mt-1 text-3xl font-extrabold leading-tight text-brand-900">
            {product.name}
          </h1>
          {product.genericName ? (
            <p className="mt-1 text-sm text-muted-foreground">{product.genericName}</p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {product.requiresPrescription ? (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
                Prescription required
              </span>
            ) : (
              <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">
                Over the counter
              </span>
            )}
            {product.isChronicEligible ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">
                <Repeat className="h-3 w-3" />
                Refill eligible
              </span>
            ) : null}
          </div>

          <p className="mt-5 flex items-baseline gap-3">
            <span className="text-3xl font-extrabold text-brand-900">
              {formatKes(product.price)}
            </span>
            {hasDiscount ? (
              <>
                <span className="text-base text-muted-foreground line-through">
                  {formatKes(compare)}
                </span>
                <span className="rounded-full bg-brand-600 px-2.5 py-0.5 text-xs font-bold text-white">
                  {percentOff}% off
                </span>
              </>
            ) : null}
          </p>

          {product.requiresPrescription ? (
            <div className="mt-5 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
              <p>
                This is a prescription-only medicine. You will attach a valid prescription at
                checkout, and a pharmacist will verify it before we dispense.
              </p>
            </div>
          ) : null}

          <AddToCartButton product={product} showQuantity className="mt-6" />

          <div className="mt-6 rounded-2xl border border-brand-100 bg-white p-4">
            <h2 className="flex items-center gap-2 text-sm font-bold text-brand-900">
              <MapPin className="h-4 w-4 text-brand-600" />
              Availability
            </h2>
            {availability === null ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Stock information is not available right now.
              </p>
            ) : availability.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Currently out of stock at all branches.
              </p>
            ) : (
              <>
                <p className="mt-2 text-sm text-muted-foreground">In stock at:</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {availability.map((branch) => (
                    <li
                      key={branch.id}
                      className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-800"
                    >
                      {branch.name}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="mt-12 grid gap-8 lg:grid-cols-2">
        {product.description ? (
          <section>
            <h2 className="text-lg font-extrabold text-brand-900">About this product</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {product.description}
            </p>
          </section>
        ) : null}

        <section>
          <h2 className="text-lg font-extrabold text-brand-900">Product details</h2>
          <dl className="mt-2 divide-y divide-brand-100 rounded-2xl border border-brand-100 bg-white">
            {specs.map((spec) => (
              <div key={spec.label} className="flex justify-between gap-4 px-4 py-3 text-sm">
                <dt className="text-muted-foreground">{spec.label}</dt>
                <dd className="text-right font-semibold text-brand-900">{spec.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      {related.length > 0 ? (
        <section className="mt-14" aria-labelledby="related-heading">
          <h2 id="related-heading" className="text-xl font-extrabold text-brand-900">
            You may also like
          </h2>
          <ul className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {related.map((item) => (
              <li key={item.id}>
                <ProductCard product={item} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function ProductNotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="text-3xl font-extrabold text-brand-900">Product not found</h1>
      <p className="mt-3 text-muted-foreground">
        This product may have been removed or the link may be wrong.
      </p>
      <Link
        href="/products"
        className={cn(buttonVariants({ size: "lg" }), "mt-8 rounded-full px-6")}
      >
        Browse all products
      </Link>
    </div>
  );
}

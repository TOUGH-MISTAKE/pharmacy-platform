import { Pill } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProductImageProps {
  src: string | null;
  alt: string;
  className?: string;
}

/** Shows the product photo, or a neutral placeholder when there is no photo yet. */
export function ProductImage({ src, alt, className }: ProductImageProps) {
  if (!src) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={cn("flex items-center justify-center bg-brand-50 text-brand-300", className)}
      >
        <Pill className="h-1/3 w-1/3" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} loading="lazy" className={cn("bg-white object-contain", className)} />
  );
}

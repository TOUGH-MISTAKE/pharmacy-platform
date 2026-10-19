import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { siteConfig } from "@/lib/site";

interface LogoProps {
  className?: string;
}

export function Logo({ className }: LogoProps) {
  return (
    <Link
      href="/"
      aria-label={`${siteConfig.name} home`}
      className={cn("flex shrink-0 items-center gap-2.5", className)}
    >
      <Image
        src="/logo-mark.png"
        alt=""
        width={266}
        height={304}
        priority
        className="h-11 w-auto"
      />
      <span className="flex flex-col leading-none">
        <span className="text-xl font-extrabold tracking-[0.12em] text-brand-600">
          SIMILIFE
        </span>
        <span className="mt-1 text-[0.62rem] font-semibold tracking-[0.5em] text-brand-600">
          PHARMACY
        </span>
      </span>
    </Link>
  );
}

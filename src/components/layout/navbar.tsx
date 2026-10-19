import Link from "next/link";
import { MapPin, Phone, Search, ShoppingCart } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { MobileMenu } from "@/components/layout/mobile-menu";
import { UserMenu } from "@/components/layout/user-menu";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { mainNavLinks, siteConfig } from "@/lib/site";

function SearchForm({ className }: { className?: string }) {
  return (
    <form
      action="/products"
      method="get"
      role="search"
      className={cn("relative w-full", className)}
    >
      <Input
        type="search"
        name="q"
        placeholder="Search medicines, brands or health needs"
        aria-label="Search products"
        className="h-11 rounded-full border-brand-200 bg-white pl-4 pr-12 shadow-none"
      />
      <Button
        type="submit"
        size="icon"
        aria-label="Search"
        className="absolute right-1 top-1/2 h-9 w-9 -translate-y-1/2 rounded-full"
      >
        <Search className="h-4 w-4" />
      </Button>
    </form>
  );
}

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-brand-100 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="bg-brand-700 text-brand-50">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-1.5 text-xs">
          <p className="truncate">
            Genuine medicines &middot; Pharmacist-verified prescriptions &middot; Pay with M-Pesa or card
          </p>
          {siteConfig.phone ? (
            <a
              href={`tel:${siteConfig.phone}`}
              className="hidden shrink-0 items-center gap-1.5 font-medium hover:underline sm:inline-flex"
            >
              <Phone className="h-3 w-3" />
              {siteConfig.phone}
            </a>
          ) : null}
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3 md:gap-6">
        <MobileMenu />
        <Logo />

        <div className="hidden flex-1 md:block">
          <SearchForm className="mx-auto max-w-xl" />
        </div>

        <nav className="ml-auto flex items-center gap-1 sm:gap-2" aria-label="Account and cart">
          <Link
            href="/branches"
            className={cn(buttonVariants({ variant: "ghost" }), "hidden lg:inline-flex")}
          >
            <MapPin className="h-4 w-4" />
            Find a branch
          </Link>
          <Link
            href="/cart"
            aria-label="Shopping cart"
            className={buttonVariants({ variant: "ghost", size: "icon" })}
          >
            <ShoppingCart className="h-5 w-5" />
          </Link>
          <UserMenu />
        </nav>
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-3 md:hidden">
        <SearchForm />
      </div>

      <nav aria-label="Shop categories" className="hidden border-t border-brand-100 md:block">
        <ul className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4">
          {mainNavLinks.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="inline-block whitespace-nowrap px-3 py-2.5 text-sm font-medium text-brand-800 transition-colors hover:text-brand-500"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}

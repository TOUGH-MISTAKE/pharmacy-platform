"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Menu, MapPin, ShoppingCart, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { mainNavLinks, siteConfig } from "@/lib/site";

const quickLinks = [
  { label: "Sign in or create account", href: "/login", icon: User },
  { label: "My cart", href: "/cart", icon: ShoppingCart },
  { label: "Find a branch", href: "/branches", icon: MapPin },
];

export function MobileMenu() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="md:hidden"
        aria-label="Open menu"
        onClick={() => setOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[85%] max-w-sm gap-0 p-0">
          <SheetHeader className="border-b border-brand-100 bg-brand-50 p-4 text-left">
            <SheetTitle className="text-brand-700">{siteConfig.name}</SheetTitle>
            <SheetDescription>{siteConfig.tagline}</SheetDescription>
          </SheetHeader>

          <nav aria-label="Mobile menu" className="flex flex-col overflow-y-auto p-2">
            {quickLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold text-brand-800 hover:bg-brand-50"
              >
                <item.icon className="h-4 w-4 text-brand-600" />
                {item.label}
              </Link>
            ))}

            <div className="my-2 border-t border-brand-100" />

            {mainNavLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex items-center justify-between rounded-lg px-3 py-3 text-sm font-medium text-foreground hover:bg-brand-50"
              >
                {item.label}
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}

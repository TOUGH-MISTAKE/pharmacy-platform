"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useProfile } from "@/lib/hooks/use-profile";
import { cn } from "@/lib/utils";

interface Tab {
  href: string;
  label: string;
  roles: string[];
  exact?: boolean;
}

const TABS: Tab[] = [
  { href: "/admin", label: "Overview", roles: ["pharmacist", "branch_manager", "admin"], exact: true },
  { href: "/admin/orders", label: "Orders", roles: ["pharmacist", "branch_manager", "admin"] },
  { href: "/pharmacist", label: "Prescriptions", roles: ["pharmacist", "admin"] },
  { href: "/admin/inventory", label: "Inventory", roles: ["pharmacist", "branch_manager", "admin"] },
  { href: "/admin/products", label: "Products", roles: ["admin"] },
  { href: "/admin/discounts", label: "Discounts", roles: ["admin"] },
];

export function AdminNav() {
  const pathname = usePathname();
  const { profile } = useProfile();
  const role = profile?.role ?? "";

  return (
    <nav aria-label="Staff sections" className="mb-8 flex gap-1 overflow-x-auto border-b border-brand-100">
      {TABS.filter((tab) => tab.roles.includes(role)).map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition-colors",
              active
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-muted-foreground hover:text-brand-600"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

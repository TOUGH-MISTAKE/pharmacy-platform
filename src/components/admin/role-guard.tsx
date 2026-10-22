"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile, type UserRole } from "@/lib/hooks/use-profile";
import { cn } from "@/lib/utils";

interface RoleGuardProps {
  allow: UserRole[];
  /** Short name of the area, used in the "no access" message. */
  area?: string;
  children: React.ReactNode;
}

/** Shows its content only to the listed roles. Database security rules also enforce this. */
export function RoleGuard({ allow, area = "this area", children }: RoleGuardProps) {
  const { loading, userId, profile } = useProfile();

  if (loading) {
    return <Skeleton className="h-64 w-full rounded-2xl" />;
  }

  if (!userId) {
    return (
      <div className="rounded-3xl border border-brand-100 bg-white p-10 text-center">
        <h2 className="text-xl font-extrabold text-brand-900">Please sign in</h2>
        <Link
          href="/login?next=/admin"
          className={cn(buttonVariants({ size: "lg" }), "mt-6 rounded-full px-6")}
        >
          Sign in
        </Link>
      </div>
    );
  }

  if (!profile || !allow.includes(profile.role)) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-10 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-800">
          <ShieldAlert className="h-7 w-7" />
        </span>
        <h2 className="mt-4 text-xl font-extrabold text-amber-900">Staff only</h2>
        <p className="mt-2 text-sm text-amber-900">
          Your account does not have access to {area}.
        </p>
        <Link href="/" className={cn(buttonVariants({ variant: "outline" }), "mt-6 rounded-full")}>
          Back to the shop
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}

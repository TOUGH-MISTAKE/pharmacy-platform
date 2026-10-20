import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { MyPrescriptions } from "@/components/prescriptions/my-prescriptions";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "My prescriptions" };

export default function MyPrescriptionsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-brand-900 sm:text-3xl">My prescriptions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track the review of every prescription you have uploaded.
          </p>
        </div>
        <Link href="/prescriptions" className={cn(buttonVariants(), "rounded-full")}>
          <Plus className="h-4 w-4" />
          New prescription
        </Link>
      </div>

      <div className="mt-6">
        <MyPrescriptions />
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { PharmacistAccessGuard } from "@/components/pharmacist/access-guard";
import { PharmacistQueue } from "@/components/pharmacist/queue";

export const metadata: Metadata = { title: "Verification queue" };

export default function PharmacistPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <PharmacistAccessGuard>
        <PharmacistQueue />
      </PharmacistAccessGuard>
    </div>
  );
}

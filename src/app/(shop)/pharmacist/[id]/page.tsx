import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PharmacistAccessGuard } from "@/components/pharmacist/access-guard";
import { ReviewPanel } from "@/components/pharmacist/review-panel";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Review prescription" };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function ReviewLoader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) {
    notFound();
  }
  return (
    <PharmacistAccessGuard>
      <ReviewPanel prescriptionId={id} />
    </PharmacistAccessGuard>
  );
}

export default function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
        <ReviewLoader params={params} />
      </Suspense>
    </div>
  );
}

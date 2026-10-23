import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { RoleGuard } from "@/components/admin/role-guard";
import { ProductEditor } from "@/components/admin/product-form";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Edit product" };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function EditLoader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) {
    notFound();
  }
  return (
    <RoleGuard allow={["admin"]} area="product management">
      <ProductEditor productId={id} />
    </RoleGuard>
  );
}

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
      <EditLoader params={params} />
    </Suspense>
  );
}

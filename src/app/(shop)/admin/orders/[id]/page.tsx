import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { OrderManage } from "@/components/admin/order-manage";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Manage order" };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function ManageLoader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) {
    notFound();
  }
  return <OrderManage orderId={id} />;
}

export default function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
      <ManageLoader params={params} />
    </Suspense>
  );
}

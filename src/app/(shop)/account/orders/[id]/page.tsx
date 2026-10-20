import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { OrderDetail } from "@/components/orders/order-detail";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Order details" };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function OrderLoader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) {
    notFound();
  }
  return <OrderDetail orderId={id} />;
}

export default function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
        <OrderLoader params={params} />
      </Suspense>
    </div>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { OrdersBoard } from "@/components/admin/orders-board";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Orders board" };

export default function AdminOrdersPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
      <OrdersBoard />
    </Suspense>
  );
}

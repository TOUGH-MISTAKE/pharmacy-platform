import type { Metadata } from "next";
import { OrdersList } from "@/components/orders/orders-list";

export const metadata: Metadata = { title: "My orders" };

export default function OrdersPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-extrabold text-brand-900 sm:text-3xl">My orders</h1>
      <p className="mt-1 text-sm text-muted-foreground">Track every order you have placed.</p>
      <div className="mt-6">
        <OrdersList />
      </div>
    </div>
  );
}

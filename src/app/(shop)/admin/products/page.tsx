import type { Metadata } from "next";
import { RoleGuard } from "@/components/admin/role-guard";
import { ProductList } from "@/components/admin/product-list";

export const metadata: Metadata = { title: "Products" };

export default function AdminProductsPage() {
  return (
    <RoleGuard allow={["admin"]} area="product management">
      <ProductList />
    </RoleGuard>
  );
}

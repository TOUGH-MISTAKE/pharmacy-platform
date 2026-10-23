import type { Metadata } from "next";
import { RoleGuard } from "@/components/admin/role-guard";
import { ProductEditor } from "@/components/admin/product-form";

export const metadata: Metadata = { title: "Add a product" };

export default function NewProductPage() {
  return (
    <RoleGuard allow={["admin"]} area="product management">
      <ProductEditor />
    </RoleGuard>
  );
}

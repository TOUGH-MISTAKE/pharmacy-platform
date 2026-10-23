import type { Metadata } from "next";
import { RoleGuard } from "@/components/admin/role-guard";
import { DiscountManager } from "@/components/admin/discount-manager";

export const metadata: Metadata = { title: "Discount codes" };

export default function AdminDiscountsPage() {
  return (
    <RoleGuard allow={["admin"]} area="discount management">
      <DiscountManager />
    </RoleGuard>
  );
}

import { AdminNav } from "@/components/admin/admin-nav";
import { RoleGuard } from "@/components/admin/role-guard";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <RoleGuard allow={["pharmacist", "branch_manager", "admin"]} area="the staff area">
        <AdminNav />
        {children}
      </RoleGuard>
    </div>
  );
}

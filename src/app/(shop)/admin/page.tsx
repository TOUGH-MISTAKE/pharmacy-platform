import type { Metadata } from "next";
import { AdminDashboard } from "@/components/admin/dashboard";

export const metadata: Metadata = { title: "Staff overview" };

export default function AdminPage() {
  return <AdminDashboard />;
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { ChevronRight, FileText, RefreshCw } from "lucide-react";
import { StatusBadge } from "@/components/prescriptions/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { one, type PrescriptionStatus } from "@/lib/prescriptions/types";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type StatusFilter = PrescriptionStatus | "all";

const TABS: { value: StatusFilter; label: string }[] = [
  { value: "pending", label: "Awaiting review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "dispensed", label: "Dispensed" },
  { value: "all", label: "All" },
];

interface Patient {
  full_name: string;
  phone: string | null;
  email: string | null;
}

interface QueueRow {
  id: string;
  status: PrescriptionStatus;
  created_at: string;
  doctor_name: string | null;
  facility_name: string | null;
  file_paths: string[];
  patient: Patient | Patient[] | null;
  orders: { id: string; order_number: string; status: string }[] | null;
}

export function PharmacistQueue() {
  const [filter, setFilter] = useState<StatusFilter>("pending");

  const query = useQuery({
    queryKey: ["pharmacist-queue", filter],
    refetchInterval: 30_000,
    queryFn: async (): Promise<QueueRow[]> => {
      let request = createClient()
        .from("prescriptions")
        .select(
          "id, status, created_at, doctor_name, facility_name, file_paths, patient:profiles!patient_id(full_name, phone, email), orders(id, order_number, status)"
        );
      if (filter !== "all") {
        request = request.eq("status", filter);
      }
      const { data, error } = await request
        .order("created_at", { ascending: filter === "pending" })
        .limit(100);
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as QueueRow[];
    },
  });

  const rows = query.data ?? [];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-brand-900 sm:text-3xl">
            Prescription verification
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Oldest requests are shown first. The list refreshes automatically every 30 seconds.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void query.refetch()}
          disabled={query.isFetching}
          className="rounded-full"
        >
          <RefreshCw className={cn("h-4 w-4", query.isFetching && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <div role="tablist" aria-label="Filter by status" className="mt-6 flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={filter === tab.value}
            onClick={() => setFilter(tab.value)}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-semibold transition",
              filter === tab.value
                ? "border-brand-600 bg-brand-600 text-white"
                : "border-brand-200 bg-white text-brand-800 hover:bg-brand-50"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {query.isLoading ? (
          <div className="space-y-3" aria-hidden>
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
          </div>
        ) : query.isError ? (
          <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
            We could not load the queue. {query.error instanceof Error ? query.error.message : ""}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-3xl border border-brand-100 bg-white p-10 text-center">
            <h2 className="text-lg font-extrabold text-brand-900">Nothing here</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {filter === "pending"
                ? "There are no prescriptions waiting for review."
                : "No prescriptions match this filter."}
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {rows.map((row) => {
              const patient = one(row.patient);
              const orders = row.orders ?? [];
              const details = [row.doctor_name, row.facility_name].filter(Boolean).join(" at ");

              return (
                <li key={row.id}>
                  <Link
                    href={`/pharmacist/${row.id}`}
                    className="flex items-center gap-4 rounded-2xl border border-brand-100 bg-white p-4 transition hover:border-brand-300 hover:shadow-md"
                  >
                    <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 sm:flex">
                      <FileText className="h-6 w-6" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-brand-900">
                        {patient?.full_name || patient?.email || "Unknown patient"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[patient?.phone ? `+${patient.phone}` : null, details || null]
                          .filter(Boolean)
                          .join(" - ") || "No extra details"}
                      </p>
                      <p
                        className="mt-1 text-xs text-muted-foreground"
                        title={format(new Date(row.created_at), "d MMM yyyy, h:mm a")}
                      >
                        {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })} -{" "}
                        {row.file_paths.length} {row.file_paths.length === 1 ? "file" : "files"}
                        {orders.length > 0
                          ? ` - ${orders.length} linked ${orders.length === 1 ? "order" : "orders"}`
                          : ""}
                      </p>
                    </div>

                    <StatusBadge status={row.status} />
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CircleAlert, FilePlus2, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { FileViewer } from "@/components/prescriptions/file-viewer";
import { StatusBadge } from "@/components/prescriptions/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthUser } from "@/lib/hooks/use-auth-user";
import { one, type PrescriptionStatus } from "@/lib/prescriptions/types";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface PrescriptionRow {
  id: string;
  status: PrescriptionStatus;
  created_at: string;
  doctor_name: string | null;
  facility_name: string | null;
  prescription_date: string | null;
  file_paths: string[];
  rejection_reason: string | null;
  expires_at: string | null;
  branch: { name: string } | { name: string }[] | null;
}

export function MyPrescriptions() {
  const queryClient = useQueryClient();
  const { loading: authLoading, userId } = useAuthUser();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ["my-prescriptions", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<PrescriptionRow[]> => {
      if (!userId) return [];
      const { data, error } = await createClient()
        .from("prescriptions")
        .select(
          "id, status, created_at, doctor_name, facility_name, prescription_date, file_paths, rejection_reason, expires_at, branch:branches(name)"
        )
        .eq("patient_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as PrescriptionRow[];
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await createClient()
        .from("prescriptions")
        .update({ status: "cancelled" })
        .eq("id", id)
        .eq("status", "pending")
        .select("id");
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) {
        throw new Error("This prescription has already been reviewed, so it cannot be cancelled.");
      }
    },
    onSuccess: () => {
      toast.success("Prescription request cancelled.");
      setConfirmingId(null);
      void queryClient.invalidateQueries({ queryKey: ["my-prescriptions"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
      setConfirmingId(null);
      void queryClient.invalidateQueries({ queryKey: ["my-prescriptions"] });
    },
  });

  if (authLoading || listQuery.isLoading) {
    return (
      <div className="space-y-4" aria-hidden>
        <Skeleton className="h-52 w-full rounded-2xl" />
        <Skeleton className="h-52 w-full rounded-2xl" />
      </div>
    );
  }

  if (listQuery.isError) {
    return (
      <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        We could not load your prescriptions. Please refresh the page.
      </div>
    );
  }

  const prescriptions = listQuery.data ?? [];

  if (prescriptions.length === 0) {
    return (
      <div className="rounded-3xl border border-brand-100 bg-white p-10 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <FilePlus2 className="h-7 w-7" />
        </span>
        <h2 className="mt-4 text-xl font-extrabold text-brand-900">No prescriptions yet</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Upload a prescription and a pharmacist will review it.
        </p>
        <Link
          href="/prescriptions"
          className={cn(buttonVariants({ size: "lg" }), "mt-6 rounded-full px-6")}
        >
          Upload a prescription
        </Link>
      </div>
    );
  }

  return (
    <ul className="space-y-4">
      {prescriptions.map((item) => {
        const branch = one(item.branch);
        const details = [item.doctor_name, item.facility_name].filter(Boolean).join(" at ");

        return (
          <li key={item.id} className="rounded-2xl border border-brand-100 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-brand-900">
                  Submitted {format(new Date(item.created_at), "d MMM yyyy, h:mm a")}
                </p>
                {details ? <p className="mt-0.5 text-sm text-muted-foreground">{details}</p> : null}
                {branch ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Preferred branch: {branch.name}
                  </p>
                ) : null}
              </div>
              <StatusBadge status={item.status} />
            </div>

            <div className="mt-4">
              <FileViewer paths={item.file_paths} />
            </div>

            {item.status === "rejected" ? (
              <div
                role="alert"
                className="mt-4 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
              >
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-bold">The pharmacist could not approve this prescription.</p>
                  <p className="mt-0.5">{item.rejection_reason}</p>
                  <Link
                    href="/prescriptions"
                    className="mt-2 inline-block font-semibold underline"
                  >
                    Upload a new prescription
                  </Link>
                </div>
              </div>
            ) : null}

            {item.status === "approved" ? (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-900">
                <p>
                  Approved
                  {item.expires_at
                    ? `. Valid until ${format(new Date(item.expires_at), "d MMM yyyy")}.`
                    : "."}
                </p>
                <Link
                  href="/products?type=rx"
                  className={cn(buttonVariants({ size: "sm" }), "rounded-full")}
                >
                  Shop prescription medicines
                </Link>
              </div>
            ) : null}

            {item.status === "pending" ? (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {confirmingId === item.id ? (
                  <>
                    <span className="text-sm text-muted-foreground">Cancel this request?</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={cancelMutation.isPending}
                      onClick={() => cancelMutation.mutate(item.id)}
                      className="rounded-full border-red-300 text-red-700 hover:bg-red-50"
                    >
                      {cancelMutation.isPending ? (
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                      ) : null}
                      Yes, cancel it
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setConfirmingId(null)}
                      className="rounded-full"
                    >
                      Keep it
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirmingId(item.id)}
                    className="rounded-full text-red-700 hover:bg-red-50 hover:text-red-800"
                  >
                    Cancel request
                  </Button>
                )}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

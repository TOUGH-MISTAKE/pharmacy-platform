"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowLeft, CircleCheck, LoaderCircle, PackageCheck, CircleX } from "lucide-react";
import { toast } from "sonner";
import { FileViewer } from "@/components/prescriptions/file-viewer";
import { selectClass, textareaClass } from "@/components/prescriptions/field-styles";
import { StatusBadge } from "@/components/prescriptions/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatKes } from "@/lib/format";
import { one, type PrescriptionStatus } from "@/lib/prescriptions/types";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface PersonName {
  full_name: string;
}

interface Patient {
  full_name: string;
  phone: string | null;
  email: string | null;
  date_of_birth: string | null;
}

interface LinkedOrder {
  id: string;
  order_number: string;
  status: string;
  total: number | string;
  order_items: { product_name: string; quantity: number }[] | null;
}

interface PrescriptionDetail {
  id: string;
  status: PrescriptionStatus;
  created_at: string;
  doctor_name: string | null;
  facility_name: string | null;
  prescription_date: string | null;
  patient_notes: string | null;
  pharmacist_notes: string | null;
  rejection_reason: string | null;
  file_paths: string[];
  reviewed_at: string | null;
  expires_at: string | null;
  dispensed_at: string | null;
  patient: Patient | Patient[] | null;
  branch: { name: string } | { name: string }[] | null;
  reviewer: PersonName | PersonName[] | null;
  dispenser: PersonName | PersonName[] | null;
  orders: LinkedOrder[] | null;
}

type Mode = "idle" | "rejecting" | "confirm-dispense";

const EXPIRY_OPTIONS = [
  { months: 1, label: "1 month" },
  { months: 3, label: "3 months" },
  { months: 6, label: "6 months" },
  { months: 12, label: "12 months" },
];

function Detail({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-semibold text-brand-900">{value}</dd>
    </div>
  );
}

export function ReviewPanel({ prescriptionId }: { prescriptionId: string }) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>("idle");
  const [notes, setNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [expiryMonths, setExpiryMonths] = useState(6);

  const query = useQuery({
    queryKey: ["pharmacist-prescription", prescriptionId],
    queryFn: async (): Promise<PrescriptionDetail | null> => {
      const { data, error } = await createClient()
        .from("prescriptions")
        .select(
          "id, status, created_at, doctor_name, facility_name, prescription_date, patient_notes, pharmacist_notes, rejection_reason, file_paths, reviewed_at, expires_at, dispensed_at, patient:profiles!patient_id(full_name, phone, email, date_of_birth), branch:branches(name), reviewer:profiles!reviewed_by(full_name), dispenser:profiles!dispensed_by(full_name), orders(id, order_number, status, total, order_items(product_name, quantity))"
        )
        .eq("id", prescriptionId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data as unknown as PrescriptionDetail | null) ?? null;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (input: {
      fromStatus: PrescriptionStatus;
      changes: Record<string, string | null>;
      successMessage: string;
    }) => {
      const { data, error } = await createClient()
        .from("prescriptions")
        .update(input.changes)
        .eq("id", prescriptionId)
        .eq("status", input.fromStatus)
        .select("id");
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) {
        throw new Error(
          "This prescription was just updated by someone else. The page has been refreshed."
        );
      }
      return input.successMessage;
    },
    onSuccess: (message) => {
      toast.success(message);
      setMode("idle");
      setRejectionReason("");
      void queryClient.invalidateQueries({ queryKey: ["pharmacist-prescription", prescriptionId] });
      void queryClient.invalidateQueries({ queryKey: ["pharmacist-queue"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
      void queryClient.invalidateQueries({ queryKey: ["pharmacist-prescription", prescriptionId] });
    },
  });

  if (query.isLoading) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]" aria-hidden>
        <Skeleton className="h-96 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        We could not load this prescription. {query.error instanceof Error ? query.error.message : ""}
      </div>
    );
  }

  const rx = query.data;
  if (!rx) {
    return (
      <div className="rounded-3xl border border-brand-100 bg-white p-10 text-center">
        <h2 className="text-xl font-extrabold text-brand-900">Prescription not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          It may have been removed, or you may not have permission to view it.
        </p>
      </div>
    );
  }

  const patient = one(rx.patient);
  const branch = one(rx.branch);
  const reviewer = one(rx.reviewer);
  const dispenser = one(rx.dispenser);
  const orders = rx.orders ?? [];
  const busy = updateMutation.isPending;

  function handleApprove() {
    updateMutation.mutate({
      fromStatus: "pending",
      changes: {
        status: "approved",
        pharmacist_notes: notes.trim() || null,
        expires_at: new Date(Date.now() + expiryMonths * 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
      successMessage: "Prescription approved.",
    });
  }

  function handleReject() {
    if (rejectionReason.trim().length < 5) {
      toast.error("Please give the patient a clear reason (at least a few words).");
      return;
    }
    updateMutation.mutate({
      fromStatus: "pending",
      changes: {
        status: "rejected",
        rejection_reason: rejectionReason.trim(),
        pharmacist_notes: notes.trim() || null,
      },
      successMessage: "Prescription rejected. The patient can see your reason.",
    });
  }

  function handleDispense() {
    updateMutation.mutate({
      fromStatus: "approved",
      changes: { status: "dispensed" },
      successMessage: "Marked as dispensed.",
    });
  }

  return (
    <div>
      <Link
        href="/pharmacist"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to the queue
      </Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-brand-900 sm:text-3xl">
          {patient?.full_name || "Prescription"}
        </h1>
        <StatusBadge status={rx.status} />
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Submitted {format(new Date(rx.created_at), "d MMM yyyy, h:mm a")}
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <section className="rounded-2xl border border-brand-100 bg-white p-4 sm:p-5">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-brand-800">
            Prescription files
          </h2>
          <FileViewer paths={rx.file_paths} variant="full" />
          <p className="mt-3 text-xs text-muted-foreground">
            Click an image to open it full size. Links expire after a few minutes for privacy.
          </p>
        </section>

        <div className="space-y-6">
          <section className="rounded-2xl border border-brand-100 bg-white p-5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-brand-800">Patient</h2>
            <dl className="mt-2 divide-y divide-brand-100">
              <Detail label="Name" value={patient?.full_name || null} />
              <Detail label="Phone" value={patient?.phone ? `+${patient.phone}` : null} />
              <Detail label="Email" value={patient?.email ?? null} />
              <Detail
                label="Date of birth"
                value={
                  patient?.date_of_birth
                    ? format(new Date(patient.date_of_birth), "d MMM yyyy")
                    : null
                }
              />
            </dl>
          </section>

          <section className="rounded-2xl border border-brand-100 bg-white p-5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-brand-800">
              Prescription details
            </h2>
            <dl className="mt-2 divide-y divide-brand-100">
              <Detail label="Doctor" value={rx.doctor_name} />
              <Detail label="Clinic or hospital" value={rx.facility_name} />
              <Detail
                label="Date on prescription"
                value={
                  rx.prescription_date ? format(new Date(rx.prescription_date), "d MMM yyyy") : null
                }
              />
              <Detail label="Preferred branch" value={branch?.name ?? null} />
            </dl>
            {rx.patient_notes ? (
              <div className="mt-3 rounded-lg bg-brand-50 p-3 text-sm text-brand-900">
                <p className="text-xs font-bold uppercase tracking-wide text-brand-700">
                  Patient notes
                </p>
                <p className="mt-1">{rx.patient_notes}</p>
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-brand-100 bg-white p-5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-brand-800">
              Linked orders
            </h2>
            {orders.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                No orders are linked to this prescription yet.
              </p>
            ) : (
              <ul className="mt-2 space-y-3">
                {orders.map((order) => (
                  <li key={order.id} className="rounded-lg border border-brand-100 p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-brand-900">{order.order_number}</span>
                      <span className="text-xs text-muted-foreground">
                        {order.status.replace(/_/g, " ")} - {formatKes(Number(order.total))}
                      </span>
                    </div>
                    <ul className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                      {(order.order_items ?? []).map((item) => (
                        <li key={`${order.id}-${item.product_name}`}>
                          {item.quantity} x {item.product_name}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border-2 border-brand-200 bg-white p-5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-brand-800">Decision</h2>

            {rx.status === "pending" ? (
              <div className="mt-3 space-y-4">
                <div>
                  <label htmlFor="pharmacist-notes" className="text-sm font-semibold text-brand-900">
                    Internal notes (optional)
                  </label>
                  <textarea
                    id="pharmacist-notes"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    maxLength={500}
                    placeholder="For other pharmacists. The patient cannot see this."
                    className={cn(textareaClass, "mt-1.5")}
                  />
                </div>

                {mode === "rejecting" ? (
                  <div className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-3">
                    <label htmlFor="rejection-reason" className="text-sm font-bold text-red-800">
                      Reason shown to the patient
                    </label>
                    <textarea
                      id="rejection-reason"
                      value={rejectionReason}
                      onChange={(event) => setRejectionReason(event.target.value)}
                      maxLength={300}
                      placeholder="For example: the image is blurry, the doctor's signature is missing, or the prescription has expired."
                      className={textareaClass}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        onClick={handleReject}
                        disabled={busy}
                        className="rounded-full bg-red-700 text-white hover:bg-red-800"
                      >
                        {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CircleX className="h-4 w-4" />}
                        Confirm rejection
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setMode("idle")}
                        disabled={busy}
                        className="rounded-full"
                      >
                        Back
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <label htmlFor="expiry" className="text-sm font-semibold text-brand-900">
                        Valid for
                      </label>
                      <select
                        id="expiry"
                        value={expiryMonths}
                        onChange={(event) => setExpiryMonths(Number(event.target.value))}
                        className={cn(selectClass, "mt-1.5")}
                      >
                        {EXPIRY_OPTIONS.map((option) => (
                          <option key={option.months} value={option.months}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        onClick={handleApprove}
                        disabled={busy}
                        size="lg"
                        className="rounded-full"
                      >
                        {busy ? (
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                        ) : (
                          <CircleCheck className="h-4 w-4" />
                        )}
                        Approve
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        onClick={() => setMode("rejecting")}
                        disabled={busy}
                        className="rounded-full border-red-300 text-red-700 hover:bg-red-50"
                      >
                        <CircleX className="h-4 w-4" />
                        Reject
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ) : null}

            {rx.status === "approved" ? (
              <div className="mt-3 space-y-3 text-sm">
                <p className="text-green-800">
                  Approved{reviewer ? ` by ${reviewer.full_name || "a pharmacist"}` : ""}
                  {rx.reviewed_at ? ` on ${format(new Date(rx.reviewed_at), "d MMM yyyy, h:mm a")}` : ""}.
                  {rx.expires_at
                    ? ` Valid until ${format(new Date(rx.expires_at), "d MMM yyyy")}.`
                    : ""}
                </p>
                {rx.pharmacist_notes ? (
                  <p className="rounded-lg bg-brand-50 p-3 text-brand-900">
                    <span className="font-bold">Notes: </span>
                    {rx.pharmacist_notes}
                  </p>
                ) : null}

                {mode === "confirm-dispense" ? (
                  <div className="space-y-2 rounded-xl border border-brand-200 bg-brand-50 p-3">
                    <p className="font-semibold text-brand-900">
                      Confirm the medicines have been handed over or dispatched?
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" onClick={handleDispense} disabled={busy} className="rounded-full">
                        {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />}
                        Yes, mark as dispensed
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setMode("idle")}
                        disabled={busy}
                        className="rounded-full"
                      >
                        Back
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    type="button"
                    size="lg"
                    onClick={() => setMode("confirm-dispense")}
                    className="rounded-full"
                  >
                    <PackageCheck className="h-4 w-4" />
                    Mark as dispensed
                  </Button>
                )}
              </div>
            ) : null}

            {rx.status === "rejected" ? (
              <div className="mt-3 space-y-2 text-sm">
                <p className="text-red-800">
                  Rejected{reviewer ? ` by ${reviewer.full_name || "a pharmacist"}` : ""}
                  {rx.reviewed_at ? ` on ${format(new Date(rx.reviewed_at), "d MMM yyyy, h:mm a")}` : ""}.
                </p>
                {rx.rejection_reason ? (
                  <p className="rounded-lg bg-red-50 p-3 text-red-800">
                    <span className="font-bold">Reason: </span>
                    {rx.rejection_reason}
                  </p>
                ) : null}
              </div>
            ) : null}

            {rx.status === "dispensed" ? (
              <p className="mt-3 text-sm text-brand-800">
                Dispensed{dispenser ? ` by ${dispenser.full_name || "a pharmacist"}` : ""}
                {rx.dispensed_at ? ` on ${format(new Date(rx.dispensed_at), "d MMM yyyy, h:mm a")}` : ""}.
              </p>
            ) : null}

            {rx.status === "cancelled" || rx.status === "expired" ? (
              <p className="mt-3 text-sm text-muted-foreground">
                This prescription is {rx.status}. No further action is needed.
              </p>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}

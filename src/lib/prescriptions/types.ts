export type PrescriptionStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "dispensed"
  | "expired"
  | "cancelled";

export const STATUS_LABELS: Record<PrescriptionStatus, string> = {
  pending: "Awaiting review",
  approved: "Approved",
  rejected: "Rejected",
  dispensed: "Dispensed",
  expired: "Expired",
  cancelled: "Cancelled",
};

export const STATUS_STYLES: Record<PrescriptionStatus, string> = {
  pending: "bg-amber-100 text-amber-900",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  dispensed: "bg-brand-100 text-brand-800",
  expired: "bg-gray-200 text-gray-700",
  cancelled: "bg-gray-200 text-gray-700",
};

/** PostgREST returns a single related row as an object, but be safe if it is an array. */
export function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

import { STATUS_LABELS, STATUS_STYLES, type PrescriptionStatus } from "@/lib/prescriptions/types";
import { cn } from "@/lib/utils";

export function StatusBadge({ status }: { status: PrescriptionStatus }) {
  return (
    <span
      className={cn(
        "inline-block rounded-full px-3 py-1 text-xs font-bold",
        STATUS_STYLES[status]
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

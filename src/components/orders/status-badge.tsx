import { ORDER_STATUS_LABELS, ORDER_STATUS_STYLES, type OrderStatus } from "@/lib/orders/types";
import { cn } from "@/lib/utils";

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={cn(
        "inline-block rounded-full px-3 py-1 text-xs font-bold",
        ORDER_STATUS_STYLES[status]
      )}
    >
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}

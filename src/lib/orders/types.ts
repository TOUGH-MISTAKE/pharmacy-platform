export type OrderStatus =
  | "pending_payment"
  | "awaiting_verification"
  | "confirmed"
  | "packing"
  | "ready_for_pickup"
  | "out_for_delivery"
  | "completed"
  | "cancelled"
  | "refunded";

export type PaymentMethod = "mpesa" | "card" | "cash_on_pickup";
export type PaymentStatus =
  | "pending"
  | "processing"
  | "paid"
  | "failed"
  | "cancelled"
  | "refunded";
export type FulfilmentType = "pickup" | "delivery";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: "Awaiting payment",
  awaiting_verification: "Awaiting prescription check",
  confirmed: "Confirmed",
  packing: "Being packed",
  ready_for_pickup: "Ready for pickup",
  out_for_delivery: "Out for delivery",
  completed: "Completed",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

export const ORDER_STATUS_STYLES: Record<OrderStatus, string> = {
  pending_payment: "bg-amber-100 text-amber-900",
  awaiting_verification: "bg-amber-100 text-amber-900",
  confirmed: "bg-brand-100 text-brand-800",
  packing: "bg-brand-100 text-brand-800",
  ready_for_pickup: "bg-green-100 text-green-800",
  out_for_delivery: "bg-green-100 text-green-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-gray-200 text-gray-700",
  refunded: "bg-gray-200 text-gray-700",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  mpesa: "M-Pesa",
  card: "Card",
  cash_on_pickup: "Cash on pickup",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "Not paid yet",
  processing: "Processing",
  paid: "Paid",
  failed: "Payment failed",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

/** The steps a patient sees in the progress tracker. */
export function timelineSteps(fulfilment: FulfilmentType): { label: string }[] {
  return [
    { label: "Order placed" },
    { label: "Confirmed" },
    { label: "Being packed" },
    { label: fulfilment === "delivery" ? "Out for delivery" : "Ready for pickup" },
    { label: "Completed" },
  ];
}

/** Which step of the tracker an order status belongs to (0 to 4). */
export function timelineIndex(status: OrderStatus): number {
  switch (status) {
    case "pending_payment":
    case "awaiting_verification":
      return 0;
    case "confirmed":
      return 1;
    case "packing":
      return 2;
    case "ready_for_pickup":
    case "out_for_delivery":
      return 3;
    case "completed":
      return 4;
    default:
      return 0;
  }
}

export function canCancelOrder(status: OrderStatus, paymentStatus: PaymentStatus): boolean {
  return (
    (status === "pending_payment" || status === "awaiting_verification") &&
    (paymentStatus === "pending" || paymentStatus === "failed" || paymentStatus === "cancelled")
  );
}

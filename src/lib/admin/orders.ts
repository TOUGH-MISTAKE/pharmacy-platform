import type {
  FulfilmentType,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from "@/lib/orders/types";

export interface OrderAction {
  status: OrderStatus;
  label: string;
  tone: "primary" | "danger";
  confirmText: string;
}

export interface BoardTab {
  value: string;
  label: string;
  statuses: OrderStatus[];
}

export const BOARD_TABS: BoardTab[] = [
  { value: "action", label: "To process", statuses: ["confirmed", "packing"] },
  { value: "ready", label: "Ready or on the way", statuses: ["ready_for_pickup", "out_for_delivery"] },
  { value: "waiting", label: "Waiting", statuses: ["pending_payment", "awaiting_verification"] },
  { value: "completed", label: "Completed", statuses: ["completed"] },
  { value: "cancelled", label: "Cancelled", statuses: ["cancelled", "refunded"] },
  { value: "all", label: "All", statuses: [] },
];

interface ActionInput {
  status: OrderStatus;
  fulfilment: FulfilmentType;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
}

/** The buttons a staff member should see for an order. The database re-checks every one of these. */
export function availableActions(input: ActionInput): OrderAction[] {
  const canCancel = input.paymentStatus !== "paid" && input.paymentStatus !== "processing";

  const cancel: OrderAction = {
    status: "cancelled",
    label: "Cancel order",
    tone: "danger",
    confirmText: "Cancel this order? The reserved stock will be released.",
  };

  const actions: OrderAction[] = [];

  switch (input.status) {
    case "confirmed":
      actions.push({
        status: "packing",
        label: "Start packing",
        tone: "primary",
        confirmText: "Start packing this order?",
      });
      break;
    case "packing":
      actions.push(
        input.fulfilment === "pickup"
          ? {
              status: "ready_for_pickup",
              label: "Mark ready for pickup",
              tone: "primary",
              confirmText: "Mark this order as packed and ready for the customer to collect?",
            }
          : {
              status: "out_for_delivery",
              label: "Send out for delivery",
              tone: "primary",
              confirmText: "Mark this order as out for delivery?",
            }
      );
      break;
    case "ready_for_pickup":
      actions.push({
        status: "completed",
        label:
          input.paymentMethod === "cash_on_pickup" && input.paymentStatus !== "paid"
            ? "Collected and cash received"
            : "Mark as collected",
        tone: "primary",
        confirmText:
          input.paymentMethod === "cash_on_pickup" && input.paymentStatus !== "paid"
            ? "Confirm the customer collected the order and you received the cash? Stock will be deducted."
            : "Confirm the customer collected the order? Stock will be deducted.",
      });
      break;
    case "out_for_delivery":
      actions.push({
        status: "completed",
        label: "Mark as delivered",
        tone: "primary",
        confirmText: "Confirm the order was delivered? Stock will be deducted.",
      });
      break;
    default:
      break;
  }

  const cancellable: OrderStatus[] = [
    "pending_payment",
    "awaiting_verification",
    "confirmed",
    "packing",
  ];
  if (cancellable.includes(input.status) && canCancel) {
    actions.push(cancel);
  }

  return actions;
}

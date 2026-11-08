import type { RecordData } from "@/lib/api";
import { display } from "./shared";

export const riderPaymentMethod = (value: unknown) =>
  ({ wallet: "Wallet", hq_cash: "HQ cash" })[String(value)] || "Unavailable";
export const riderPaymentStatus = (value: unknown) =>
  ({
    pending: "Pending",
    paid: "Paid",
    awaiting_receipt: "Awaiting receipt",
    received: "Received",
  })[String(value)] || "Unavailable";
export const riderTaskStatus = (value: unknown) =>
  ({
    unknown: "Unknown",
    unassigned: "Unassigned",
    pickup_pending: "Pickup pending",
    in_progress: "In progress",
    awaiting_hq_payment: "Awaiting HQ payment",
    completed: "Completed",
    cancelled: "Cancelled",
  })[String(value)] || "Unavailable";
export const riderEarnings = (data: RecordData) =>
  data.riderAmountMinor == null
    ? "Unavailable"
    : display(
        data.riderAmountMinor,
        "amountMinor",
        data.riderPayment?.currency ||
          data.pricing?.currency ||
          data.currency ||
          "NGN",
      );
export const riderConfirmation = (value: unknown) =>
  value == null ? "Unavailable" : display(value, "confirmedAt");

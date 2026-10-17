import { auth } from "@/lib/firebase";
import { endpoints } from "@/lib/endpoint";

export const ORDER_SUMMARY_TYPES = [
  "shipment",
  "ride-courier",
  "food",
  "ecommerce",
] as const;
export type OrderSummaryType = (typeof ORDER_SUMMARY_TYPES)[number];
interface PaymentSummary {
  total: number;
  paid: number;
  unpaid: number;
  unknownPayment: number;
  totalRevenue: number;
  calculatedAt: string;
}
export interface FoodOrderSummary extends PaymentSummary {
  type: "food";
}
export interface FulfilmentOrderSummary extends PaymentSummary {
  type: Exclude<OrderSummaryType, "food">;
  active: number;
  completed: number;
  cancelled: number;
  completedRevenue: number;
}
export type OrderSummary = FoodOrderSummary | FulfilmentOrderSummary;

/** The backend calculates all-record totals; table state is never sent. */
export async function getOrderSummary(
  type: OrderSummaryType,
  signal: AbortSignal,
): Promise<OrderSummary> {
  if (!ORDER_SUMMARY_TYPES.includes(type))
    throw new Error("Invalid order summary type");
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in to view order summaries");
  signal.throwIfAborted();
  const token = await user.getIdToken();
  if (auth.currentUser?.uid !== user.uid)
    throw new Error("Your session changed. Please try again.");
  signal.throwIfAborted();
  const url = new URL(endpoints.getAdminOrderSummary);
  url.searchParams.set("type", type);
  const response = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
    signal,
  });
  const data = await response.json().catch(() => null);
  signal.throwIfAborted();
  if (auth.currentUser?.uid !== user.uid)
    throw new Error("Your session changed. Please try again.");
  if (!response.ok)
    throw new Error(
      typeof data?.error === "string"
        ? data.error
        : "Unable to load order summary",
    );
  const count = (value: unknown) =>
    Number.isSafeInteger(value) && (value as number) >= 0;
  const money = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value);
  if (
    !data ||
    data.type !== type ||
    typeof data.calculatedAt !== "string" ||
    !Number.isFinite(Date.parse(data.calculatedAt)) ||
    ![data.total, data.paid, data.unpaid, data.unknownPayment].every(count) ||
    data.paid + data.unpaid + data.unknownPayment !== data.total ||
    !money(data.totalRevenue) ||
    (type !== "food" &&
      (![data.active, data.completed, data.cancelled].every(count) ||
        data.active + data.completed + data.cancelled > data.total ||
        !money(data.completedRevenue)))
  ) {
    throw new Error("The server returned an invalid order summary");
  }
  return data;
}

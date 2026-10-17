import { auth } from "@/lib/firebase";
import { endpoints } from "@/lib/endpoint";

export interface UsersSummary {
  type: "users";
  total: number;
  newToday: number;
  newThisWeek: number;
  newLastWeek: number;
  growthRate: number | null;
  calculatedAt: string;
}
export interface RiderSummaryGroup {
  total: number;
  byVehicle: Record<string, number>;
}
export interface RidersSummary extends RiderSummaryGroup {
  type: "riders";
  verified: RiderSummaryGroup;
  pending: RiderSummaryGroup;
  blocked: RiderSummaryGroup;
  calculatedAt: string;
}
export type AccountSummary = UsersSummary | RidersSummary;

export async function getAccountSummary(
  type: "users" | "riders",
  signal: AbortSignal,
): Promise<AccountSummary> {
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in to view account summaries");
  const token = await user.getIdToken();
  const url = new URL(endpoints.getAdminAccountSummary);
  url.searchParams.set("type", type);
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
    signal,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(data?.error || "Unable to load account summary");
  const validCount = (value: unknown) =>
    Number.isSafeInteger(value) && (value as number) >= 0;
  const validGroup = (group: RiderSummaryGroup) =>
    group &&
    validCount(group.total) &&
    group.byVehicle &&
    [0, 1, 2].every((key) => validCount(group.byVehicle[key]));
  if (
    data?.type !== type ||
    !validCount(data.total) ||
    !Number.isFinite(Date.parse(data.calculatedAt)) ||
    (type === "users"
      ? ![data.newToday, data.newThisWeek, data.newLastWeek].every(
          validCount,
        ) ||
        !(
          data.growthRate === null ||
          (typeof data.growthRate === "number" &&
            Number.isFinite(data.growthRate))
        )
      : ![data, data.verified, data.pending, data.blocked].every(validGroup))
  ) {
    throw new Error("The server returned an invalid account summary");
  }
  return data;
}

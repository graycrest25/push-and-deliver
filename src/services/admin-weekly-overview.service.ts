import { z } from "zod";
import { auth } from "@/lib/firebase";
import { endpoints } from "@/lib/endpoint";

export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
const date = z.string().refine(isCalendarDate);
const count = z.number().int().nonnegative();
const responseSchema = z.object({
  success: z.literal(true),
  timezone: z.literal("Africa/Lagos"),
  weekStartsOn: z.literal("Monday"),
  startDate: date,
  endDate: date,
  weeks: z
    .array(
      z.object({
        weekStart: date,
        weekEnd: date,
        newUsers: count,
        activeRiders: count,
      }),
    )
    .min(1)
    .max(52),
  coverage: z.object({
    completedOrdersScanned: count,
    missingCompletionTimestamp: count,
    missingRiderId: count,
  }),
});
export type WeeklyOverview = z.infer<typeof responseSchema>;
export interface WeeklyOverviewQuery {
  weeks?: number;
  endDate?: string;
}

export const adminWeeklyOverviewService = {
  async getOverview(
    params: WeeklyOverviewQuery = {},
    signal?: AbortSignal,
  ): Promise<WeeklyOverview> {
    const weeks = params.weeks ?? 8;
    if (!Number.isInteger(weeks) || weeks < 1 || weeks > 52)
      throw new Error("Weeks must be an integer between 1 and 52");
    if (params.endDate !== undefined && !isCalendarDate(params.endDate))
      throw new Error("End date must be a valid YYYY-MM-DD calendar date");
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("Sign in to view weekly activity");
    const token = await currentUser.getIdToken(true);
    const { claims } = await currentUser.getIdTokenResult();
    if (claims.isAdmin !== true || claims.adminType !== "super")
      throw new Error("Super admin access is required to view weekly activity");
    const url = new URL(endpoints.getAdminWeeklyOverview);
    url.search = new URLSearchParams({
      weeks: String(weeks),
      ...(params.endDate !== undefined ? { endDate: params.endDate } : {}),
    }).toString();
    const response = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
      signal,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || data?.success === false)
      throw new Error(
        typeof data?.error === "string"
          ? data.error
          : `Unable to load weekly activity (${response.status})`,
      );
    const parsed = responseSchema.safeParse(data);
    if (!parsed.success)
      throw new Error(
        "The server returned an invalid weekly overview response",
      );
    return parsed.data;
  },
};

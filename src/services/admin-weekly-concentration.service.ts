import { z } from "zod";
import { auth } from "@/lib/firebase";
import { endpoints } from "@/lib/endpoint";
import { isCalendarDate } from "@/services/admin-weekly-overview.service";

export const concentrationLimits = [10, 20, 50, 100] as const;
const count = z.number().int().nonnegative();
const percent = z.number().finite().min(0).max(100);
const date = z.string().refine(isCalendarDate);
const responseSchema = z
  .object({
    success: z.literal(true),
    timezone: z.literal("Africa/Lagos"),
    weekStartsOn: z.literal("Monday"),
    weekStart: date,
    weekEnd: date,
    top: z.union([z.literal(10), z.literal(20), z.literal(50), z.literal(100)]),
    count,
    totalUsers: count,
    totalRides: count,
    topUsersRides: count,
    topUsersSharePercent: percent,
    users: z
      .array(
        z.object({
          rank: z.number().int().positive(),
          userid: z.string().min(1),
          totalRides: count,
          services: z.object({
            ridehailing: count,
            courier: count,
            expressshipmenr: count,
            customclearancer: count,
          }),
          name: z.string(),
          imageurl: z.string(),
          sharePercent: percent,
        }),
      )
      .max(100),
    coverage: z.object({
      ordersScanned: count,
      invalidCustomerId: count,
      unsupportedService: count,
    }),
  })
  .refine(
    (data) =>
      data.count === data.users.length &&
      data.count <= data.top &&
      data.count <= data.totalUsers,
  );
export type WeeklyConcentration = z.infer<typeof responseSchema>;
export interface WeeklyConcentrationQuery {
  top?: number;
  weekOf?: string;
}

export const adminWeeklyConcentrationService = {
  async getReport(
    params: WeeklyConcentrationQuery = {},
    signal?: AbortSignal,
  ): Promise<WeeklyConcentration> {
    const top = params.top ?? 10;
    if (!concentrationLimits.some((value) => value === top))
      throw new Error("Top users must be 10, 20, 50, or 100");
    if (params.weekOf !== undefined && !isCalendarDate(params.weekOf))
      throw new Error("Week date must be a valid YYYY-MM-DD calendar date");
    const currentUser = auth.currentUser;
    if (!currentUser)
      throw new Error("Sign in to view weekly user concentration");
    const token = await currentUser.getIdToken(true);
    const { claims } = await currentUser.getIdTokenResult();
    if (claims.isAdmin !== true || claims.adminType !== "super")
      throw new Error(
        "Super admin access is required to view weekly user concentration",
      );
    const url = new URL(endpoints.getAdminWeeklyConcentration);
    url.search = new URLSearchParams({
      top: String(top),
      ...(params.weekOf !== undefined ? { weekOf: params.weekOf } : {}),
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
          : `Unable to load weekly user concentration (${response.status})`,
      );
    const parsed = responseSchema.safeParse(data);
    if (!parsed.success)
      throw new Error(
        "The server returned an invalid weekly concentration response",
      );
    return parsed.data;
  },
};

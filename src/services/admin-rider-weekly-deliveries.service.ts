import { z } from "zod";
import { auth } from "@/lib/firebase";
import { endpoints } from "@/lib/endpoint";
import { isCalendarDate } from "@/services/admin-weekly-overview.service";

const count = z.number().int().nonnegative();
const date = z.string().refine(isCalendarDate);
const responseSchema = z
  .object({
    success: z.literal(true),
    timezone: z.literal("Africa/Lagos"),
    weekStartsOn: z.literal("Monday"),
    startDate: date,
    endDate: date,
    count,
    pageSize: z.number().int().min(1).max(200),
    riders: z
      .array(
        z.object({
          riderid: z.string().min(1),
          name: z.string().nullable().optional(),
          totalCompletedDeliveries: count,
          weeks: z
            .array(
              z.object({
                weekStart: date,
                weekEnd: date,
                completedDeliveries: count,
              }),
            )
            .min(1)
            .max(52),
        }),
      )
      .max(200),
    coverage: z.object({
      completedOrdersScanned: count,
      missingCompletionTimestamp: count,
    }),
    nextPageToken: z.string().min(1).nullable(),
  })
  .refine(
    (data) => data.count === data.riders.length && data.count <= data.pageSize,
  );
export type RiderWeeklyDeliveries = z.infer<typeof responseSchema>;
export interface RiderWeeklyDeliveriesQuery {
  weeks?: number;
  endDate?: string;
  pageSize?: number;
  pageToken?: string;
}

export const adminRiderWeeklyDeliveriesService = {
  async getPage(
    params: RiderWeeklyDeliveriesQuery = {},
    signal?: AbortSignal,
  ): Promise<RiderWeeklyDeliveries> {
    const weeks = params.weeks ?? 8;
    const pageSize = params.pageSize ?? 50;
    if (!Number.isInteger(weeks) || weeks < 1 || weeks > 52)
      throw new Error("Weeks must be an integer between 1 and 52");
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 200)
      throw new Error("Page size must be an integer between 1 and 200");
    if (params.endDate !== undefined && !isCalendarDate(params.endDate))
      throw new Error("End date must be a valid YYYY-MM-DD calendar date");
    if (
      params.pageToken !== undefined &&
      (typeof params.pageToken !== "string" || !params.pageToken.trim())
    )
      throw new Error("Page token must be a non-empty rider document ID");
    const currentUser = auth.currentUser;
    if (!currentUser)
      throw new Error("Sign in to view rider weekly deliveries");
    const token = await currentUser.getIdToken(true);
    const { claims } = await currentUser.getIdTokenResult();
    if (claims.isAdmin !== true || claims.adminType !== "super")
      throw new Error(
        "Super admin access is required to view rider weekly deliveries",
      );
    const url = new URL(endpoints.getAdminRiderWeeklyDeliveries);
    url.search = new URLSearchParams({
      weeks: String(weeks),
      pageSize: String(pageSize),
      ...(params.endDate !== undefined ? { endDate: params.endDate } : {}),
      ...(params.pageToken !== undefined
        ? { pageToken: params.pageToken }
        : {}),
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
          : `Unable to load rider weekly deliveries (${response.status})`,
      );
    const parsed = responseSchema.safeParse(data);
    if (!parsed.success)
      throw new Error(
        "The server returned an invalid rider weekly deliveries response",
      );
    return parsed.data;
  },
};

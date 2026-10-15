import { z } from "zod";
import { auth } from "@/lib/firebase";
import { endpoints } from "@/lib/endpoint";
import { isCalendarDate } from "@/services/admin-weekly-overview.service";

const count = z.number().int().nonnegative();
const date = z.string().refine(isCalendarDate);
const rate = z.number().finite().min(0).max(100).nullable();
const responseSchema = z.object({
  success: z.literal(true),
  timezone: z.literal("Africa/Lagos"),
  startDate: date,
  endDate: date,
  asOfDate: date,
  issuedCoupons: count,
  redeemedCoupons: count,
  notRedeemedByCutoffCoupons: count,
  expiredUnusedCoupons: count,
  couponRedemptionRatePercent: rate,
  usersIssuedCoupons: count,
  usersRedeemedCoupons: count,
  userRedemptionRatePercent: rate,
  coverage: z.object({
    missingRedemptionTimestamp: count,
    redemptionBeforeIssuance: count,
    invalidUserId: count,
    invalidIssuanceTimestamp: count,
  }),
});
export type CouponRedemptionMetrics = z.infer<typeof responseSchema>;
export interface CouponRedemptionQuery {
  startDate: string;
  endDate: string;
  asOfDate?: string;
}

export function validateCouponRedemptionQuery(params: CouponRedemptionQuery) {
  if (!isCalendarDate(params.startDate) || !isCalendarDate(params.endDate))
    throw new Error("Enter valid issuance dates in YYYY-MM-DD format.");
  if (params.startDate > params.endDate)
    throw new Error("Issuance start date must be on or before the end date.");
  if (params.asOfDate !== undefined) {
    if (!isCalendarDate(params.asOfDate))
      throw new Error("Enter a valid redemption cutoff in YYYY-MM-DD format.");
    if (params.asOfDate < params.endDate)
      throw new Error(
        "Redemption cutoff must be on or after the issuance end date.",
      );
  }
}

export const adminCouponRedemptionMetricsService = {
  async getMetrics(
    params: CouponRedemptionQuery,
    signal?: AbortSignal,
  ): Promise<CouponRedemptionMetrics> {
    validateCouponRedemptionQuery(params);
    const currentUser = auth.currentUser;
    if (!currentUser)
      throw new Error("Sign in to view coupon redemption metrics.");
    const token = await currentUser.getIdToken(true);
    const { claims } = await currentUser.getIdTokenResult();
    if (claims.isAdmin !== true || claims.adminType !== "super")
      throw new Error(
        "Super admin access is required to view coupon redemption metrics.",
      );
    const url = new URL(endpoints.getAdminCouponRedemptionMetrics);
    url.search = new URLSearchParams({
      startDate: params.startDate,
      endDate: params.endDate,
      ...(params.asOfDate !== undefined ? { asOfDate: params.asOfDate } : {}),
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
          : `Unable to load coupon redemption metrics (${response.status}).`,
      );
    const parsed = responseSchema.safeParse(data);
    if (!parsed.success)
      throw new Error(
        "The server returned an invalid coupon redemption response.",
      );
    return parsed.data;
  },
};

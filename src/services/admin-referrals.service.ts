import { auth } from "@/lib/firebase";
import { endpoints } from "@/lib/endpoint";

export const REFERRAL_LIMITS = [10, 20, 30, 50] as const;
export type ReferralLimit = (typeof REFERRAL_LIMITS)[number];
export interface ReferralFilters {
  referredUid?: string;
  referreduserType?: string;
  referralCodeUsed?: string;
}
export interface ReferralRecord {
  id: string;
  referredUid: string | null;
  referrerUid: string | null;
  referreduserType: string | null;
  referralCodeUsed: string | null;
  riderType: string | null;
  createdAt: string | null;
}
export interface ReferralPage {
  items: ReferralRecord[];
  limit: ReferralLimit;
  hasMore: boolean;
  nextCursor: string | null;
}
export interface ReferralSummary {
  totalReferrals: number;
  totalReferrers: number;
  userReferrals: number;
  riderReferrals: number;
  unknownTypeReferrals: number;
  avgReferralsPerReferrer: number;
  calculatedAt: string;
}
const count = (value: unknown) =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const date = (value: unknown) =>
  typeof value === "string" && Number.isFinite(Date.parse(value));
async function request(
  endpoint: string,
  params: URLSearchParams,
  signal?: AbortSignal,
) {
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in to view referrals");
  signal?.throwIfAborted();
  const token = await user.getIdToken();
  const checkSession = () => {
    signal?.throwIfAborted();
    if (auth.currentUser?.uid !== user.uid)
      throw new Error("Your session changed. Please try again.");
  };
  checkSession();
  const url = new URL(endpoint);
  url.search = params.toString();
  const response = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
    signal,
  });
  checkSession();
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      typeof body?.error === "string" ? body.error : "Unable to load referrals",
    );
  }
  return { response, checkSession };
}
export const adminReferralsService = {
  async list(
    filters: ReferralFilters,
    limit: ReferralLimit = 10,
    cursor?: string,
    signal?: AbortSignal,
  ): Promise<ReferralPage> {
    if (!REFERRAL_LIMITS.includes(limit))
      throw new Error("Limit must be 10, 20, 30, or 50");
    const params = new URLSearchParams({ limit: String(limit) });
    for (const [key, value] of Object.entries(filters))
      if (value?.trim()) params.set(key, value.trim());
    if (cursor) params.set("cursor", cursor);
    const { response, checkSession } = await request(
      endpoints.listAdminReferrals,
      params,
      signal,
    );
    const data = await response.json().catch(() => null);
    checkSession();
    const fields = [
      "referredUid",
      "referrerUid",
      "referreduserType",
      "referralCodeUsed",
      "riderType",
    ] as const;
    if (
      !data ||
      data.limit !== limit ||
      typeof data.hasMore !== "boolean" ||
      (data.hasMore
        ? typeof data.nextCursor !== "string" ||
          !data.nextCursor ||
          data.nextCursor === cursor
        : data.nextCursor !== null) ||
      !Array.isArray(data.items) ||
      data.items.length > limit ||
      (data.hasMore && data.items.length !== limit) ||
      data.items.some(
        (item: ReferralRecord) =>
          !item ||
          typeof item.id !== "string" ||
          !item.id ||
          fields.some(
            (key) => item[key] !== null && typeof item[key] !== "string",
          ) ||
          (item.createdAt !== null && !date(item.createdAt)),
      ) ||
      new Set(data.items.map((item: ReferralRecord) => item.id)).size !==
        data.items.length
    ) {
      throw new Error("The server returned an invalid referral page");
    }
    return data;
  },
  async summary(signal?: AbortSignal): Promise<ReferralSummary> {
    const { response, checkSession } = await request(
      endpoints.getAdminReferralSummary,
      new URLSearchParams(),
      signal,
    );
    const data = await response.json().catch(() => null);
    checkSession();
    if (
      !data ||
      ![
        data.totalReferrals,
        data.totalReferrers,
        data.userReferrals,
        data.riderReferrals,
        data.unknownTypeReferrals,
      ].every(count) ||
      data.totalReferrers > data.totalReferrals ||
      data.userReferrals + data.riderReferrals + data.unknownTypeReferrals !==
        data.totalReferrals ||
      typeof data.avgReferralsPerReferrer !== "number" ||
      !Number.isFinite(data.avgReferralsPerReferrer) ||
      data.avgReferralsPerReferrer < 0 ||
      !date(data.calculatedAt)
    ) {
      throw new Error("The server returned an invalid referral summary");
    }
    return data;
  },
  async exportCsv(
    startDate: string,
    endDate: string,
    referreduserType?: string,
  ): Promise<void> {
    const validDate = (value: string) =>
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      date(`${value}T00:00:00Z`) &&
      new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
    if (!validDate(startDate) || !validDate(endDate) || startDate > endDate)
      throw new Error("Select a valid start and end date for export");
    const params = new URLSearchParams({ startDate, endDate });
    if (referreduserType?.trim())
      params.set("referreduserType", referreduserType.trim());
    const { response, checkSession } = await request(
      endpoints.exportAdminReferralsCsv,
      params,
    );
    if (
      !response.headers
        .get("Content-Type")
        ?.toLowerCase()
        .startsWith("text/csv")
    )
      throw new Error("The server did not return a CSV export");
    const blob = await response.blob();
    checkSession();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    try {
      anchor.href = url;
      anchor.download = `referrals_${startDate}_${endDate}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
    } finally {
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  },
};

import { z } from "zod";
import { auth } from "@/lib/firebase";
import { endpoints } from "@/lib/endpoint";

export const activationStatuses = [
  "activated",
  "no_orders",
  "invalid_created_at",
  "invalid_order_created_at",
  "order_before_signup",
] as const;
export type ActivationStatus = (typeof activationStatuses)[number];

const count = z.number().int().nonnegative();
const userSchema = z.object({
  userid: z.string().min(1),
  createdAt: z.string().nullable(),
  firstOrderAt: z.string().nullable(),
  timeToFirstOrderDays: z.number().finite().nullable(),
  status: z.enum(activationStatuses),
});
const summarySchema = z.object({
  totalUsers: count,
  eligibleUsers: count,
  activatedUsers: count,
  noOrderUsers: count,
  invalidUsers: count,
  activationRate: z.number().finite().min(0).max(1).nullable(),
  averageTimeToFirstOrderDays: z.number().finite().nonnegative().nullable(),
});
const globalSummarySchema = summarySchema.extend({
  isComplete: z.boolean(),
  updatedAt: z.string().nullable(),
});
const summaryResponseSchema = z.object({
  success: z.literal(true),
  globalSummary: globalSummarySchema,
});
const responseSchema = summaryResponseSchema.extend({
  users: z.array(userSchema),
  pageSummary: summarySchema,
  nextPageToken: z.string().min(1).nullable(),
});
const lookupResponseSchema = summaryResponseSchema.merge(userSchema);
export type GlobalActivationSummary = z.infer<typeof globalSummarySchema>;
export type AdminTimeToFirstOrderResponse = Omit<
  z.infer<typeof responseSchema>,
  "pageSummary"
> & {
  pageSummary: z.infer<typeof summarySchema> | null;
};
export type TimeToFirstOrderQuery =
  | { id: string; pageSize?: never; pageToken?: never; summaryOnly?: false }
  | { id?: never; pageSize?: number; pageToken?: string; summaryOnly?: false };
type ReportQuery =
  | TimeToFirstOrderQuery
  | { summaryOnly: true; id?: never; pageSize?: never; pageToken?: never };

export class TimeToFirstOrderError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "TimeToFirstOrderError";
    this.status = status;
  }
}

async function requestReport(
  params: ReportQuery,
  signal?: AbortSignal,
): Promise<unknown> {
  const query = new URLSearchParams();
  if (
    params.summaryOnly !== undefined &&
    typeof params.summaryOnly !== "boolean"
  )
    throw new Error("summaryOnly must be true or false");
  if (params.summaryOnly === true) {
    if (
      params.id !== undefined ||
      params.pageSize !== undefined ||
      params.pageToken !== undefined
    )
      throw new Error(
        "Summary-only requests cannot be combined with pagination or user lookup",
      );
    query.set("summaryOnly", "true");
  } else if (params.id !== undefined) {
    if (typeof params.id !== "string" || !params.id.trim())
      throw new Error("Enter a user ID");
    if (params.pageSize !== undefined || params.pageToken !== undefined)
      throw new Error(
        "User lookup cannot be combined with pagination parameters",
      );
    query.set("id", params.id.trim());
  } else {
    const pageSize = params.pageSize ?? 50;
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 200)
      throw new Error("Page size must be an integer between 1 and 200");
    query.set("pageSize", String(pageSize));
    if (params.pageToken !== undefined) {
      if (typeof params.pageToken !== "string" || !params.pageToken.trim())
        throw new Error("Page token must be a non-empty string");
      query.set("pageToken", params.pageToken);
    }
  }
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Sign in to view user activation");
  const token = await currentUser.getIdToken(true);
  const { claims } = await currentUser.getIdTokenResult();
  if (claims.isAdmin !== true || claims.adminType !== "super")
    throw new Error("Super admin access is required to view user activation");
  const url = new URL(endpoints.getAdminTimeToFirstOrder);
  url.search = query.toString();
  const response = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.success === false) {
    throw new TimeToFirstOrderError(
      typeof data?.error === "string"
        ? data.error
        : `Unable to load user activation (${response.status})`,
      response.status,
    );
  }
  return data;
}

function invalidResponse(): never {
  throw new Error("The server returned an invalid user activation response");
}

export const adminTimeToFirstOrderService = {
  async getPage(
    params: TimeToFirstOrderQuery = {},
    signal?: AbortSignal,
  ): Promise<AdminTimeToFirstOrderResponse> {
    if (params.summaryOnly !== undefined && params.summaryOnly !== false)
      throw new Error("Use getSummary for summary-only requests");
    const data = await requestReport(params, signal);
    if (params.id !== undefined) {
      const parsed = lookupResponseSchema.safeParse(data);
      if (!parsed.success) return invalidResponse();
      const { success, globalSummary, ...user } = parsed.data;
      return {
        success,
        globalSummary,
        users: [user],
        pageSummary: null,
        nextPageToken: null,
      };
    }
    const parsed = responseSchema.safeParse(data);
    if (!parsed.success) return invalidResponse();
    return parsed.data;
  },
  async getSummary(signal?: AbortSignal): Promise<GlobalActivationSummary> {
    const data = await requestReport({ summaryOnly: true }, signal);
    const parsed = summaryResponseSchema.safeParse(data);
    if (!parsed.success) return invalidResponse();
    return parsed.data.globalSummary;
  },
};

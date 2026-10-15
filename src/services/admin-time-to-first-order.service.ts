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
const responseSchema = z.object({
  success: z.literal(true),
  users: z.array(
    z.object({
      userid: z.string().min(1),
      createdAt: z.string().nullable(),
      firstOrderAt: z.string().nullable(),
      timeToFirstOrderDays: z.number().finite().nullable(),
      status: z.enum(activationStatuses),
    }),
  ),
  pageSummary: z.object({
    totalUsers: count,
    eligibleUsers: count,
    activatedUsers: count,
    noOrderUsers: count,
    invalidUsers: count,
    activationRate: z.number().min(0).max(1).nullable(),
    averageTimeToFirstOrderDays: z.number().finite().nonnegative().nullable(),
  }),
  nextPageToken: z.string().min(1).nullable(),
});
export type AdminTimeToFirstOrderResponse = z.infer<typeof responseSchema>;
export type TimeToFirstOrderQuery =
  | { id: string; pageSize?: never; pageToken?: never }
  | { id?: never; pageSize?: number; pageToken?: string };

export class TimeToFirstOrderError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "TimeToFirstOrderError";
    this.status = status;
  }
}

export const adminTimeToFirstOrderService = {
  async getPage(
    params: TimeToFirstOrderQuery = {},
    signal?: AbortSignal,
  ): Promise<AdminTimeToFirstOrderResponse> {
    const query = new URLSearchParams();
    if (params.id !== undefined) {
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
    const parsed = responseSchema.safeParse(data);
    if (!parsed.success)
      throw new Error(
        "The server returned an invalid user activation response",
      );
    return parsed.data;
  },
};

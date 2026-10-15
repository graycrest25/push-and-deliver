import { auth } from "@/lib/firebase";
import { endpoints } from "@/lib/endpoint";

export type RideCountAccountType = "user" | "rider";
export interface AdminRideCounts {
  ridehailing: number;
  courier: number;
  expressshipmenr: number;
  customclearancer?: number;
}

export const adminRideCountsService = {
  async getCounts(
    usertype: RideCountAccountType,
    id: string,
    signal?: AbortSignal,
  ): Promise<AdminRideCounts> {
    if (usertype !== "user" && usertype !== "rider")
      throw new Error("Invalid account type");
    if (!id.trim()) throw new Error("An account ID is required");
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("Sign in to view ride counts");
    const token = await currentUser.getIdToken(true);
    const { claims } = await currentUser.getIdTokenResult();
    if (claims.isAdmin !== true || claims.adminType !== "super") {
      throw new Error("Super admin access is required to view ride counts");
    }
    const url = new URL(endpoints.getAdminRideCounts);
    url.search = new URLSearchParams({ usertype, id }).toString();
    const response = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
      signal,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(
        typeof data?.error === "string"
          ? data.error
          : `Unable to load ride counts (${response.status})`,
      );
    }
    const keys = [
      "ridehailing",
      "courier",
      "expressshipmenr",
      ...(usertype === "user" ? ["customclearancer"] : []),
    ] as const;
    if (
      !data ||
      keys.some((key) => !Number.isSafeInteger(data[key]) || data[key] < 0)
    ) {
      throw new Error("The server returned invalid ride counts");
    }
    return {
      ridehailing: data.ridehailing,
      courier: data.courier,
      expressshipmenr: data.expressshipmenr,
      ...(usertype === "user"
        ? { customclearancer: data.customclearancer }
        : {}),
    };
  },
};

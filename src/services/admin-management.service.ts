import { auth } from "@/lib/firebase";
import { endpoints } from "@/lib/endpoint";
import { isAdminType, type AdminType } from "@/lib/admin-access";

export type AdminStatus = AdminType | "";
export interface ManageAdminStatusResponse {
  success: true;
  uid: string;
  isAdmin: boolean;
  adminType: AdminStatus;
  sessionRefreshRequired?: boolean;
}

export interface AdminAccount {
  name: string | null;
  imageurl: string | null;
  email: string | null;
  userid: string;
  isAdmin: true;
  adminType: AdminType;
}

export interface ListAdminUsersResponse {
  success: true;
  count: number;
  scannedCount: number;
  pageSize: number;
  nextPageToken: string | null;
  users: AdminAccount[];
}

export async function listAdminUsers(
  options: {
    pageSize?: number;
    pageToken?: string;
    signal?: AbortSignal;
  } = {},
): Promise<ListAdminUsersResponse> {
  const pageSize = options.pageSize ?? 100;
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 1000) {
    throw new Error("Page size must be an integer from 1 to 1000.");
  }
  if (options.pageToken !== undefined && !options.pageToken) {
    throw new Error("Omit the page token for the first page.");
  }
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Sign in to list admin accounts.");
  const idToken = await currentUser.getIdToken(true);
  const { claims } = await currentUser.getIdTokenResult();
  if (claims.isAdmin !== true || claims.adminType !== "super") {
    throw new Error("Only super admins can list admin users");
  }
  if (auth.currentUser?.uid !== currentUser.uid)
    throw new Error("Your session changed. Please try again.");
  const url = new URL(endpoints.listAdminUsers);
  url.searchParams.set("pageSize", String(pageSize));
  if (options.pageToken !== undefined)
    url.searchParams.set("pageToken", options.pageToken);
  const response = await fetch(url.toString(), {
    method: "GET",
    headers: { Authorization: `Bearer ${idToken}` },
    signal: options.signal,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.success !== true) {
    throw new Error(
      (typeof data?.error === "string" && data.error) ||
        "Failed to load admin accounts.",
    );
  }
  if (
    !Array.isArray(data.users) ||
    !Number.isInteger(data.count) ||
    data.count !== data.users.length ||
    data.pageSize !== pageSize ||
    !Number.isInteger(data.scannedCount) ||
    data.scannedCount < data.count ||
    !(
      data.nextPageToken === null ||
      (typeof data.nextPageToken === "string" && data.nextPageToken.length > 0)
    ) ||
    !data.users.every(
      (user: AdminAccount) =>
        user &&
        typeof user.userid === "string" &&
        user.userid.length > 0 &&
        user.isAdmin === true &&
        isAdminType(user.adminType) &&
        (user.name === null || typeof user.name === "string") &&
        (user.imageurl === null || typeof user.imageurl === "string") &&
        (user.email === null || typeof user.email === "string"),
    )
  ) {
    throw new Error("The server returned an invalid admin list response.");
  }
  return data as ListAdminUsersResponse;
}

export async function manageAdminStatus(
  uid: string,
  adminType: AdminStatus,
): Promise<ManageAdminStatusResponse> {
  if (!uid.trim() || (adminType !== "" && !isAdminType(adminType))) {
    throw new Error("A user ID and a valid admin role are required.");
  }
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Sign in to manage admin access.");
  // Refresh before this privileged request so it uses the caller's latest claims.
  const idToken = await currentUser.getIdToken(true);
  const { claims } = await currentUser.getIdTokenResult();
  if (claims.isAdmin !== true || claims.adminType !== "super") {
    throw new Error("Super admin access is required.");
  }
  if (auth.currentUser?.uid !== currentUser.uid)
    throw new Error("Your session changed. Please try again.");

  const response = await fetch(endpoints.manageAdminStatus, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ uid, adminType }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.success !== true) {
    throw new Error(
      (typeof data?.error === "string" && data.error) ||
        (typeof data?.message === "string" && data.message) ||
        "Failed to update admin access.",
    );
  }
  if (
    data.uid !== uid ||
    data.adminType !== adminType ||
    data.isAdmin !== (adminType !== "")
  ) {
    throw new Error(
      "The server returned an unexpected admin status. Reload before trying again.",
    );
  }
  const result: ManageAdminStatusResponse = {
    success: true,
    uid: data.uid,
    isAdmin: data.isAdmin,
    adminType: data.adminType,
  };
  // This client cannot refresh another user's token; their client refreshes on focus/interval.
  if (uid === currentUser.uid && auth.currentUser?.uid === uid) {
    try {
      await currentUser.getIdToken(true);
    } catch {
      result.sessionRefreshRequired = true;
    }
  }
  return result;
}

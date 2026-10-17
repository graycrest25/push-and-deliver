import {
  collection,
  documentId,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
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
  pageSize: number;
  nextPageToken: string | null;
  users: AdminAccount[];
}

export async function listAdminUsers(
  options: {
    pageSize?: number;
    pageToken?: string;
    searchTerm?: string;
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
  options.signal?.throwIfAborted();
  await currentUser.getIdToken(true);
  const { claims } = await currentUser.getIdTokenResult();
  if (claims.isAdmin !== true || claims.adminType !== "super") {
    throw new Error("Only super admins can list admin users");
  }
  if (auth.currentUser?.uid !== currentUser.uid)
    throw new Error("Your session changed. Please try again.");
  options.signal?.throwIfAborted();
  const term = options.searchTerm?.trim().toLowerCase();
  let matchingDocuments: import("firebase/firestore").QueryDocumentSnapshot[];
  if (!term) {
    const snapshot = await getDocs(
      query(
        collection(db, "AdminUsers"),
        orderBy(documentId()),
        ...(options.pageToken ? [startAfter(options.pageToken)] : []),
        limit(pageSize + 1),
      ),
    );
    matchingDocuments = snapshot.docs;
  } else {
    matchingDocuments = [];
  }
  if (term) {
    const matches: typeof matchingDocuments = [];
    let cursor = options.pageToken;
    while (matches.length <= pageSize) {
      options.signal?.throwIfAborted();
      if (auth.currentUser?.uid !== currentUser.uid)
        throw new Error("Your session changed. Please try again.");
      const batch = await getDocs(
        query(
          collection(db, "AdminUsers"),
          orderBy(documentId()),
          ...(cursor ? [startAfter(cursor)] : []),
          limit(250),
        ),
      );
      matches.push(
        ...batch.docs.filter((document) =>
          [
            document.id,
            document.data().userid,
            document.data().name,
            document.data().email,
          ].some(
            (value) =>
              typeof value === "string" && value.toLowerCase().includes(term),
          ),
        ),
      );
      if (batch.size < 250) break;
      cursor = batch.docs.at(-1)!.id;
    }
    matchingDocuments = matches;
  }
  options.signal?.throwIfAborted();
  if (auth.currentUser?.uid !== currentUser.uid)
    throw new Error("Your session changed. Please try again.");
  const documents = matchingDocuments.slice(0, pageSize);
  const users: AdminAccount[] = documents.map((document) => {
    const data = document.data();
    if (
      typeof data.userid !== "string" ||
      !data.userid.trim() ||
      !isAdminType(data.adminType)
    ) {
      throw new Error(
        "An AdminUsers document has an invalid user ID or admin role.",
      );
    }
    return {
      userid: data.userid,
      adminType: data.adminType,
      isAdmin: true,
      name: typeof data.name === "string" ? data.name : null,
      email: typeof data.email === "string" ? data.email : null,
      imageurl: typeof data.imageurl === "string" ? data.imageurl : null,
    };
  });
  return {
    success: true,
    count: users.length,
    pageSize,
    nextPageToken:
      matchingDocuments.length > pageSize
        ? documents[documents.length - 1].id
        : null,
    users,
  };
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

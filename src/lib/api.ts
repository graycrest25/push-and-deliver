export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public requestId?: string,
    public retryAfter?: string,
    public details?: RecordData,
  ) {
    super(message);
  }
}
export type RecordData = Record<string, any>;
export const apiURL = (path: string) => {
  if (!/^\/v[12]\//.test(path) || /[\\\x00-\x20]/.test(path))
    throw new Error("Invalid API path");
  return `/api/proxy${path}`;
};
let refreshing: Promise<boolean> | undefined;
async function refreshSession() {
  if (!refreshing) {
    const refresh = async () => {
      // Another tab may already have rotated the cookies while this tab waited.
      const current = await fetch(apiURL("/v2/auth/session"), {
        cache: "no-store",
      });
      if (current.ok) {
        localStorage.removeItem("pnd-refresh-started");
        return true;
      }
      if (current.status !== 401)
        throw new ApiError(
          current.status,
          "session_unavailable",
          "Unable to check your session. Please retry.",
        );
      const started = Number(localStorage.getItem("pnd-refresh-started") || 0);
      if (started && Date.now() - started > 110000) return false;
      if (!started)
        localStorage.setItem("pnd-refresh-started", String(Date.now()));
      const response = await fetch(apiURL("/v2/auth/refresh"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (response.status >= 500 || response.status === 429)
        throw new ApiError(
          response.status,
          "refresh_unavailable",
          "Session renewal is temporarily unavailable. Please retry.",
        );
      if (response.ok) localStorage.removeItem("pnd-refresh-started");
      if (response.status === 403)
        throw new ApiError(
          403,
          "refresh_forbidden",
          "Session renewal was denied. Contact your administrator.",
        );
      return response.ok;
    };
    refreshing = Promise.resolve(
      navigator.locks
        ? navigator.locks.request("pnd-session-refresh", refresh)
        : refresh(),
    ).finally(() => {
      refreshing = undefined;
    });
  }
  return refreshing;
}
export async function apiResponse(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<Response> {
  const response = await fetch(apiURL(path), {
    ...options,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  if (
    response.status === 401 &&
    retry &&
    !/^\/v2\/auth\/(login|refresh|logout|social\/challenges|admin\/google|password-reset\/)/.test(
      path,
    )
  ) {
    if (await refreshSession()) return apiResponse(path, options, false);
    window.dispatchEvent(new Event("session-expired"));
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const fallback =
      response.status === 403
        ? "Your account does not have permission for this action."
        : response.status === 409
          ? "This record changed. Refresh it before making a new decision."
          : response.status === 429
            ? "Too many requests. Wait before trying again."
            : "The request failed. Please retry.";
    throw new ApiError(
      response.status,
      data.error?.code || "request_failed",
      data.error?.message || fallback,
      response.headers.get("x-request-id") || data.requestId || undefined,
      response.headers.get("retry-after") || undefined,
      data.error?.details,
    );
  }
  if (path === "/v2/auth/logout") {
    try {
      for (const key of Object.keys(sessionStorage))
        if (key.startsWith("pnd-game-rules:")) sessionStorage.removeItem(key);
    } catch {
      /* Storage restrictions must not prevent a successful sign-out. */
    }
  }
  return response;
}
export async function api<T = RecordData>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await apiResponse(path, options);
  if (response.status === 204) return undefined as T;
  const data = await response.json();
  // Native auth/profile/reference and financial endpoints use the data envelope.
  return (path.startsWith("/v2/auth/") ||
    path === "/v1/users/me" ||
    path.startsWith("/v1/shipping/local-types") ||
    path.startsWith("/v1/config/mobile") ||
    /^\/v1\/(admin\/(users|riders|fees|pricing|shipments|rides|shipping|geography|audit|reports|coupons|config|support|withdrawals|jobs|referrals|analytics)|shipments|assets|media)(\/|\?|$)/.test(
      path,
    ) ||
    /^\/v1\/admin\/users\/[^/]+\/role$/.test(path) ||
    path.startsWith("/v1/admin/payments/") ||
    path.startsWith("/v1/operations/")) &&
    data.data !== undefined
    ? data.data
    : data;
}
export function queryPath(path: string, values: Record<string, unknown>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values))
    if (value !== undefined && value !== null && value !== "")
      query.set(key, String(value));
  return path + (query.size ? `?${query}` : "");
}
export const segment = (id: unknown) => encodeURIComponent(String(id));
export async function signOut() {
  await api("/v2/auth/logout", {
    method: "POST",
    body: JSON.stringify({ revokeAllSessions: false }),
  });
  localStorage.removeItem("pnd-refresh-started");
  window.dispatchEvent(new Event("session-expired"));
}

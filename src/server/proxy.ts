import { createHash, randomUUID } from "node:crypto";
import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { allowedRoute } from "./routes";

const production = process.env.NODE_ENV === "production";
const SESSION = production ? "__Host-pnd-session-v2" : "pnd-session-v2";
const DEVICE = production ? "__Host-pnd-device" : "pnd-device";
type StoredSession = {
  accessToken: string;
  refreshToken: string;
  deviceId: string;
  refreshExpiresAt: string;
};
function readSession(request: NextRequest): StoredSession | null {
  try {
    const data = JSON.parse(request.cookies.get(SESSION)?.value || "null");
    return data &&
      typeof data.accessToken === "string" &&
      typeof data.refreshToken === "string" &&
      typeof data.deviceId === "string" &&
      Date.parse(data.refreshExpiresAt) > Date.now()
      ? data
      : null;
  } catch {
    return null;
  }
}
const cookieOptions = {
  httpOnly: true,
  secure: production,
  sameSite: "strict" as const,
  path: "/",
};
const publicAuth = new Set([
  "login",
  "social/challenges",
  "admin/google",
  "password-reset/request",
  "password-reset/confirm",
]);
const safeHeaders = [
  "content-type",
  "content-disposition",
  "x-request-id",
  "retry-after",
  "x-report-rows",
  "x-next-cursor",
  "x-report-truncated",
];
const fail = (status: number, code: string, message: string) =>
  NextResponse.json(
    { error: { code, message } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
function clearSession(response: NextResponse) {
  response.cookies.set(SESSION, "", { ...cookieOptions, maxAge: 0 });
  for (const name of [
    "pnd-access",
    "pnd-refresh",
    "__Host-pnd-access",
    "__Host-pnd-refresh",
  ])
    response.cookies.set(name, "", { ...cookieOptions, maxAge: 0 });
  return response;
}
function redact(value: unknown, base: URL): unknown {
  if (typeof value === "string")
    return value
      .split(base.origin)
      .join("")
      .split(base.href.replace(/\/$/, ""))
      .join("");
  if (Array.isArray(value)) return value.map((v) => redact(v, base));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([k]) =>
            ![
              "access_token",
              "refresh_token",
              "accessToken",
              "refreshToken",
            ].includes(k),
        )
        .map(([k, v]) => [k, redact(v, base)]),
    );
  return value;
}

export async function proxy(request: NextRequest, segments: string[]) {
  const method = request.method;
  // Decoded route segments cannot inject hosts, dot traversal, query strings or slashes.
  if (
    !segments.length ||
    segments.some(
      (s) => !s || s === "." || s === ".." || /[\\/\x00-\x20?#%]/.test(s),
    )
  )
    return fail(400, "invalid_path", "Invalid request path.");
  const path = "/" + segments.join("/");
  if (!allowedRoute(method, path))
    return fail(404, "unsupported_endpoint", "This operation is unavailable.");
  if (!["GET", "HEAD"].includes(method)) {
    const origin = request.headers.get("origin");
    if (
      !origin ||
      origin !== request.nextUrl.origin ||
      request.headers.get("sec-fetch-site") === "cross-site"
    )
      return fail(
        403,
        "invalid_origin",
        "Reload this page before trying again.",
      );
  }
  const publicConfigurationRead =
    method === "GET" && path === "/v1/config/mobile";
  const action = path.startsWith("/v2/auth/")
    ? path.slice("/v2/auth/".length)
    : undefined;
  if (action && request.nextUrl.search)
    return fail(
      400,
      "invalid_query",
      "Authentication endpoints do not accept query parameters.",
    );
  const session = readSession(request);
  const access = session?.accessToken;
  const refresh = session?.refreshToken;
  const deviceId =
    action === "login" ||
    action === "social/challenges" ||
    action === "admin/google"
      ? request.cookies.get(DEVICE)?.value || randomUUID()
      : session?.deviceId;
  if (
    !publicConfigurationRead &&
    !(action && publicAuth.has(action)) &&
    !(action === "refresh" ? refresh : access)
  )
    return fail(
      401,
      "session_expired",
      "Your session has expired. Sign in again.",
    );
  let base: URL;
  try {
    base = new URL(process.env.BASE_URL || "");
    if (
      base.username ||
      base.password ||
      base.search ||
      base.hash ||
      !["http:", "https:"].includes(base.protocol) ||
      (production && base.protocol !== "https:")
    )
      throw new Error();
  } catch {
    return fail(
      503,
      "configuration",
      "The service is not configured. Contact your administrator.",
    );
  }
  const configEnvironment = createHash("sha256")
    .update(base.href)
    .digest("hex")
    .slice(0, 24);
  if (
    path === "/v1/admin/game/rules" &&
    request.headers.has("x-config-environment") &&
    request.headers.get("x-config-environment") !== configEnvironment
  )
    return fail(
      409,
      "environment_changed",
      "The API environment changed. Reload settings before preparing another save.",
    );
  const url = new URL(base.href.replace(/\/$/, "") + path);
  url.search = request.nextUrl.search;
  const headers = new Headers({ Accept: "application/json" });
  if (
    access &&
    !publicConfigurationRead &&
    !(action && (publicAuth.has(action) || action === "refresh"))
  ) {
    headers.set("Authorization", `Bearer ${access}`);
    headers.set("X-Account-Type", "user");
  }
  const key = request.headers.get("idempotency-key");
  if (key) {
    if (!/^[A-Za-z0-9._:-]{8,128}$/.test(key))
      return fail(400, "invalid_key", "Invalid operation key.");
    headers.set("Idempotency-Key", key);
  }
  let body: string | undefined;
  if (!["GET", "HEAD"].includes(method)) {
    if (Number(request.headers.get("content-length") || 0) > 2_000_000)
      return fail(413, "body_too_large", "The request is too large.");
    const reader = request.body?.getReader();
    const decoder = new TextDecoder();
    const dashboardWrite =
      path.startsWith("/v1/admin/") ||
      /^\/v1\/shipments\/[^/]+\/(accept|transitions|cancel)$/.test(path) ||
      /^\/v1\/admin\/(coupons|support|config|analytics\/backfills|users\/[^/]+\/role)(\/|$)/.test(
        path,
      );
    const bodyLimit = action ? 8192 : dashboardWrite ? 32768 : 2_000_000;
    if (dashboardWrite && !key)
      return fail(400, "missing_key", "An operation key is required.");
    let size = 0;
    body = "";
    if (reader) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > bodyLimit) {
            await reader.cancel();
            return fail(413, "body_too_large", "The request is too large.");
          }
          body += decoder.decode(value, { stream: true });
        }
        body += decoder.decode();
      } catch {
        return fail(400, "invalid_body", "The request body could not be read.");
      }
    }
    if (body) {
      try {
        JSON.parse(body);
      } catch {
        return fail(400, "invalid_json", "The request must be valid JSON.");
      }
    }
    if (action === "login") {
      const input = JSON.parse(body || "{}");
      if (
        !input ||
        typeof input !== "object" ||
        Array.isArray(input) ||
        Object.keys(input).some(
          (k) => !["email", "password", "accountType"].includes(k),
        ) ||
        (input.accountType && input.accountType !== "user") ||
        typeof input.email !== "string" ||
        typeof input.password !== "string"
      )
        return fail(
          400,
          "invalid_login",
          "Enter your administrator email and password.",
        );
      body = JSON.stringify({
        accountType: "user",
        email: input.email,
        password: input.password,
        deviceId,
        deviceName: "Admin dashboard",
      });
      headers.delete("Idempotency-Key");
    }
    if (action && publicAuth.has(action) && action !== "admin/google")
      headers.delete("Idempotency-Key");
    if (action === "social/challenges" || action === "admin/google") {
      const input = JSON.parse(body || "{}");
      const challenge = action === "social/challenges";
      const fields = challenge ? ["provider"] : ["challengeId", "idToken"];
      if (
        !input ||
        typeof input !== "object" ||
        Array.isArray(input) ||
        Object.keys(input).some((k) => !fields.includes(k)) ||
        (challenge
          ? input.provider !== "google"
          : !key ||
            typeof input.challengeId !== "string" ||
            !input.challengeId ||
            typeof input.idToken !== "string" ||
            !input.idToken ||
            !request.cookies.get(DEVICE)?.value)
      )
        return fail(
          400,
          "invalid_google_login",
          "Start a new Google sign-in attempt.",
        );
      body = JSON.stringify({
        ...input,
        deviceId,
        ...(challenge ? {} : { deviceName: "Admin dashboard" }),
      });
    }
    if (action === "refresh") {
      body = JSON.stringify({ refreshToken: refresh, deviceId });
      // Stable per token generation: lost responses and different server instances
      // replay the same rotation; the token itself never leaves HttpOnly storage.
      headers.set(
        "Idempotency-Key",
        "refresh:" +
          createHash("sha256").update(`${refresh}:${deviceId}`).digest("hex"),
      );
    }
    if (action === "logout" && !key)
      headers.set(
        "Idempotency-Key",
        "logout:" +
          createHash("sha256").update(`${access}:${body}`).digest("hex"),
      );
    headers.set("Content-Type", "application/json");
  }
  try {
    const gameRequest = path === "/v1/admin/game/rules";
    const reportReadinessRequest =
      path === "/v1/admin/analytics/coverage" ||
      path === "/v1/admin/analytics/backfills";
    const campaignMutation =
      method !== "GET" &&
      (path === "/v1/admin/coupons/campaigns" ||
        /^\/v1\/admin\/coupons\/campaigns\/[^/]+\/status$/.test(path));
    if (gameRequest || reportReadinessRequest || campaignMutation) {
      const authorityResponse = await fetch(
        new URL(base.href.replace(/\/$/, "") + "/v2/auth/session"),
        {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${access}`,
            "X-Account-Type": "user",
          },
          cache: "no-store",
          redirect: "manual",
          signal: AbortSignal.timeout(25_000),
        },
      );
      if (!authorityResponse.ok)
        return fail(
          authorityResponse.status === 401 ? 401 : 403,
          "game_access_denied",
          "Unable to verify configuration access. Sign in again.",
        );
      const authority = (await authorityResponse.json()).data;
      if (
        authority?.isAdmin !== true ||
        authority.accountType !== "user" ||
        authority.accountStatus !== "active" ||
        !(
          gameRequest || reportReadinessRequest
            ? ["super"]
            : ["super", "regular"]
        ).includes(authority.adminType)
      )
        return fail(
          403,
          "game_access_denied",
          gameRequest
            ? "Only super administrators can manage game rules."
            : reportReadinessRequest
              ? "Only super administrators can inspect report coverage or request rebuilds."
              : "Only super and regular administrators can manage reward campaigns.",
        );
    }
    // Shipment status commands in this dashboard are restricted to super admins.
    if (
      (method === "POST" &&
        /^\/v1\/shipments\/[^/]+\/(accept|transitions|cancel)$/.test(path)) ||
      (method !== "GET" && /^\/v1\/admin\/shipments\//.test(path))
    ) {
      const authorityResponse = await fetch(
        new URL(base.href.replace(/\/$/, "") + "/v2/auth/session"),
        {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${access}`,
            "X-Account-Type": "user",
          },
          cache: "no-store",
          redirect: "manual",
          signal: AbortSignal.timeout(25_000),
        },
      );
      if (!authorityResponse.ok)
        return fail(
          authorityResponse.status === 401 ? 401 : 403,
          "shipment_access_denied",
          "Unable to verify shipment update access.",
        );
      const authority = (await authorityResponse.json()).data;
      if (
        authority?.isAdmin !== true ||
        authority.adminType !== "super" ||
        authority.accountType !== "user" ||
        authority.accountStatus !== "active"
      )
        return fail(
          403,
          "shipment_access_denied",
          "Only a super administrator can change shipment status from this dashboard.",
        );
    }
    // Check current authority server-side; never trust a browser-supplied subtype.
    const supportPath = "/v1/admin/support/tickets";
    const supportRequest =
      path === supportPath || path.startsWith(supportPath + "/");
    let openTicketsOnly = false;
    if (supportRequest) {
      const read = async (target: string) =>
        fetch(new URL(base.href.replace(/\/$/, "") + target), {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${access}`,
            "X-Account-Type": "user",
          },
          cache: "no-store",
          redirect: "manual",
          signal: AbortSignal.timeout(25_000),
        });
      const authorityResponse = await read("/v2/auth/session");
      if (!authorityResponse.ok)
        return fail(
          authorityResponse.status === 401 ? 401 : 403,
          "support_access_denied",
          "Unable to verify support access. Sign in again.",
        );
      const authority = (await authorityResponse.json()).data;
      if (
        authority?.isAdmin !== true ||
        authority.accountStatus !== "active" ||
        authority.accountType !== "user" ||
        !["super", "regular", "customercare"].includes(authority.adminType)
      )
        return fail(
          403,
          "support_access_denied",
          "This account cannot access support tickets.",
        );
      openTicketsOnly = authority.adminType !== "super";
      if (openTicketsOnly) {
        if (path === supportPath) {
          if (url.searchParams.get("status") === "closed")
            return fail(
              403,
              "closed_ticket_restricted",
              "Only a super administrator can view closed tickets.",
            );
          url.searchParams.set("status", "open");
        } else {
          const ticketPath =
            supportPath + "/" + encodeURIComponent(segments[4]);
          const ticketResponse = await read(ticketPath);
          if (!ticketResponse.ok)
            return fail(
              ticketResponse.status === 404 ? 404 : 403,
              "ticket_unavailable",
              "This ticket is unavailable.",
            );
          const ticket = (await ticketResponse.json()).data;
          if (ticket?.status !== "open")
            return fail(
              403,
              "closed_ticket_restricted",
              "Only a super administrator can view or reopen a closed ticket.",
            );
        }
      }
    }
    const upstream = await fetch(url, {
      method,
      headers,
      body: body || undefined,
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(25_000),
    });
    const responseHeaders = new Headers({
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    if (path === "/v1/admin/game/rules")
      responseHeaders.set("X-Config-Environment", configEnvironment);
    for (const name of safeHeaders) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, String(redact(value, base)));
    }
    // Never send upstream redirects (including private signed file URLs) to the browser.
    if (upstream.status >= 300 && upstream.status < 400) {
      if (
        method === "GET" &&
        /^\/v1\/media\/[^/]+\/content$/.test(path) &&
        upstream.status === 307
      ) {
        const location = upstream.headers.get("location");
        const download = location ? new URL(location) : null;
        const allowedHosts = (process.env.DOWNLOAD_HOSTS || "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean);
        if (
          !download ||
          download.protocol !== "https:" ||
          download.username ||
          download.password ||
          !(
            download.hostname.endsWith(".amazonaws.com") ||
            allowedHosts.includes(download.hostname)
          )
        )
          return fail(
            502,
            "download_host",
            "Private document storage is not configured for this host.",
          );
        // Credentials belong only to the API. Never forward them to object storage.
        const file = await fetch(download, {
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.timeout(25_000),
        });
        if (!file.ok)
          return fail(
            502,
            "download_failed",
            "The document could not be downloaded. Refresh and try again.",
          );
        return new NextResponse(file.body, {
          headers: {
            "Content-Type":
              file.headers.get("content-type") || "application/octet-stream",
            "Content-Disposition": "attachment",
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy":
              "default-src 'none'; frame-ancestors 'none'",
          },
        });
      }
      return fail(
        502,
        "unexpected_redirect",
        "The service returned an unexpected redirect.",
      );
    }
    if (upstream.headers.get("content-type")?.includes("json")) {
      const data = await upstream.json();
      if (openTicketsOnly && upstream.ok) {
        if (path === supportPath && Array.isArray(data?.data?.items)) {
          data.data.items = data.data.items.filter(
            (ticket: { status?: string }) => ticket.status === "open",
          );
        } else if (
          path === supportPath ||
          (path.split("/").length === 6 && data?.data?.status !== "open")
        ) {
          return fail(
            403,
            "closed_ticket_restricted",
            "Only a super administrator can view closed tickets.",
          );
        }
      }
      if (
        action &&
        ["login", "admin/google", "refresh"].includes(action) &&
        upstream.ok
      ) {
        const tokens = data.data;
        const expires = Date.parse(tokens?.refreshExpiresAt);
        if (
          !tokens ||
          tokens.accountType !== "user" ||
          (action === "admin/google" &&
            (tokens.isAdmin !== true ||
              !["super", "regular", "customercare", "verifier"].includes(
                tokens.adminType,
              ))) ||
          tokens.tokenType !== "Bearer" ||
          typeof tokens.uid !== "string" ||
          typeof tokens.sessionId !== "string" ||
          typeof tokens.accessToken !== "string" ||
          !tokens.accessToken ||
          typeof tokens.refreshToken !== "string" ||
          !tokens.refreshToken ||
          !Number.isFinite(tokens.expiresIn) ||
          tokens.expiresIn <= 0 ||
          !Number.isFinite(expires) ||
          expires <= Date.now()
        )
          return fail(
            502,
            "invalid_session",
            "The service returned an invalid session.",
          );
        const response = NextResponse.json(redact(data, base), {
          headers: responseHeaders,
        });
        clearSession(response);
        // One cookie replaces the pair atomically; expiry never extends the API family.
        response.cookies.set(
          SESSION,
          JSON.stringify({
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            deviceId,
            refreshExpiresAt: tokens.refreshExpiresAt,
          }),
          { ...cookieOptions, expires: new Date(expires) },
        );
        response.cookies.set(DEVICE, deviceId!, {
          ...cookieOptions,
          maxAge: 365 * 86400,
        });
        return response;
      }
      const response = NextResponse.json(redact(data, base), {
        status: upstream.status,
        headers: responseHeaders,
      });
      if (action === "social/challenges" && upstream.ok) {
        response.cookies.set(DEVICE, deviceId!, {
          ...cookieOptions,
          maxAge: 365 * 86400,
        });
      }
      if (
        action &&
        ((["logout", "password-reset/confirm"].includes(action) &&
          upstream.ok) ||
          (action === "refresh" && upstream.status === 401))
      )
        clearSession(response);
      return response;
    }
    if (!upstream.ok)
      return fail(
        upstream.status,
        "upstream_error",
        "The service could not complete this request. Please retry.",
      );
    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    return fail(
      502,
      "service_unavailable",
      "The service did not respond. Retry with the same operation details.",
    );
  }
}

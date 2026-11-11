import { createHash } from "node:crypto";
import { domesticPdf, controlDomesticPdf } from "./native-domestic-pdf-api.mjs";
import { gameApi, controlGame, resetGame } from "./native-game-api.mjs";
import { latest, resetLatest, controlLatest } from "./native-latest-api.mjs";
import { reads, resetReads, controlReads } from "./native-admin-reads-api.mjs";
import {
  dashboard,
  resetDashboard,
  controlDashboard,
  membership,
} from "./native-dashboard-api.mjs";
import {
  features,
  resetFeatures,
  controlFeatures,
} from "./native-features-api.mjs";
import http from "node:http";
import {
  engagement,
  resetEngagement,
  controlEngagement,
  engagementState,
} from "./native-engagement-api.mjs";
let records = [],
  access = "pnd_a2_private",
  refresh = "pnd_r2_private",
  expired = false,
  device = "",
  rotations = 0,
  failRefresh = false,
  failSession = false,
  denyRefresh = false,
  badContext = false,
  invalidLogin = false,
  failLogout = false;
const response = (res, status, data) => {
  res.writeHead(status, {
    "content-type": "application/json",
    "x-request-id": "native-request-test",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(data));
};
const success = (res, data, status = 200) =>
  response(res, status, { data, requestId: "native-request-test" });
const error = (res, status, code, message) =>
  response(res, status, {
    error: { code, message },
    requestId: "native-request-test",
  });
const tokens = () => ({
  uid: "admin-1",
  accountType: badContext ? "rider" : "user",
  sessionId: "session-1",
  tokenType: "Bearer",
  accessToken: access,
  refreshToken: refresh,
  expiresIn: 900,
  refreshExpiresAt: new Date(Date.now() + 86400000 * 30).toISOString(),
  authTime: new Date().toISOString(),
  provisioningStatus: "ready",
  isNewAccount: false,
});
http
  .createServer(async (req, res) => {
    const path = new URL(req.url, "http://127.0.0.1:4319").pathname;
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    if (path.startsWith("/storage/")) {
      res.writeHead(200, {
        "Access-Control-Allow-Origin": "http://localhost:4320",
        "Access-Control-Allow-Methods": "PUT, OPTIONS",
        "Access-Control-Allow-Headers": "content-type,x-amz-checksum-sha256",
      });
      if (req.method === "PUT")
        records.push({
          path,
          method: req.method,
          authorization: req.headers.authorization,
          checksum: req.headers["x-amz-checksum-sha256"],
          size: Buffer.concat(chunks).length,
        });
      return res.end();
    }
    let body;
    try {
      if (
        path.endsWith("/import-pdf") &&
        req.headers["content-type"]?.startsWith("multipart/form-data")
      ) {
        const form = await new Response(Buffer.concat(chunks), {
          headers: { "content-type": req.headers["content-type"] },
        }).formData();
        const file = form.get("file");
        body = {
          metadata: JSON.parse(form.get("metadata")),
          fileName: file.name,
          fileSize: file.size,
          fileHash: createHash("sha256")
            .update(Buffer.from(await file.arrayBuffer()))
            .digest("hex"),
        };
      } else body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
    } catch {
      return error(res, 400, "json", "Invalid JSON");
    }
    if (path === "/health") return success(res, { ok: true });
    if (path === "/control") {
      controlDomesticPdf(body);
      controlFeatures(body);
      if (body.reset) {
        resetFeatures();
        resetDashboard();
        resetReads();
        resetLatest();
        resetGame();
        resetEngagement();
        records = [];
        access = "pnd_a2_private";
        refresh = "pnd_r2_private";
        expired = false;
        device = "";
        rotations = 0;
        failRefresh = false;
        failSession = false;
        denyRefresh = false;
        badContext = false;
        invalidLogin = false;
        failLogout = false;
      }
      controlGame(body);
      controlEngagement(body);
      controlLatest(body);
      controlDashboard(body);
      controlReads(body);
      if (body.expire) expired = true;
      if (body.failRefresh !== undefined) failRefresh = body.failRefresh;
      if (body.failSession !== undefined) failSession = body.failSession;
      if (body.denyRefresh !== undefined) denyRefresh = body.denyRefresh;
      if (body.badContext !== undefined) badContext = body.badContext;
      if (body.invalidLogin !== undefined) invalidLogin = body.invalidLogin;
      if (body.failLogout) failLogout = true;
      return success(res, {
        records,
        rotations,
        engagement: engagementState(),
      });
    }
    records.push({
      path,
      query: Object.fromEntries(
        new URL(req.url, "http://localhost").searchParams,
      ),
      rawBody: path.endsWith("/import-pdf")
        ? "[multipart]"
        : Buffer.concat(chunks).toString(),
      method: req.method,
      body,
      authorization: req.headers.authorization,
      account: req.headers["x-account-type"],
      key: req.headers["idempotency-key"],
    });
    if (path === "/v2/auth/social/challenges") {
      device = body.deviceId;
      return success(
        res,
        {
          challengeId: "google-challenge",
          nonce: "google-nonce",
          expiresAt: new Date(Date.now() + 300000).toISOString(),
        },
        201,
      );
    }
    if (path === "/v2/auth/admin/google") {
      if (
        body.deviceId !== device ||
        body.challengeId !== "google-challenge" ||
        body.idToken !== "google-id-token" ||
        !req.headers["idempotency-key"] ||
        req.headers.authorization
      )
        return error(res, 400, "invalid_google", "Wrong Google context");
      if (!membership().isAdmin)
        return error(
          res,
          403,
          "forbidden",
          "Administrator membership required",
        );
      expired = false;
      return success(res, { ...tokens(), ...membership() });
    }
    if (
      path === "/v1/config/mobile" &&
      dashboard(path, req, res, body, success, error)
    )
      return;
    if (path === "/v2/auth/login") {
      if (invalidLogin)
        return error(
          res,
          401,
          "invalid_credentials",
          "Incorrect email or password.",
        );
      if (
        body.accountType !== "user" ||
        !body.deviceId ||
        body.deviceName !== "Admin dashboard" ||
        body.password !== "example-password"
      )
        return error(res, 400, "invalid", "Incorrect login shape");
      device = body.deviceId;
      expired = false;
      return success(res, tokens());
    }
    if (path === "/v2/auth/refresh") {
      if (failRefresh)
        return error(
          res,
          503,
          "unavailable",
          "Session renewal temporarily unavailable",
        );
      if (denyRefresh)
        return error(res, 401, "invalid_refresh", "Sign in again");
      if (
        body.deviceId !== device ||
        body.refreshToken !== refresh ||
        !req.headers["idempotency-key"] ||
        req.headers.authorization
      )
        return error(res, 401, "invalid_refresh", "Wrong refresh context");
      rotations++;
      expired = false;
      access = `pnd_a2_rotated-${rotations}`;
      refresh = `pnd_r2_rotated-${rotations}`;
      return success(res, tokens());
    }
    if (path === "/v2/auth/password-reset/request")
      return success(res, { accepted: true, retryAfterSeconds: 60 }, 202);
    if (path === "/v2/auth/password-reset/confirm")
      return success(res, { changed: true, sessionsRevoked: true });
    if (
      expired ||
      req.headers.authorization !== `Bearer ${access}` ||
      req.headers["x-account-type"] !== "user"
    )
      return error(res, 401, "expired", "Session expired");
    if (domesticPdf(path, req, res, body, success, error)) return;
    if (/^\/v1\/admin\/shipping\/tariffs\/[^/]+\/import-pdf$/.test(path)) {
      if (body.fileName === "scanned.pdf")
        return error(
          res,
          422,
          "unrecognised_pdf",
          "PDF layout is not recognised. Live prices are unchanged.",
        );
      if (body.metadata.preview)
        return success(res, {
          applied: false,
          baseTariffId: path.split("/").at(-2),
          baseVersion: body.metadata.expectedVersion,
          sourceSha256: body.fileHash,
          currency: "NGN",
          importedRates: 240,
          preservedHigherWeightRates: 72,
          maxImportedWeightGrams: 25000,
          mappedCountries: 52,
          preservedUnlistedCountries: 181,
          countryChanges: [
            { code: "DE", previousZone: 5, zone: 4 },
            { code: "US", previousZone: 4, zone: 3 },
          ],
          rates: Array.from({ length: 30 }, (_, index) =>
            index < 10 ? (index + 1) * 500 : (index - 4) * 1000,
          ).flatMap((weightGrams) =>
            Array.from({ length: 8 }, (_, index) => ({
              zone: index + 1,
              weightGrams,
              amountMinor: index === 0 ? 7407472 : 7821768,
            })),
          ),
        });
      const publications = records.filter(
        (row) => row.path === path && row.body?.metadata?.preview === false,
      );
      if (body.metadata.name === "Retry prices" && publications.length === 1)
        return error(res, 504, "timeout", "Publication response timed out.");
      return success(res, {
        id: "replacement-export",
        status: "active",
        priceCount: 240,
        countryCount: 52,
      });
    }
    if (
      await engagement(
        path,
        req,
        res,
        body,
        success,
        error,
        membership().adminType,
      )
    )
      return;
    if (gameApi(path, req, res, body, membership().adminType)) return;
    if (latest(path, req, res, body, success, error, membership().adminType))
      return;
    if (reads(path, req, res, body, success, error, membership().adminType))
      return;
    if (dashboard(path, req, res, body, success, error)) return;
    if (features(path, req, res, body, success, error)) return;
    if (path === "/v2/auth/session" && failSession)
      return error(res, 502, "unavailable", "Session unavailable");
    if (path === "/v2/auth/session")
      return success(res, {
        uid: "admin-1",
        accountType: "user",
        sessionId: "session-1",
        emailVerified: true,
        accountStatus: "active",
        provisioningStatus: "ready",
        permissions: ["profile:read", "wallet:read"],
        ...membership(),
        tokenExpiresAt: new Date(Date.now() + 900000).toISOString(),
        authTime: new Date().toISOString(),
      });
    if (path === "/v1/users/me")
      return success(res, {
        uid: "admin-1",
        accountType: "user",
        username: "Operations Admin",
        email: "admin@example.test",
        version: 1,
      });
    if (path === "/v2/auth/logout") {
      if (failLogout) {
        failLogout = false;
        return error(res, 503, "unavailable", "Retry signing out");
      }
      return success(res, { signedOut: true, sessionsRevoked: true });
    }
    return error(res, 404, "not_found", "Not registered in native fixture");
  })
  .listen(4319, "127.0.0.1");

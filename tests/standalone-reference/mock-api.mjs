import http from "node:http";
import { createHash } from "node:crypto";
let uploads = new Map();
let uploadKeys = new Map();
let uploadMode = "ready";
let blockedPart = 0;
let signupSettings = { enabled: true, campaign_ids: ["campaign-welcome"] };
let bonusAmount = 10000;
let signupJobStatus = "dead";
let releaseMode = "ready";
let releases = new Map();
const hash = (bytes) => createHash("sha256").update(bytes);
let records = [];
let expired = false;
let failOnce = false;
let refreshes = 0;
let memberships = "super";
const user = {
  id: "admin-1",
  email: "admin@example.test",
  display_name: "Operations Admin",
  role: "admin",
  status: "active",
  email_verified: true,
};
const respond = (res, status, data, headers = {}) => {
  res.writeHead(status, { "content-type": "application/json", ...headers });
  res.end(JSON.stringify(data));
};
http
  .createServer(async (req, res) => {
    const url = new URL(req.url, "http://127.0.0.1:4319");
    const path = url.pathname;
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    if (path.startsWith("/s3/")) {
      res.setHeader("Access-Control-Allow-Origin", "http://localhost:4320");
      res.setHeader("Access-Control-Allow-Methods", "PUT, OPTIONS");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "content-type,x-amz-checksum-sha256",
      );
      if (req.method === "OPTIONS") {
        res.writeHead(204);
        return res.end();
      }
      const [, , id, partString] = path.split("/");
      const part = Number(partString);
      const bytes = Buffer.concat(chunks);
      records.push({
        method: req.method,
        path,
        authorization: req.headers.authorization,
        cookie: req.headers.cookie,
        size: bytes.length,
        checksum: req.headers["x-amz-checksum-sha256"],
      });
      if (part === blockedPart)
        return respond(res, 503, { error: "storage_busy" });
      const upload = uploads.get(id);
      if (
        !upload ||
        hash(bytes).digest("base64") !== req.headers["x-amz-checksum-sha256"]
      )
        return respond(res, 400, { error: "checksum" });
      upload.bytes.set(part, bytes);
      upload.parts = [...upload.bytes].map(([part_number, data]) => ({
        part_number,
        size_bytes: data.length,
        checksum_sha256: hash(data).digest("base64"),
        etag: "part-etag",
      }));
      res.writeHead(200);
      return res.end();
    }
    let body;
    try {
      body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
    } catch {
      return respond(res, 400, {
        error: { code: "invalid_json", message: "Invalid JSON" },
      });
    }
    if (path === "/health") return respond(res, 200, { ok: true });
    if (path === "/control") {
      if (body.reset) {
        records = [];
        expired = false;
        failOnce = false;
        refreshes = 0;
        memberships = "super";
        uploads = new Map();
        uploadKeys = new Map();
        uploadMode = "ready";
        blockedPart = 0;
        signupSettings = { enabled: true, campaign_ids: ["campaign-welcome"] };
        bonusAmount = 10000;
        signupJobStatus = "dead";
        releases = new Map();
        releaseMode = "ready";
      }
      if (body.releaseMode) releaseMode = body.releaseMode;
      if (body.releaseReset) releases = new Map();
      if (body.uploadMode) uploadMode = body.uploadMode;
      if (body.blockedPart !== undefined) blockedPart = body.blockedPart;
      if (body.expire) expired = true;
      if (body.failOnce) failOnce = true;
      if (body.membership) memberships = body.membership;
      return respond(res, 200, { records, refreshes });
    }
    records.push({
      method: req.method,
      path,
      query: Object.fromEntries(url.searchParams),
      authorization: req.headers.authorization,
      key: req.headers["idempotency-key"],
      body,
    });
    if (path === "/v1/auth/login")
      return respond(res, 200, {
        user,
        access_token: "access-private",
        refresh_token: "refresh-private",
        expires_in: 900,
      });
    if (path === "/v1/auth/refresh") {
      if (body.refresh_token !== "refresh-private")
        return respond(res, 401, {
          error: { code: "invalid_refresh", message: "Session expired" },
        });
      refreshes++;
      expired = false;
      return respond(res, 200, {
        user,
        access_token: "access-rotated",
        refresh_token: "refresh-private",
        expires_in: 900,
      });
    }
    if (
      path.startsWith("/v1/auth/") &&
      ["forgot-password", "reset-password"].some((x) => path.endsWith(x))
    )
      return respond(res, 200, { status: "accepted" });
    if (path === "/v1/config/mobile" && req.method === "GET") {
      const app = url.searchParams.get("app");
      const platform = url.searchParams.get("platform");
      if (
        !["user", "rider", "vendor"].includes(app) ||
        !["android", "ios"].includes(platform)
      )
        return respond(res, 400, {
          error: { code: "invalid", message: "Invalid app/platform" },
        });
      if (releaseMode === "error")
        return respond(res, 503, {
          error: {
            code: "unavailable",
            message: "Release settings unavailable",
          },
        });
      const saved = releases.get(`${app}/${platform}`);
      if (!saved && releaseMode === "missing")
        return respond(res, 404, {
          error: { code: "not_found", message: "No release configuration" },
        });
      return respond(
        res,
        200,
        saved || {
          app,
          platform,
          minimum_version: app === "rider" ? "2.1.0" : "1.2.0",
          latest_version: app === "rider" ? "2.3.0" : "1.10.0",
          app_name: app === "user" ? "PushNDeliver" : "PushNDeliver Rider",
          active: true,
          force_update: true,
          maintenance: platform === "ios",
        },
      );
    }
    if (
      expired ||
      !["Bearer access-private", "Bearer access-rotated"].includes(
        req.headers.authorization,
      )
    )
      return respond(res, 401, {
        error: { code: "expired", message: "Session expired" },
      });
    if (path === "/v1/config")
      return respond(res, 200, { signup_bonus_minor: bonusAmount });
    if (
      [
        "/v1/admin/config/signup_bonus_minor",
        "/v1/admin/config/signup_bonus_budget_minor",
      ].includes(path)
    ) {
      if (memberships !== "super")
        return respond(res, 403, {
          error: { code: "forbidden", message: "Super admin required" },
        });
      if (typeof body !== "number" || !Number.isSafeInteger(body))
        return respond(res, 400, {
          error: { code: "invalid", message: "Expected scalar integer" },
        });
      if (path.endsWith("/signup_bonus_minor")) bonusAmount = body;
      return respond(res, 200, { key: path.split("/").at(-1) });
    }
    if (path === "/v1/admin/coupons/signup/settings") {
      if (req.method === "PUT") signupSettings = body;
      return respond(res, 200, signupSettings);
    }
    if (path === "/v1/admin/coupons/signup/jobs")
      return respond(res, 200, {
        jobs: [
          {
            user_id: "customer-1",
            status: signupJobStatus,
            attempts: signupJobStatus === "dead" ? 5 : 0,
            coupon_id: null,
            last_error_code:
              signupJobStatus === "dead" ? "processing_failed" : "",
            notices: [
              {
                kind: "waiting",
                status: "dead",
                attempts: 5,
                last_error_code: "delivery_failed",
              },
            ],
          },
        ],
        next_cursor: "",
      });
    if (path === "/v1/admin/coupons/signup/jobs/customer-1/requeue") {
      signupJobStatus = "pending";
      return respond(res, 200, {
        user_id: "customer-1",
        queue: body.queue,
        status: "pending",
      });
    }
    if (path === "/v1/admin/coupons/campaigns")
      return respond(res, 200, { id: "campaign-1" });
    if (path === "/v1/admin/coupons/grants")
      return respond(res, 200, { id: "coupon-1" });
    if (path.startsWith("/v1/admin/config/mobile/") && req.method === "PUT") {
      if (!["super", "regular"].includes(memberships))
        return respond(res, 403, {
          error: { code: "forbidden", message: "Access denied" },
        });
      if (failOnce) {
        failOnce = false;
        return respond(res, 503, {
          error: {
            code: "unavailable",
            message: "Please retry unchanged release settings",
          },
        });
      }
      const [, , , , , app, platform] = path.split("/");
      const data = { app, platform, ...body };
      releases.set(`${app}/${platform}`, data);
      return respond(res, 200, data);
    }
    if (path === "/v1/uploads/multipart") {
      let id = uploadKeys.get(req.headers["idempotency-key"]);
      if (!id) {
        id = `asset-${uploads.size + 1}`;
        uploadKeys.set(req.headers["idempotency-key"], id);
        uploads.set(id, {
          asset: {
            id,
            owner_id: user.id,
            status: "staging",
            mime_type: body.mime_type,
            size_bytes: body.size_bytes,
          },
          state: "uploading",
          upload_size_bytes: body.upload_size_bytes,
          part_size_bytes: 5242880,
          expires_at: new Date(Date.now() + 86400000).toISOString(),
          parts: [],
          bytes: new Map(),
          sha: body.sha256,
        });
      }
      return respond(res, 201, uploads.get(id));
    }
    const uploadPath = path.match(/^\/v1\/uploads\/(asset-\d+)(.*)$/);
    if (uploadPath) {
      const upload = uploads.get(uploadPath[1]);
      const suffix = uploadPath[2];
      if (!upload)
        return respond(res, 404, {
          error: { code: "not_found", message: "Missing upload" },
        });
      if (suffix.startsWith("/parts/")) {
        const part = Number(suffix.split("/").at(-1));
        return respond(res, 200, {
          method: "PUT",
          url: `http://localhost:4319/s3/${upload.asset.id}/${part}?signature=private-test-signature`,
          headers: {
            "X-Amz-Checksum-Sha256": [body.checksum_sha256],
            Host: ["localhost:4319"],
            "Content-Length": [
              String(
                Math.min(
                  5242880,
                  upload.upload_size_bytes - (part - 1) * 5242880,
                ),
              ),
            ],
          },
          expires_at: new Date(Date.now() + 900000).toISOString(),
        });
      }
      if (suffix === "/complete") {
        const bytes = Buffer.concat(
          [...upload.bytes].sort(([a], [b]) => a - b).map(([, data]) => data),
        );
        if (
          hash(bytes).digest("hex") !== upload.sha ||
          bytes.length !== upload.upload_size_bytes
        )
          return respond(res, 400, {
            error: { code: "checksum", message: "Invalid complete hash" },
          });
        upload.state = "processing";
        return respond(res, 202, upload, { "retry-after": "1" });
      }
      if (suffix === "/abort") {
        upload.state = "aborted";
        return respond(res, 202, { status: "deletion_queued" });
      }
      if (req.method === "DELETE") {
        if (upload.attached)
          return respond(res, 409, {
            error: {
              code: "attached",
              message: "This file is attached and cannot be deleted.",
            },
          });
        upload.asset.status = "deleting";
        return respond(res, 202, { status: "deletion_queued" });
      }
      if (suffix === "/session") {
        if (upload.state === "processing" && uploadMode !== "hold") {
          upload.state = uploadMode === "fail" ? "failed" : "ready";
          if (upload.state === "ready") upload.asset.status = "ready";
        }
        return respond(res, 200, upload);
      }
      return respond(res, 200, upload.asset);
    }
    if (req.method === "POST" || req.method === "PUT") {
      for (const id of [
        body.asset_id,
        body.image_asset_id,
        body.proof_asset_id,
      ]) {
        if (uploads.has(id)) {
          if (uploads.get(id).asset.status !== "ready")
            return respond(res, 409, {
              error: { code: "not_ready", message: "File is not ready" },
            });
          uploads.get(id).attached = true;
        }
      }
    }
    if (path === "/v1/auth/me") return respond(res, 200, user);
    if (path === "/v1/auth/logout" || path === "/v1/auth/logout-all")
      return respond(res, 200, { status: "signed_out" });
    if (path === "/v1/admin/users") {
      if (url.searchParams.get("search") === user.email)
        return respond(res, 200, {
          users: [{ ...user, admin_type: memberships }],
        });
      const after = url.searchParams.get("after");
      const count = after ? 2 : Number(url.searchParams.get("limit") || 25);
      return respond(res, 200, {
        users: Array.from({ length: count }, (_, i) => ({
          id: `user-${after ? 100 + i : i + 1}`,
          display_name: after ? `Next person ${i + 1}` : `Person ${i + 1}`,
          email: `person${i}@example.test`,
          role: "customer",
          status: "active",
          rider_status: "pending",
          created_at: "2026-11-01T10:00:00Z",
        })),
      });
    }
    if (path === "/v1/admin/dashboard")
      return respond(res, 200, {
        period: { from: "2026-10-03", to_exclusive: "2026-11-03" },
        users: 27,
        shipments: 12,
        marketplace_orders: 4,
        rides: 7,
        riders_awaiting_review: 2,
        open_support_tickets: 3,
        financials: {
          currency: "NGN",
          revenue_minor: 150000,
          wallet_liability_minor: 500000,
          escrow_liability_minor: 250000,
        },
      });
    if (path === "/v1/admin/referrals/links" && req.method === "GET")
      return respond(res, 200, { links: [] });
    if (path === "/v1/admin/referrals/links" && req.method === "POST") {
      if (failOnce) {
        failOnce = false;
        return respond(res, 503, {
          error: { code: "busy", message: "Please retry unchanged details" },
        });
      }
      return respond(res, 200, {
        id: "link-1",
        name: body.name,
        code: "L-example",
        landing_url: "http://127.0.0.1:4319/r/L-example",
      });
    }
    if (path.startsWith("/v1/admin/reports/")) {
      res.writeHead(200, {
        "content-type": "text/csv",
        "content-disposition": 'attachment; filename="accounts.csv"',
        ...(url.searchParams.has("after")
          ? {}
          : { "x-next-cursor": "report-page-2" }),
        "x-report-rows": "1",
      });
      return res.end("id,display_name\nu1,Example\n");
    }
    if (path === "/v1/shipments")
      return respond(res, 200, {
        shipments: [
          {
            id: "shipment-1",
            tracking_code: "PND-001",
            kind: "customs",
            fulfillment: "pickup_delivery",
            status: "placed",
            customer_id: "customer-1",
          },
        ],
      });
    if (path === "/v1/shipments/shipment-1")
      return respond(res, 200, {
        id: "shipment-1",
        tracking_code: "PND-001",
        kind: "customs",
        fulfillment: "pickup_delivery",
        status: "placed",
        customer_id: "customer-1",
        due_minor: 150000,
        paid_minor: 0,
        currency: "NGN",
        version: 3,
        charges: [{ id: "charge-1", status: "due", amount_minor: 150000 }],
      });
    if (path === "/v1/shipments/shipment-1/tracking")
      return respond(res, 200, { events: [], version: 3 });
    if (path === "/v1/admin/payments/webhook-receipts")
      return respond(res, 200, {
        data: {
          items: [
            {
              id: "receipt-1",
              event: "charge.success",
              reference: "payment-1",
              status: "quarantined",
              attempts: 2,
              replayCount: 0,
            },
          ],
          nextCursor: null,
        },
        requestId: "request-test",
      });
    if (path === "/v1/admin/support/tickets")
      return respond(res, 200, {
        tickets: [
          {
            id: "ticket-1",
            user_id: "user-1",
            subject: "Where is my order?",
            status: "open",
            latest_message: {
              body: "Please help",
              sender: { display_name: "Customer" },
            },
          },
        ],
        next_cursor: "",
      });
    if (
      path === "/v1/support/tickets/ticket-1/messages" &&
      req.method === "GET"
    )
      return respond(res, 200, {
        messages: [
          {
            id: "m1",
            sender_id: "user-1",
            body: "Please help",
            created_at: "2026-11-01T10:00:00Z",
          },
        ],
        next_cursor: "",
      });
    if (path === "/v1/admin/riders/user-1")
      return respond(res, 200, {
        user_id: "user-1",
        status: "pending",
        document_asset_ids: [],
        vehicle_type: "motorcycle",
      });
    if (path === "/v1/admin/analytics/ride-counts")
      return respond(
        res,
        403,
        { error: { code: "forbidden", message: "Access denied" } },
        { "x-request-id": "permission-test" },
      );
    if (path === "/v1/shipping/offices")
      return respond(res, 200, { offices: [] });
    if (path === "/v1/admin/geography/tariffs")
      return respond(res, 200, { tariffs: [] });
    if (path === "/v1/geography/states")
      return respond(res, 200, { states: [] });
    if (req.method === "POST" || req.method === "PUT")
      return respond(res, 200, {
        id: "saved-1",
        status: body.status || "saved",
      });
    return respond(res, 404, {
      error: { code: "not_found", message: "No matching test fixture" },
    });
  })
  .listen(4319);

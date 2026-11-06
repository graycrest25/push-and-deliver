let options = {},
  receipts = new Map(),
  links = new Map();
export function resetEngagement() {
  options = {};
  receipts = new Map();
  links = new Map([
    [
      "document-one",
      {
        documentId: "document-one",
        name: "ExistingPromoter",
        code: "MiXeDcode",
        shortUrl: "https://example.test/r/MiXeDcode",
        expiresAt: "2026-12-06T12:00:00Z",
        active: true,
        referralsCount: 7,
      },
    ],
  ]);
}
resetEngagement();
export function controlEngagement(body) {
  Object.assign(options, body);
}
export function engagementState() {
  return { operations: receipts.size };
}
export async function engagement(path, req, res, body, success, error, role) {
  if (
    path !== "/v1/admin/notifications/broadcasts" &&
    !path.startsWith("/v1/admin/referrals/links")
  )
    return false;
  if (!["super", "regular"].includes(role)) {
    error(
      res,
      403,
      "forbidden",
      "This administrator cannot use this operation.",
    );
    return true;
  }
  if (req.method === "GET") {
    const query = new URL(req.url, "http://localhost").searchParams;
    success(res, {
      items: query.has("cursor") ? [] : [...links.values()],
      nextCursor: query.has("cursor") ? null : "promoter-next",
    });
    return true;
  }
  const key = req.headers["idempotency-key"];
  if (!key) {
    error(res, 400, "missing_key", "Operation key required");
    return true;
  }
  const signature = `${req.method}:${path}:${JSON.stringify(body)}`;
  const receipt = receipts.get(key);
  if (receipt) {
    if (receipt.signature !== signature)
      error(res, 409, "conflict", "Key reused with different details");
    else success(res, receipt.data, receipt.status);
    return true;
  }
  let data,
    status = 200;
  if (path === "/v1/admin/notifications/broadcasts") {
    if (
      !["rider", "customer", "all"].includes(body.audience) ||
      !body.title?.trim() ||
      Buffer.byteLength(body.title) > 160 ||
      !body.body?.trim() ||
      Buffer.byteLength(body.body) > 4000 ||
      Object.keys(body).length !== 3
    ) {
      error(res, 400, "invalid_request", "Invalid broadcast");
      return true;
    }
    if (options.broadcastDelayMs)
      await new Promise((resolve) =>
        setTimeout(resolve, options.broadcastDelayMs),
      );
    data = { id: "broadcast-one", status: "queued" };
    status = 202;
  } else if (path.endsWith("/status")) {
    const id = decodeURIComponent(path.split("/").at(-2));
    const row = links.get(id);
    if (!row) {
      error(res, 404, "not_found", "Promoter link missing");
      return true;
    }
    if (Object.keys(body).length !== 1 || typeof body.active !== "boolean") {
      error(res, 400, "invalid_request", "Only active can be changed");
      return true;
    }
    row.active = body.active;
    data = { ...row };
  } else {
    if (
      !/^[A-Za-z0-9]{1,100}$/.test(body.name) ||
      Object.keys(body).length !== 1
    ) {
      error(res, 400, "invalid_request", "Invalid promoter name");
      return true;
    }
    data = {
      documentId: "created-document",
      name: body.name,
      code: "LaGoS01AbC",
      shortUrl: "https://example.test/r/LaGoS01AbC",
      expiresAt: "2026-12-06T12:00:00Z",
      active: true,
      referralsCount: 0,
    };
    links.set(data.documentId, data);
    status = 201;
  }
  receipts.set(key, { signature, data: structuredClone(data), status });
  if (
    path === "/v1/admin/notifications/broadcasts" &&
    options.broadcastFailOnce
  ) {
    options.broadcastFailOnce = false;
    error(
      res,
      503,
      "temporarily_unavailable",
      "Broadcast response was lost. Retry unchanged.",
    );
    return true;
  }
  if (path === "/v1/admin/referrals/links" && options.promoterPendingOnce) {
    options.promoterPendingOnce = false;
    res.setHeader("Retry-After", "1");
    error(
      res,
      503,
      "referral_pending",
      "Referral creation is pending. Retry unchanged.",
    );
    return true;
  }
  success(res, data, status);
  return true;
}

let options = {};
export function resetReads() {
  options = {};
}
export function controlReads(body) {
  Object.assign(options, body);
}
export function reads(path, req, res, body, success, error, adminType) {
  const isRead =
    /^\/v1\/admin\/(users(?:\/[^/]+)?|reports\/(accounts|riders)|rides(?:\/[^/]+)?|shipping\/(settings|offices|countries|tariffs)(?:\/[^/]+)?(?:\/(rates|countries|snapshot))?|geography\/(states|tariffs)(?:\/[^/]+)?(?:\/(rates|snapshot))?|audit|analytics\/(coverage|backfills))$/.test(
      path,
    ) && !path.endsWith("/role");
  if (!isRead) return false;
  const superOnly = path.endsWith("/audit") || path.includes("/analytics/");
  if (adminType !== "super" && (adminType !== "regular" || superOnly)) {
    error(res, 403, "forbidden", "This administrator cannot access this read.");
    return true;
  }
  const q = new URL(req.url, "http://localhost").searchParams;
  const detail = /\/(users|offices|countries|tariffs)\/[^/]+$/.test(path);
  const allowed =
    path === "/v1/admin/analytics/coverage"
      ? ["report"]
      : path === "/v1/admin/analytics/backfills"
        ? []
        : path === "/v1/admin/users" || path === "/v1/admin/users/search"
          ? ["type", "limit", "cursor", "membership", "adminType", "q"]
          : path.startsWith("/v1/admin/users/")
            ? ["type"]
            : path.includes("/reports/")
              ? path.endsWith("/riders")
                ? ["format", "limit", "cursor"]
                : ["type", "format", "limit", "cursor"]
              : detail ||
                  (/^\/v1\/admin\/rides\/[^/]+$/.test(path) &&
                    !path.endsWith("/fares"))
                ? []
                : path === "/v1/admin/rides"
                  ? ["status", "city", "limit", "cursor"]
                  : ["includeInactive", "limit", "cursor"];
  if ([...q.keys()].some((k) => !allowed.includes(k))) {
    error(res, 400, "invalid_query", "Unsupported native read query");
    return true;
  }
  const paged = (items) => ({ items, nextCursor: null, hasMore: false });
  const account = (type, second = false) => ({
    id: `${type === "riders" ? "rider" : "user"}-${second ? "2" : "1"}`,
    uid: `${type === "riders" ? "rider" : "user"}-${second ? "2" : "1"}`,
    accountType: type === "riders" ? "rider" : "user",
    username: second
      ? "Second account"
      : type === "riders"
        ? "Native Rider"
        : "Native User",
    email: second ? null : "profile@example.test",
    phoneNumber: null,
    identityExists: !second,
    emailVerified: second ? null : true,
    disabled: second ? null : false,
    deleted: false,
    verificationStatus: options.verificationStatus ?? null,
    createdAt: "2026-11-03T07:00:00Z",
  });
  if (
    path === "/v1/admin/users" ||
    path.startsWith("/v1/admin/users/") ||
    path.includes("/reports/")
  ) {
    const type = path.endsWith("/reports/riders")
      ? "riders"
      : q.get("type") || "users";
    if (!["users", "riders"].includes(type)) {
      error(res, 400, "type", "Invalid directory type");
      return true;
    }
    const row = account(type, q.has("cursor"));
    if (
      q.has("q") &&
      ["/v1/admin/users", "/v1/admin/users/search"].includes(path)
    ) {
      const second = q.has("cursor");
      success(res, {
        items: [
          { ...row, username: `${q.get("q")} ${second ? "Older" : "Newest"}` },
        ],
        nextCursor: second ? null : "name-next",
        hasMore: !second,
      });
    } else if (path.startsWith("/v1/admin/users/"))
      success(res, account(type, path.endsWith("-2")));
    else if (q.get("format") === "csv") {
      res.writeHead(200, {
        "content-type": "text/csv",
        "x-next-cursor": q.has("cursor") ? "" : `export-${type}`,
      });
      res.end(
        `uid,accountType,username\n${row.uid},${row.accountType},${row.username}\n`,
      );
    } else
      success(res, {
        items: [row],
        nextCursor: q.has("cursor") ? null : `directory-${type}`,
        hasMore: !q.has("cursor"),
      });
  } else if (
    path === "/v1/admin/rides/fares" ||
    path === "/v1/admin/shipping/settings"
  )
    success(
      res,
      paged([
        {
          id: "fee-1",
          name: "Distance fee",
          currency: "NGN",
          moneyUnit: "major",
          feeType: 4,
          value: 25.5,
          perKm: 25.5,
          perMin: null,
          perWeight: null,
          minFare: null,
          bookingFee: null,
          surgeMultiplier: 1.2,
          addedSurge: null,
          invalidFields: [],
        },
      ]),
    );
  else if (path.startsWith("/v1/admin/rides")) {
    const row = {
      id: "ride-1",
      service: "ridehailing",
      originCity: q.get("city") || "lagos",
      rideType: "standard",
      status: "accepted",
      customerId: "customer-1",
      canCancel: false,
      assignedRider: null,
      pricing: { totalAmountMinor: 250000, currency: "NGN" },
      payment: { status: "paid", method: "wallet" },
      createdAt: "2026-11-03T07:00:00Z",
    };
    success(res, path === "/v1/admin/rides" ? paged([row]) : row);
  } else if (path === "/v1/admin/audit")
    success(
      res,
      paged([
        {
          id: "roles:change-1",
          source: "roles",
          actor: "dashboard:admin-1",
          targetUid: "target-1",
          adminType: "regular",
          createdAt: "2026-11-03T07:00:00Z",
        },
      ]),
    );
  else if (path === "/v1/admin/analytics/coverage")
    success(res, {
      report: q.get("report"),
      coverage: {
        complete: false,
        basis: "active_postgres_records",
        timezone: "Africa/Lagos",
        updatedAt: null,
      },
      lastBackfill: null,
    });
  else if (path === "/v1/admin/analytics/backfills") {
    if (
      req.method !== "POST" ||
      !req.headers["idempotency-key"] ||
      Object.keys(body).some((key) => !["report", "resume"].includes(key))
    ) {
      error(res, 400, "invalid", "Invalid rebuild command");
      return true;
    }
    success(
      res,
      {
        jobId: "rebuild-1",
        jobType: "analytics.backfill",
        status: "pending",
        statusUrl: "/v1/operations/rebuild-1",
        report: body.report,
      },
      202,
    );
  } else if (path.endsWith("/rates"))
    success(
      res,
      paged([
        {
          tariffId: "tariff-1",
          zone: 1,
          weightGrams: 500,
          amountMinor: 150000,
          currency: "NGN",
        },
      ]),
    );
  else if (/\/tariffs\/[^/]+\/countries$/.test(path))
    success(
      res,
      paged([{ code: "NG", zone: 1, name: "Nigeria", active: true }]),
    );
  else if (path.includes("/shipping/offices")) {
    const row = {
      id: "office-1",
      name: "Lagos office",
      address: "Example address",
      latitude: 6.5,
      longitude: 3.3,
      basePickupMinor: 100000,
      perKmMinor: 20000,
      currency: "NGN",
      active: true,
    };
    success(res, path.endsWith("/offices") ? paged([row]) : row);
  } else if (path.includes("/shipping/countries")) {
    const row = {
      id: "NG",
      code: "NG",
      name: "Nigeria",
      active: true,
      postalCodeRequired: null,
    };
    success(res, path.endsWith("/countries") ? paged([row]) : row);
  } else if (path.endsWith("/states"))
    success(res, paged([{ id: "state-1", name: "Lagos", localZone: "1" }]));
  else if (path.includes("/tariffs")) {
    const row = path.includes("/geography/")
      ? {
          id: "local-1",
          localType: "within_state",
          zone: 1,
          status: "active",
          volumetricDivisor: 5000,
        }
      : {
          id: "tariff-1",
          name: "International tariff",
          carrier: "example",
          direction: "export",
          cargo: "non_document",
          status: "active",
          historical: false,
          volumetricDivisor: 5000,
        };
    success(
      res,
      path.endsWith("/tariffs")
        ? paged([row])
        : path.endsWith("/snapshot")
          ? {
              ...row,
              version: 2,
              rates: [{ zone: 1, weightGrams: 500, amountMinor: 150000 }],
              countries: [{ code: "NG", name: "Nigeria", zone: 1 }],
            }
          : row,
    );
  } else error(res, 404, "not_found", "Not implemented by read fixture");
  return true;
}

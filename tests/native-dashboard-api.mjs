let state;
export function resetDashboard() {
  state = {
    adminType: undefined,
    campaigns: [
      {
        id: "campaign-1",
        title: "Welcome",
        percentageDiscount: 10,
        validForHours: 24,
        eligibleServices: ["courier"],
        enabled: true,
        version: 2,
      },
    ],
    signup: {
      enabled: true,
      campaignIds: ["campaign-1"],
      selection: "selected",
      version: 3,
    },
    funding: {
      enabled: true,
      amountMinor: 50000,
      budgetMinor: 1000000,
      spentMinor: 250000,
      remainingMinor: 750000,
      currency: "NGN",
      version: 4,
    },
    role: {
      uid: "target-1",
      email: "target@example.test",
      isAdmin: true,
      adminType: "regular",
      version: 2,
    },
    ticket: {
      id: "ticket-1",
      customerUid: "customer-1",
      status: "open",
      version: 2,
      assignedSupportUid: null,
      unreadCount: 1,
      lastMessage: "Help with delivery",
      updatedAt: "2026-11-02T10:00:00Z",
    },
    messages: [
      {
        id: "legacy-message",
        senderRole: "user",
        message: "Old attachment",
        createdAt: "2026-11-02T09:00:00Z",
        attachment: null,
        attachmentUnavailable: true,
      },
      {
        id: "message-1",
        senderRole: "user",
        message: "Help with delivery",
        createdAt: "2026-11-02T10:00:00Z",
        attachment: {
          assetId: "asset-private",
          contentType: "application/pdf",
          downloadUrl: "https://private.example.test/secret",
        },
      },
    ],
    releases: {},
    missingRelease: false,
    invalidRelease: false,
    failWrite: false,
    conflict: false,
    receipts: new Map(),
  };
}
resetDashboard();
export function controlDashboard(body) {
  if (body.ticketStatus) state.ticket.status = body.ticketStatus;
  for (const key of [
    "adminType",
    "failWrite",
    "conflict",
    "missingRelease",
    "invalidRelease",
  ])
    if (Object.hasOwn(body, key)) state[key] = body[key];
}
export function membership() {
  return state.adminType === undefined
    ? {}
    : { isAdmin: state.adminType !== null, adminType: state.adminType };
}
export function dashboard(path, req, res, body, success, error) {
  const isRelease = path === "/v1/config/mobile";
  if (
    !isRelease &&
    !/^\/v1\/admin\/(coupons|support|config|users\/[^/]+\/role)(\/|$)/.test(
      path,
    )
  )
    return false;
  const write = req.method !== "GET";
  const params = new URL(req.url, "http://localhost").searchParams;
  const send = (data) => success(res, data);
  const fail = (status, code, message) => error(res, status, code, message);
  if (
    !isRelease &&
    !(
      state.adminType === "super" ||
      (state.adminType === "regular" && /\/coupons|\/support/.test(path)) ||
      (state.adminType === "customercare" && path.includes("/support"))
    )
  ) {
    fail(403, "forbidden", "This role cannot use this module.");
    return true;
  }
  const key = req.headers["idempotency-key"];
  if (write && !key) {
    fail(400, "missing_key", "Missing operation key");
    return true;
  }
  if (write && state.conflict) {
    state.conflict = false;
    fail(409, "version_conflict", "Record changed; refresh before saving.");
    return true;
  }
  const signature = JSON.stringify([path, body]);
  if (write && state.receipts.has(key)) {
    const previous = state.receipts.get(key);
    if (previous.signature !== signature)
      fail(409, "key_conflict", "Key belongs to another command");
    else send(previous.data);
    return true;
  }
  const save = (data) => {
    state.receipts.set(key, { signature, data: structuredClone(data) });
    if (state.failWrite) {
      state.failWrite = false;
      fail(503, "lost_response", "Response lost. Retry the same action.");
    } else send(data);
  };
  const versioned = (record) => {
    if (body.expectedVersion !== record.version) {
      fail(409, "version_conflict", "Record changed; refresh before saving.");
      return false;
    }
    record.version++;
    return true;
  };
  const exact = (keys) => {
    const valid =
      Object.keys(body).every((k) => keys.includes(k)) &&
      keys.every((k) => Object.hasOwn(body, k));
    if (!valid)
      fail(400, "invalid_body", "Unexpected or missing request fields");
    return valid;
  };
  const page = (items) => ({ items, nextCursor: null, hasMore: false });
  if (isRelease || path.startsWith("/v1/admin/config/mobile")) {
    const app = isRelease ? params.get("app") : path.split("/")[5],
      platform = isRelease ? params.get("platform") : path.split("/")[6];
    const id = `${app}:${platform}`;
    state.releases[id] ||= {
      app,
      platform,
      latestVersion: "2.0.0",
      minimumSupportedVersion: "1.0.0",
      storeUrl:
        platform === "ios"
          ? "https://apps.apple.com/ng/app/test/id123"
          : "https://play.google.com/store/apps/details?id=test.app",
      forceUpdate: false,
      maintenance: { enabled: false, message: null },
      features: Object.fromEntries(
        [
          "rides",
          "courier",
          "food",
          "ecommerce",
          "internationalShipping",
          "localShipping",
          "customsClearance",
          "game",
        ].map((k) => [k, true]),
      ),
      version: 2,
    };
    const record = state.releases[id];
    if (!write && path.startsWith("/v1/admin/config/mobile"))
      send({
        app,
        platform,
        configured: !state.missingRelease && !state.invalidRelease,
        version: state.missingRelease ? 0 : record.version,
        configuration:
          state.missingRelease || state.invalidRelease ? null : record,
        reason: state.missingRelease
          ? "missing"
          : state.invalidRelease
            ? "invalid"
            : null,
      });
    else if (!write) send(record);
    else if (
      exact([
        "latestVersion",
        "minimumSupportedVersion",
        "storeUrl",
        "forceUpdate",
        "maintenance",
        "features",
        "expectedVersion",
      ]) &&
      (state.missingRelease ? body.expectedVersion === 0 : versioned(record))
    ) {
      const { expectedVersion, ...values } = body;
      Object.assign(record, values);
      if (state.missingRelease) record.version = 1;
      state.missingRelease = false;
      state.invalidRelease = false;
      save(record);
    }
  } else if (path.endsWith("/role")) {
    if (!write) send(state.role);
    else if (
      exact(["adminType", "expectedVersion", "reason"]) &&
      versioned(state.role)
    ) {
      state.role.adminType = body.adminType;
      state.role.isAdmin = body.adminType !== null;
      save(state.role);
    }
  } else if (path === "/v1/admin/coupons/campaigns") {
    if (!write) send(page(state.campaigns));
    else if (
      exact([
        "title",
        "percentageDiscount",
        "validForHours",
        "eligibleServices",
        "enabled",
      ])
    ) {
      const record = { ...body, id: "campaign-2", version: 1 };
      state.campaigns.push(record);
      save(record);
    }
  } else if (/\/campaigns\/[^/]+\/status$/.test(path)) {
    const record = state.campaigns.find((c) => c.id === path.split("/")[5]);
    if (record && exact(["enabled", "expectedVersion"]) && versioned(record)) {
      record.enabled = body.enabled;
      save(record);
    }
  } else if (path.endsWith("/grants")) {
    if (exact(["uid", "campaignId"]))
      save({
        id: "coupon-1",
        uid: body.uid,
        campaignId: body.campaignId,
        code: "WELCOME-UNIQUE",
        expiresAt: "2026-11-03T10:00:00Z",
      });
  } else if (path.endsWith("/signup/settings")) {
    if (!write) send(state.signup);
    else if (
      exact(["enabled", "campaignIds", "expectedVersion"]) &&
      versioned(state.signup)
    ) {
      state.signup.enabled = body.enabled;
      state.signup.campaignIds = body.campaignIds;
      save(state.signup);
    }
  } else if (path.endsWith("/signup/jobs"))
    send(
      page([
        {
          id: "signup-job-1",
          uid: "customer-1",
          jobType: "user.signup-coupon.issue",
          status: "dead",
          generation: 3,
          attemptCount: 5,
          lastError: "Provider unavailable",
        },
      ]),
    );
  else if (path.endsWith("/requeue")) {
    if (exact(["jobId", "expectedGeneration", "reason"]))
      save({ id: body.jobId, generation: 4, status: "pending" });
  } else if (path.includes("/config/signup")) {
    if (!write) send(state.funding);
    else if (
      exact(["enabled", "amountMinor", "budgetMinor", "expectedVersion"]) &&
      versioned(state.funding)
    ) {
      Object.assign(state.funding, {
        enabled: body.enabled,
        amountMinor: body.amountMinor,
        budgetMinor: body.budgetMinor,
        remainingMinor: body.budgetMinor - state.funding.spentMinor,
      });
      save(state.funding);
    }
  } else if (path === "/v1/admin/support/tickets") send(page([state.ticket]));
  else if (path.endsWith("/messages")) {
    if (!write) send(page(state.messages));
    else if (exact(["message", "clientMessageId"])) {
      const record = {
        ...body,
        senderRole: "support",
        senderId: "admin-1",
        id: "message-2",
        createdAt: new Date().toISOString(),
      };
      state.messages.unshift(record);
      state.ticket.version++;
      save(record);
    }
  } else if (path.endsWith("/claim")) {
    if (exact(["expectedVersion"]) && versioned(state.ticket)) {
      state.ticket.assignedSupportUid = "admin-1";
      save(state.ticket);
    }
  } else if (path.endsWith("/status")) {
    if (req.method !== "PUT") fail(405, "method", "Use PUT");
    else if (exact(["status", "expectedVersion"]) && versioned(state.ticket)) {
      state.ticket.status = body.status;
      save(state.ticket);
    }
  } else send(state.ticket);
  return true;
}

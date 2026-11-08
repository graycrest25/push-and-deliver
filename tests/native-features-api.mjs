let withdrawal, intents, completed, settings, shipment;
export function resetFeatures() {
  shipment = {
    id: "shipment-1",
    shipmentNumber: "PND123",
    shipmentType: "express",
    status: "acceptedByRider",
    version: 3,
    assessmentStatus: "not_required",
    assignedRider: null,
    customerId: "customer-1",
    sender: {
      name: "Customer",
      phone: "+2348000000000",
      email: "customer@example.test",
    },
    receiver: { name: "Receiver" },
    pickup: { address: "Pickup address", latitude: 6.5 },
    dropoff: { address: "Drop-off address" },
    pricing: {
      grossAmountMinor: 35000,
      discountAmountMinor: 0,
      totalAmountMinor: 35000,
      currency: "NGN",
    },
    payment: { status: "paid", method: "wallet", payLater: false },
    assets: { invoiceAssetId: "asset-1" },
    createdAt: "2026-01-01T00:00:00Z",
  };

  withdrawal = {
    id: "withdrawal-1",
    amountMinor: 125000,
    currency: "NGN",
    status: "requested",
    createdAt: "2026-01-01T10:00:00Z",
    updatedAt: "2026-01-01T10:00:00Z",
    assignedAdminId: null,
    assignedToMe: false,
    accountNumberMasked: "******1234",
    receipt: null,
  };
  intents = new Map();
  completed = new Set();
  settings = {};
}
resetFeatures();
export function controlFeatures(body) {
  if (body.shipment) Object.assign(shipment, body.shipment);
  Object.assign(settings, body);
  if (body.assignedToOther)
    Object.assign(withdrawal, {
      status: "approved",
      assignedAdminId: "admin-other",
      assignedToMe: false,
    });
}
export function features(path, req, res, body, success, error) {
  const q = new URL(req.url, "http://localhost").searchParams;
  if (settings.featureUnavailable && path.startsWith("/v1/admin/analytics/")) {
    error(res, 503, "not_ready", "Reporting sources are not ready.");
    return true;
  }
  if (
    [
      "/v1/admin/analytics/rider-weekly-deliveries",
      "/v1/admin/analytics/time-to-first-order",
    ].includes(path)
  ) {
    const rider = path.endsWith("rider-weekly-deliveries");
    const allowed = rider
      ? ["limit", "cursor", "weeks", "endDate"]
      : ["limit", "cursor", "status"];
    if ([...q.keys()].some((key) => !allowed.includes(key))) {
      error(res, 400, "invalid_request", "Unsupported analytics query field");
      return true;
    }
    const limit = Number(q.get("limit") || 25),
      offset = q.has("cursor") ? limit : 0;
    const items = Array.from({ length: rider ? 16 : 26 }, (_, index) =>
      rider
        ? {
            riderId: `rider-${index + 1}`,
            weeks: [
              {
                weekStart: "2026-10-19",
                weekEnd: "2026-10-25",
                completedOrders: index + 1,
              },
              {
                weekStart: "2026-10-26",
                weekEnd: "2026-11-01",
                completedOrders: 2,
              },
            ],
          }
        : {
            userId: `user-${index + 1}`,
            status: index < 13 ? "activated" : "no_orders",
            createdAt: "2026-10-01T10:00:00Z",
            firstOrderAt: index < 13 ? "2026-10-03T10:00:00Z" : null,
            timeToFirstOrderDays: index < 13 ? 2 : null,
          },
    );
    success(res, {
      items: items.slice(offset, offset + limit),
      nextCursor: offset + limit < items.length ? "opaque-report-next" : null,
      coverage: { complete: true },
      ...(rider
        ? { asOfDate: q.get("endDate") || "2026-11-01" }
        : {
            summary: {
              totalUsers: 26,
              eligibleUsers: 26,
              activatedUsers: 13,
              noOrderUsers: 13,
              invalidUsers: 0,
              activationRate: 0.5,
              averageTimeToFirstOrderDays: 2,
            },
          }),
    });
    return true;
  }
  if (path === "/v1/operations/rebuild-1") {
    success(res, { id: "rebuild-1", status: "pending" });
    return true;
  }
  if (path === "/v1/admin/analytics/account-summary") {
    success(res, {
      type: q.get("type"),
      total: 42,
      newToday: 2,
      calculatedAt: "2026-11-02T10:00:00Z",
    });
    return true;
  }
  if (path === "/v1/admin/analytics/order-summary") {
    success(res, {
      type: q.get("type"),
      total: 12,
      paid: 8,
      unpaid: 4,
      unknownPayment: 0,
      totalRevenueMinor: 125000,
      currency: "NGN",
      calculatedAt: "2026-11-02T10:00:00Z",
    });
    return true;
  }
  if (path === "/v1/admin/referrals/summary") {
    success(res, {
      totalReferrals: 25,
      totalReferrers: 12,
      userReferrals: 20,
      riderReferrals: 5,
      unknownTypeReferrals: 0,
      avgReferralsPerReferrer: 2.08,
      calculatedAt: "2026-11-02T10:00:00Z",
    });
    return true;
  }
  if (path === "/v1/admin/referrals/export.csv") {
    res.writeHead(200, {
      "content-type": "text/csv",
      "content-disposition": 'attachment; filename="referrals.csv"',
    });
    res.end("id,referralCodeUsed\nref-1,CODE123\n");
    return true;
  }
  if (path === "/v1/admin/referrals") {
    if (![10, 20, 30, 50, 100].includes(Number(q.get("limit")))) {
      error(res, 400, "invalid_limit", "Unsupported referral limit");
      return true;
    }
    success(res, {
      items: [
        {
          id: q.has("cursor") ? "ref-2" : "ref-1",
          referredUid: "user-1",
          referrerUid: "user-2",
          referreduserType: "user",
          referralCodeUsed: "CODE123",
          createdAt: null,
        },
      ],
      nextCursor: q.has("cursor") ? null : "ref-next",
      hasMore: !q.has("cursor"),
      limit: Number(q.get("limit")),
    });
    return true;
  }
  if (path === "/v1/shipping/local-types") {
    success(res, {
      items: [{ id: "premium", name: "Premium" }],
      nextCursor: null,
      hasMore: false,
    });
    return true;
  }
  if (path === "/v1/shipments") {
    const row = {
      id: "shipment-1",
      originCity: q.get("city") || "lagos",
      shipmentType: "express",
      status: "placed",
      totalAmountMinor: 35000,
      currency: "NGN",
      createdAt: "2026-01-01T00:00:00Z",
    };
    const matches =
      (!q.has("orderId") || q.get("orderId") === row.id) &&
      (!q.has("status") || q.get("status") === row.status) &&
      (!q.has("shipmentType") || q.get("shipmentType") === row.shipmentType);
    const nextCursor =
      q.has("orderId") || q.has("cursor") ? null : "shipment-next";
    success(res, {
      items: matches ? [row] : [],
      nextCursor,
      hasMore: !!nextCursor,
    });
    return true;
  }
  if (path === "/v1/shipments/shipment-1") {
    const allowedAdminActions = [];
    if (shipment.status === "placed" && shipment.assignedRider === null)
      allowedAdminActions.push("accept_at_office");
    if (["placed", "acceptedByRider"].includes(shipment.status))
      allowedAdminActions.push("cancel");
    if (shipment.status === "onRouteToPndHQ")
      allowedAdminActions.push("confirm_arrival");
    const paid =
      shipment.payment?.status === "paid" &&
      ["paid", "not_required"].includes(shipment.assessmentStatus);
    if (shipment.status === "sentToHq" && paid)
      allowedAdminActions.push("dispatch");
    if (shipment.status === "onrouteToDestination" && paid)
      allowedAdminActions.push("complete_delivery");
    success(res, {
      ...shipment,
      nativeWriteEligible: true,
      pendingCommands: { assignment: false, assessment: false },
      allowedAdminActions,
      onwardDeliveryBlockers: paid ? [] : ["customer_payment_required"],
    });
    return true;
  }
  if (path === "/v1/admin/shipments/shipment-1/timeline") {
    success(res, { items: [], nextCursor: null, hasMore: false });
    return true;
  }
  if (
    /^\/v1\/shipments\/shipment-1\/(accept|transitions|cancel)$/.test(path) ||
    path === "/v1/admin/shipments/shipment-1/transitions"
  ) {
    const action = path.split("/").at(-1);
    const allowed =
      action === "accept"
        ? ["expectedVersion"]
        : action === "cancel"
          ? ["expectedVersion", "reason"]
          : ["expectedVersion", "targetStatus"];
    if (
      req.method !== "POST" ||
      !req.headers["idempotency-key"] ||
      Object.keys(body).some((key) => !allowed.includes(key))
    ) {
      error(res, 400, "invalid_request", "Wrong shipment command");
      return true;
    }
    if (body.expectedVersion !== shipment.version) {
      error(
        res,
        409,
        "version_conflict",
        "Shipment changed. Refresh before retrying.",
      );
      return true;
    }
    if (settings.shipmentConflict) {
      settings.shipmentConflict = false;
      shipment.version++;
      error(
        res,
        409,
        "version_conflict",
        "Shipment changed. Refresh before retrying.",
      );
      return true;
    }
    const next =
      action === "accept"
        ? "sentToHq"
        : action === "cancel"
          ? "cancelled"
          : body.targetStatus;
    const permitted =
      action === "accept"
        ? shipment.status === "placed" && shipment.assignedRider === null
        : action === "cancel"
          ? ["placed", "acceptedByRider"].includes(shipment.status) &&
            !!body.reason?.trim()
          : {
              onRouteToPndHQ: "sentToHq",
              sentToHq: "onrouteToDestination",
              onrouteToDestination: "deliveredToDestination",
            }[shipment.status] === next;
    if (
      !permitted ||
      (["onrouteToDestination", "deliveredToDestination"].includes(next) &&
        (shipment.payment?.status !== "paid" ||
          shipment.assessmentStatus === "assessed"))
    ) {
      error(
        res,
        409,
        "invalid_transition",
        "Shipment cannot move to that status",
      );
      return true;
    }
    shipment.status = next;
    shipment.version++;
    success(res, {
      id: shipment.id,
      status: next,
      version: shipment.version,
      updatedAt: "2026-11-03T09:00:00Z",
    });
    return true;
  }
  if (path === "/v1/shipments/shipment-1/tracking") {
    success(res, { stale: true, location: null });
    return true;
  }
  if (path === "/v1/admin/withdrawals") {
    success(res, {
      items: [withdrawal],
      nextCursor: q.has("cursor") ? null : "withdrawal-next",
    });
    return true;
  }
  if (path === "/v1/admin/withdrawals/withdrawal-1") {
    success(res, withdrawal);
    return true;
  }
  if (path === "/v1/admin/withdrawals/withdrawal-1/bank-details") {
    if (!withdrawal.assignedToMe)
      error(res, 403, "forbidden", "Assigned administrator required");
    else
      success(res, {
        withdrawalId: withdrawal.id,
        amountMinor: withdrawal.amountMinor,
        currency: "NGN",
        bankName: "Fixture Bank",
        accountNumber: "0123451234",
        accountName: "Fixture Rider",
        bankCode: "001",
      });
    return true;
  }
  if (path === "/v1/admin/withdrawals/withdrawal-1/approve") {
    Object.assign(withdrawal, {
      status: "approved",
      assignedAdminId: "admin-1",
      assignedToMe: true,
    });
    success(res, { id: withdrawal.id, status: withdrawal.status });
    return true;
  }
  if (path === "/v1/admin/withdrawals/withdrawal-1/reject") {
    withdrawal.status = "cancelled";
    success(res, { id: withdrawal.id, status: withdrawal.status });
    return true;
  }
  if (path === "/v1/admin/withdrawals/withdrawal-1/mark-successful") {
    if (settings.paymentLostOnce) {
      settings.paymentLostOnce = false;
      error(
        res,
        503,
        "retry",
        "Payment recording temporarily unavailable. Retry the same request.",
      );
      return true;
    }
    Object.assign(withdrawal, {
      status: "succeeded",
      receipt: {
        ...body,
        confirmedBy: "admin-1",
        recordedAt: new Date().toISOString(),
      },
    });
    success(res, { id: withdrawal.id, status: withdrawal.status });
    return true;
  }
  if (path === "/v1/admin/jobs") {
    success(res, {
      items: [
        {
          jobId: "job-1",
          jobType: "asset.process",
          status: "dead",
          attemptCount: 3,
          generation: 2,
        },
      ],
      nextCursor: q.has("cursor") ? null : "job-next",
    });
    return true;
  }
  if (path === "/v1/admin/jobs/job-1") {
    success(res, {
      jobId: "job-1",
      jobType: "asset.process",
      status: settings.jobReplayed ? "pending" : "dead",
      generation: settings.jobReplayed ? 3 : 2,
      attempts: [{ number: q.has("attemptsCursor") ? 1 : 3, status: "failed" }],
      attemptsNextCursor: q.has("attemptsCursor") ? null : "attempt-next",
    });
    return true;
  }
  if (path === "/v1/admin/jobs/job-1/replay") {
    settings.jobReplayed = true;
    success(
      res,
      {
        jobId: "job-1",
        status: "pending",
        generation: 3,
        dedupKeyPreserved: true,
      },
      202,
    );
    return true;
  }
  if (path === "/v1/assets/upload-intents") {
    const key = req.headers["idempotency-key"];
    if (!intents.has(key))
      intents.set(key, { assetId: `asset-${intents.size + 1}`, ...body });
    const intent = intents.get(key);
    success(
      res,
      {
        assetId: intent.assetId,
        status: "awaiting_upload",
        uploadUrl: `https://uploads.example.test/storage/${intent.assetId}`,
        method: "PUT",
        headers: {
          "Content-Type": body.contentType,
          "x-amz-checksum-sha256": body.checksumSha256,
        },
        expiresAt: new Date(Date.now() + 300000).toISOString(),
        maxSizeBytes: 10485760,
      },
      201,
    );
    return true;
  }
  if (/^\/v1\/assets\/[^/]+\/complete$/.test(path)) {
    const id = path.split("/")[3];
    const intent = [...intents.values()].find((v) => v.assetId === id);
    if (completed.has(id))
      success(res, {
        assetId: id,
        status: "ready",
        contentType: intent.contentType,
        sizeBytes: intent.sizeBytes,
        checksumSha256: intent.checksumSha256,
      });
    else
      success(
        res,
        {
          assetId: id,
          status: "pending",
          jobId: `process-${id}`,
          statusUrl: `/v1/operations/process-${id}`,
        },
        202,
      );
    return true;
  }
  if (path.startsWith("/v1/operations/process-")) {
    const id = path.slice("/v1/operations/process-".length);
    completed.add(id);
    success(res, {
      jobId: `process-${id}`,
      status: settings.failAsset ? "failed" : "succeeded",
      result: { assetId: id },
    });
    return true;
  }
  if (req.method === "DELETE" && path.startsWith("/v1/assets/")) {
    success(res, { assetId: path.split("/")[3], status: "pending" }, 202);
    return true;
  }
  if (path.startsWith("/v1/media/")) {
    res.writeHead(307, { location: "http://127.0.0.1/private-file" });
    res.end();
    return true;
  }
  return false;
}

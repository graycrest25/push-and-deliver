let state;
export function resetLatest() {
  state = {
    enabled: false,
    conflict: false,
    profileVersion: 7,
    applicationVersion: 17,
    completionChecks: 0,
    attached: false,
    profile: {
      username: "Native Rider",
      email: "profile@example.test",
      phoneNumber: "+2348000000000",
      homeAddress: "Example street",
    },
    vehicle: {
      type: 2,
      make: "Example",
      model: "Bike",
      color: "Blue",
      plateNumber: "ABC123",
    },
    applicationStatus: "pending",
    reviews: [],
    fee: {
      id: "fee-1",
      name: "Courier pricing",
      feeType: 6,
      version: 3,
      currency: "NGN",
      updatedAt: "2026-11-03T10:00:00Z",
      editable: true,
      values: {
        valueMinor: 150000,
        perKmMinor: 25000,
        addedSurgeMultiplier: 1.2,
      },
      units: {
        valueMinor: "minor",
        perKmMinor: "minor",
        addedSurgeMultiplier: "multiplier",
      },
      invalidFields: [],
    },
    tariffs: {},
    shipments: {},
    uploads: new Map(),
  };
}
resetLatest();
export function controlLatest(body) {
  if (body.latest) state.enabled = true;
  if (body.latestConflict) state.conflict = true;
  if (body.latestShipment)
    state.shipments[body.latestShipment.id] = body.latestShipment;
  if (body.latestTariff)
    state.tariffs[body.latestTariff.id] = body.latestTariff;
  if (body.latestVehicle) Object.assign(state.vehicle, body.latestVehicle);
  if (body.latestFee) Object.assign(state.fee, body.latestFee);
}
const page = (items) => ({ items, nextCursor: null, hasMore: false });
function account(uid, type = "riders") {
  return {
    id: uid,
    uid,
    accountType: type === "riders" ? "rider" : "user",
    ...state.profile,
    identityExists: true,
    emailVerified: true,
    disabled: false,
    deleted: false,
    verificationStatus: 0,
    createdAt: "2026-01-01T10:00:00Z",
    version: state.profileVersion,
    profile: {
      dateOfBirth: "1990-01-01",
      homeAddress: state.profile.homeAddress,
      stateOfOrigin: "Lagos",
      localGovernment: "Ikeja",
      photoAssetId: null,
      nextOfKin: {
        name: "Contact",
        phoneNumber: "+2348000000001",
        address: "Lagos",
      },
    },
    vehicle: type === "riders" ? state.vehicle : null,
  };
}
function tariff(id, domestic) {
  return (state.tariffs[id] ||= {
    id,
    version: 1,
    status: id.includes("active") ? "active" : "draft",
    volumetricDivisor: 0,
    interpolationRoundingMinor: 1,
    createdAt: "2026-11-03T10:00:00Z",
    updatedAt: "2026-11-03T10:00:00Z",
    publishedAt: null,
    rateCount: 2,
    ...(domestic
      ? { localType: "premium", zone: "los" }
      : {
          name: "Reviewed export",
          carrier: "dhl",
          direction: "export",
          cargo: "non_document",
          historical: false,
          countryCount: 1,
          countries: [{ code: "GB", zone: 1 }],
        }),
    rates: [
      {
        ...(!domestic ? { zone: 1 } : {}),
        weightGrams: 500,
        amountMinor: 150000,
      },
      {
        ...(!domestic ? { zone: 1 } : {}),
        weightGrams: domestic ? 70000 : 1000,
        amountMinor: 9000000,
      },
    ],
  });
}
export function latest(path, req, res, body, success, error, role) {
  if (!state.enabled) return false;
  const q = new URL(req.url, "http://localhost").searchParams;
  const write = req.method !== "GET";
  const reply = (data) => {
    success(res, data);
    return true;
  };
  const deny = (message) => {
    error(res, 403, "forbidden", message);
    return true;
  };
  const validate = (data) => {
    if (!req.headers["idempotency-key"]) {
      error(res, 400, "missing_key", "An operation key is required.");
      return false;
    }
    if (state.conflict) {
      state.conflict = false;
      data.version++;
      error(
        res,
        409,
        "conflict",
        "This record changed. Review the latest values.",
      );
      return false;
    }
    if (data && body.expectedVersion !== data.version) {
      error(res, 409, "conflict", "Incorrect current version.");
      return false;
    }
    return true;
  };
  if (path === "/v1/admin/users" && q.has("membership")) {
    if (role !== "super") return deny("Membership filters require super.");
    return reply(
      page([
        {
          ...account("user-1", "users"),
          isAdmin: q.get("membership") === "admins",
          adminType: q.get("membership") === "admins" ? "regular" : null,
        },
      ]),
    );
  }
  const user = path.match(
    /^\/v1\/admin\/users\/([^/]+)(?:\/(profile|wallet|transactions|payout-destination))?$/,
  );
  if (user) {
    if (!["super", "regular"].includes(role))
      return deny("Account workflows require operations authority.");
    const [, uid, action] = user,
      type = q.get("type") || "users";
    if (!action) return reply(account(uid, type));
    if (action === "wallet")
      return reply({
        uid,
        accountType: type === "riders" ? "rider" : "user",
        availableMinor: 125000,
        pendingMinor: 25000,
        balanceMinor: 150000,
        currency: "NGN",
        asOf: "2026-11-03T10:00:00Z",
      });
    if (action === "transactions")
      return reply(
        page([
          {
            id: "ledger-1",
            direction: "credit",
            amountMinor: 150000,
            currency: "NGN",
            status: "success",
            narration: "Delivery",
            reference: "TX1",
            reversalOf: null,
            createdAt: "2026-11-03T10:00:00Z",
            orderId: "shipment-1",
            relatedOrder: { id: "shipment-1", type: "shipment" },
          },
        ]),
      );
    if (action === "payout-destination")
      return role === "super"
        ? reply({
            bankName: "Example Bank",
            accountName: "Native Rider",
            accountNumberMasked: "******1234",
            verified: false,
            updatedAt: null,
            source: "legacy_profile",
          })
        : deny("Super only.");
    if (action === "profile") {
      const current = { version: state.profileVersion };
      if (!validate(current)) {
        state.profileVersion = current.version;
        return true;
      }
      Object.assign(state.profile, body.changes);
      state.profileVersion++;
      return reply({
        uid,
        version: state.profileVersion,
        changedFields: Object.keys(body.changes),
        sessionsRevoked: !!body.changes.phoneNumber || !!body.changes.email,
        emailVerificationRequired: !!body.changes.email,
      });
    }
  }
  if (
    [
      "/v1/media/rider-evidence/content",
      "/v1/media/delegated-asset/content",
    ].includes(path)
  ) {
    res.writeHead(200, { "content-type": "image/png" });
    res.end(
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aA5sAAAAASUVORK5CYII=",
        "base64",
      ),
    );
    return true;
  }
  const rider = path.match(
    /^\/v1\/admin\/riders\/([^/]+)\/(vehicle|application)(.*)$/,
  );
  if (path === "/v1/admin/riders/applications")
    return ["super", "regular", "verifier"].includes(role)
      ? reply(
          page([
            {
              uid: "rider-1",
              username: "Native Rider",
              applicationId: "rider-1",
              status: state.applicationStatus,
              submittedAt: "2026-11-03T10:00:00Z",
            },
          ]),
        )
      : deny("Review access required.");
  if (rider) {
    if (!["super", "regular", "verifier"].includes(role))
      return deny("Review access required.");
    const [, uid, action, suffix] = rider;
    if (action === "vehicle") {
      if (role === "verifier")
        return deny("Vehicle editing requires operations.");
      if (!validate({ version: state.applicationVersion })) return true;
      Object.assign(state.vehicle, body.changes);
      state.applicationVersion++;
      state.profileVersion++;
      state.applicationStatus = "pending";
      return reply({
        uid,
        version: state.profileVersion,
        changedFields: Object.keys(body.changes),
        vehicle: state.vehicle,
        emailVerificationRequired: false,
        sessionsRevoked: false,
      });
    }
    if (!suffix)
      return reply({
        uid,
        applicationId: uid,
        version: state.applicationVersion,
        status: state.applicationStatus,
        verificationStatus: 0,
        submittedAt: "2026-11-03T10:00:00Z",
        documents: [
          {
            kind: "vehicle_photo",
            assetId: "rider-evidence",
            contentType: "image/jpeg",
            available: true,
          },
          {
            kind: "plate_number",
            assetId: state.attached ? "delegated-asset" : null,
            contentType: state.attached ? "image/png" : null,
            available: state.attached,
          },
        ],
        approvalBlockers: state.attached ? [] : ["Plate photo is missing"],
        allowedDecisions:
          state.applicationStatus === "pending" ? ["approve", "reject"] : [],
        applicant: account(uid),
      });
    if (suffix === "/reviews") return reply(page(state.reviews));
    if (suffix === "/review") {
      if (!validate({ version: state.applicationVersion })) return true;
      state.profileVersion++;
      state.applicationVersion++;
      state.applicationStatus =
        body.decision === "approve" ? "approved" : "rejected";
      const review = {
        id: "review-1",
        uid,
        applicationId: uid,
        version: state.applicationVersion,
        decision: body.decision,
        reason: body.reason,
        status: state.applicationStatus,
        verificationStatus: body.decision === "approve" ? 1 : 0,
        reviewedBy: "admin-1",
        reviewedAt: "2026-11-03T10:00:00Z",
      };
      state.reviews.push(review);
      return reply(review);
    }
    if (suffix === "/upload-intents") {
      if (!["vehicle_photo", "plate_number"].includes(body.purpose)) {
        error(res, 400, "invalid_purpose", "Unsupported vehicle document.");
        return true;
      }
      state.uploads.set("delegated-asset", { ...body, uid });
      return reply({
        assetId: "delegated-asset",
        status: "awaiting_upload",
        uploadUrl: "http://localhost:4319/storage/delegated",
        method: "PUT",
        headers: { "content-type": body.contentType },
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        maxSizeBytes: 5242880,
      });
    }
    if (suffix === "/assets/delegated-asset/complete") {
      if (state.completionChecks++ === 0) {
        res.writeHead(202);
        res.end();
        return true;
      }
      return reply({
        assetId: "delegated-asset",
        status: "ready",
        contentType: "image/png",
        sizeBytes: 68,
      });
    }
    if (suffix.startsWith("/documents/")) {
      if (
        !["vehicle_photo", "plate_number"].includes(suffix.split("/").at(-1))
      ) {
        error(res, 400, "invalid_kind", "Unsupported vehicle document.");
        return true;
      }
      if (!validate({ version: state.applicationVersion })) return true;
      state.profileVersion++;
      state.applicationVersion++;
      state.attached = true;
      return reply({
        uid,
        kind: suffix.split("/").at(-1),
        assetId: body.assetId,
        version: state.profileVersion,
      });
    }
  }
  if (path === "/v1/shipping/local-types")
    return reply(
      page([
        {
          id: "premium",
          name: "Premium",
          details: "Deliveries are 2 - 3 days",
          active: true,
        },
      ]),
    );
  const fee = path.match(/^\/v1\/admin\/fees\/([^/]+)$/);
  if (fee) {
    if (!["super", "regular"].includes(role))
      return deny("Pricing access required.");
    if (write) {
      if (!validate(state.fee)) return true;
      Object.assign(state.fee.values, body.changes);
      state.fee.version++;
    }
    return reply(state.fee);
  }
  const office = path.match(
    /^\/v1\/admin\/shipping\/offices\/([^/]+)(\/pricing)?$/,
  );
  if (office) {
    const data = {
      id: office[1],
      name: "Lagos office",
      version: 2,
      basePickupMinor: 100000,
      perKmMinor: 25000,
      currency: "NGN",
      address: "Example address",
      active: true,
    };
    if (write && !validate(data)) return true;
    return reply({ ...data, ...(write ? body : {}), version: write ? 3 : 2 });
  }
  if (path === "/v1/admin/geography/states")
    return reply(
      page([{ id: "lagos", name: "Lagos", localZone: "los", version: 2 }]),
    );
  if (path === "/v1/admin/geography/states/lagos")
    return reply({
      id: "lagos",
      name: "Lagos",
      localZone: body.localZone,
      version: 3,
    });
  if (path === "/v1/admin/shipping/countries/GB")
    return reply({
      id: "GB",
      code: "GB",
      name: "United Kingdom",
      active: body.active ?? true,
      postalCodeRequired: body.postalCodeRequired ?? true,
      version: write ? 3 : 2,
    });
  if (path === "/v1/admin/pricing/audit")
    return reply(
      page([
        {
          id: "audit-price-1",
          actorUid: "admin-1",
          action: "publish",
          resourceId: "active-local",
          reason: "Reviewed",
          before: null,
          after: { version: 2 },
          effects: { publishedTariff: "active-local" },
          createdAt: "2026-11-03T10:00:00Z",
        },
      ]),
    );
  if (path === "/v1/admin/pricing/revision")
    return reply(page([{ changedAt: "2026-11-03T10:00:00Z" }]));
  const tariffs = path.match(
    /^\/v1\/admin\/(geography|shipping)\/tariffs(?:\/([^/]+))?(?:\/(snapshot|rates|countries|publish|clone|archive))?$/,
  );
  if (tariffs) {
    if (!["super", "regular"].includes(role))
      return deny("Pricing access required.");
    const [, area, id, action] = tariffs,
      local = area === "geography";
    if (!id) {
      if (write) return reply(tariff("new-draft", local));
      return reply(
        page([
          tariff(local ? "active-local" : "active-export", local),
          tariff(local ? "draft-local" : "draft-export", local),
        ]),
      );
    }
    const data = tariff(id, local);
    if (!write)
      return reply(
        action === "rates"
          ? page(data.rates)
          : action === "countries"
            ? page(data.countries)
            : data,
      );
    if (!validate(data)) return true;
    data.version++;
    if (action === "rates") {
      if (req.method === "DELETE")
        data.rates = data.rates.filter(
          (r) =>
            !body.rates.some(
              (v) =>
                v.weightGrams === r.weightGrams && (local || v.zone === r.zone),
            ),
        );
      else
        for (const r of body.rates) {
          data.rates = data.rates.filter(
            (v) =>
              v.weightGrams !== r.weightGrams || (!local && v.zone !== r.zone),
          );
          data.rates.push(r);
        }
      data.rateCount = data.rates.length;
    } else if (action === "countries") {
      if (req.method === "DELETE")
        data.countries = data.countries.filter(
          (c) => !body.countries.some((v) => v.code === c.code),
        );
      else
        for (const c of body.countries) {
          data.countries = data.countries.filter((v) => v.code !== c.code);
          data.countries.push(c);
        }
    } else if (action === "clone") {
      state.tariffs["cloned-draft"] = {
        ...structuredClone(data),
        id: "cloned-draft",
        version: 1,
        status: "draft",
        effects: { clonedFrom: id },
      };
      return reply(state.tariffs["cloned-draft"]);
    } else if (action === "publish") {
      data.status = "active";
      data.effects = {
        publishedTariff: id,
        retiredTariffs: [{ id: "prior-tariff", version: 4 }],
      };
    } else if (action === "archive") data.status = "retired";
    else Object.assign(data, body.changes);
    return reply(data);
  }
  if (path === "/v1/admin/reports/withdrawals") {
    if (!["super", "regular"].includes(role))
      return deny("Export authority required.");
    const items = [
      {
        id: "withdrawal-1",
        uid: "rider-1",
        accountType: "rider",
        amountMinor: 125000,
        currency: "NGN",
        status: "succeeded",
        payoutMethod: "manual-bank-transfer",
        reviewRequired: true,
        reference: "REF",
        createdAt: "2026-11-03T10:00:00Z",
        updatedAt: "2026-11-03T10:00:00Z",
      },
    ];
    if (q.get("format") === "csv") {
      res.writeHead(200, {
        "content-type": "text/csv",
        ...(q.has("cursor") ? {} : { "x-next-cursor": "export-next" }),
      });
      res.end("id,uid,status\nwithdrawal-1,rider-1,succeeded\n");
      return true;
    }
    return reply({
      ...page(items),
      nextCursor: q.has("cursor") ? null : "export-next",
      hasMore: !q.has("cursor"),
    });
  }
  const shipment = path.match(
    /^\/v1\/(admin\/)?shipments\/([^/]+)(?:\/(.*))?$/,
  );
  if (shipment && state.shipments[shipment[2]]) {
    const [, admin, id, action] = shipment,
      data = state.shipments[id];
    if (!action) return reply(data);
    if (action === "timeline")
      return reply(
        page([
          {
            id: "history-1",
            status: data.status,
            action: "office_accept",
            occurredAt: "2026-11-03T10:00:00Z",
            actorUid: "admin-1",
            reason: "Reviewed",
            evidenceAssetIds: [],
          },
        ]),
      );
    if (!validate(data)) return true;
    data.version++;
    if (action === "customs") Object.assign(data, body.changes);
    if (action === "assignment")
      data.assignedRider = { id: body.riderId, name: "Chosen rider" };
    if (action === "complete-clearance") {
      data.clearanceStatus = "completed";
      data.clearanceCompletedAt = body.completedAt;
      data.allowedAdminActions = [];
    }
    if (action === "local-dispatch") {
      data.status = "onrouteToDestination";
      data.deliveryRoute = "direct";
    }
    if (action === "cash-receipts") {
      data.payment = {
        status: "paid",
        method: "cash",
        transactionId: "cash-ledger",
      };
      data.assessments[0].status = "paid";
      data.allowedAdminActions = [];
    }
    if (action === "status-corrections") data.status = body.targetStatus;
    return reply(data);
  }
  return false;
}

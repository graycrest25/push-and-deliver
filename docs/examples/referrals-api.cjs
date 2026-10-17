// Backend example: integrate these handlers with your existing Firebase project.
// This file is not imported by the web app and does not deploy any functions.
const { createHmac, createHash, timingSafeEqual } = require("node:crypto");
const LIMITS = [10, 20, 30, 50];
const fail = (status, message) => Object.assign(new Error(message), { status });
const text = (value) => (typeof value === "string" ? value : null);

function parameter(query, name, max = 256) {
  const value = query[name];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw fail(400, `Invalid ${name}`);
  return value.trim();
}
function filters(query) {
  return {
    referredUid: parameter(query, "referredUid"),
    referreduserType: parameter(query, "referreduserType", 100),
    referralCodeUsed: parameter(query, "referralCodeUsed"),
  };
}
function filtered(db, values) {
  let query = db.collection("Referrals");
  for (const [key, value] of Object.entries(values))
    if (value !== undefined) query = query.where(key, "==", value);
  return query;
}
function dateBoundary(value, name) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw fail(400, `Invalid ${name}; use YYYY-MM-DD`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  )
    throw fail(400, `Invalid ${name}`);
  // Africa/Lagos midnight is 23:00 UTC on the preceding date.
  return new Date(date.getTime() - 3600000);
}
function iso(value) {
  const date = value?.toDate?.() ?? value;
  return date instanceof Date && Number.isFinite(date.getTime())
    ? date.toISOString()
    : null;
}
function serialize(document) {
  const data = document.data();
  return {
    id: document.id,
    referredUid: text(data.referredUid),
    referrerUid: text(data.referrerUid),
    referreduserType: text(data.referreduserType),
    referralCodeUsed: text(data.referralCodeUsed),
    riderType: text(data.riderType),
    createdAt: iso(data.createdAt),
  };
}
function csv(value) {
  let string = String(value ?? "");
  // Quoting alone does not prevent spreadsheet formula execution.
  if (/^[\t\r\n]|^\s*[=+@-]/.test(string)) string = `'${string}`;
  return `"${string.replace(/"/g, '""')}"`;
}

function createReferralApi({ db, verifyIdToken, FieldPath, cursorSecret }) {
  const endpoint = (handler) => async (req, res) => {
    res.set("Cache-Control", "private, no-store");
    try {
      if (req.method !== "GET") throw fail(405, "Method not allowed");
      const token = /^Bearer (.+)$/.exec(req.get("Authorization") || "")?.[1];
      if (!token) throw fail(401, "Sign in to view referrals");
      let claims;
      try {
        claims = await verifyIdToken(token, true);
      } catch {
        throw fail(401, "Invalid or expired session");
      }
      if (
        claims.isAdmin !== true ||
        !["super", "regular"].includes(claims.adminType)
      )
        throw fail(403, "You cannot access referrals");
      await handler(req, res);
    } catch (error) {
      if (res.headersSent) {
        res.destroy(error);
        return;
      }
      if (!error.status) console.error("Referral API failed", error);
      res.status(error.status || 500).json({
        error: error.status ? error.message : "Unable to load referrals",
      });
    }
  };
  const signature = (payload) => {
    if (typeof cursorSecret !== "string" || cursorSecret.length < 32)
      throw new Error(
        "Configure REFERRAL_CURSOR_SECRET with at least 32 characters",
      );
    return createHmac("sha256", cursorSecret).update(payload).digest();
  };
  const scope = (values, limit) =>
    createHash("sha256")
      .update(JSON.stringify({ ...values, limit }))
      .digest("hex");
  const encode = (id, queryScope) => {
    const payload = Buffer.from(
      JSON.stringify({ v: 1, id, scope: queryScope }),
    ).toString("base64url");
    return `${payload}.${signature(payload).toString("base64url")}`;
  };
  const decode = (cursor, queryScope) => {
    try {
      const parts = cursor.split(".");
      if (parts.length !== 2) throw new Error();
      const expected = signature(parts[0]);
      const supplied = Buffer.from(parts[1], "base64url");
      if (
        supplied.length !== expected.length ||
        !timingSafeEqual(supplied, expected)
      )
        throw new Error();
      const data = JSON.parse(
        Buffer.from(parts[0], "base64url").toString("utf8"),
      );
      if (
        data.v !== 1 ||
        data.scope !== queryScope ||
        typeof data.id !== "string" ||
        !data.id ||
        data.id.includes("/")
      )
        throw new Error();
      return data.id;
    } catch {
      throw fail(
        400,
        "Invalid cursor or changed filters; start from the first page",
      );
    }
  };
  return {
    listAdminReferrals: endpoint(async (req, res) => {
      const values = filters(req.query);
      const rawLimit = parameter(req.query, "limit", 2);
      const limit = rawLimit === undefined ? 10 : Number(rawLimit);
      if (
        !LIMITS.includes(limit) ||
        (rawLimit !== undefined && String(limit) !== rawLimit)
      )
        throw fail(400, "Limit must be 10, 20, 30, or 50");
      const cursor = parameter(req.query, "cursor", 4096);
      const queryScope = scope(values, limit);
      // Document ID ordering includes records without createdAt and survives cursor-document deletion.
      let query = filtered(db, values).orderBy(FieldPath.documentId(), "asc");
      if (cursor) query = query.startAfter(decode(cursor, queryScope));
      const snapshot = await query.limit(limit + 1).get();
      const documents = snapshot.docs.slice(0, limit);
      const hasMore = snapshot.docs.length > limit;
      res.json({
        items: documents.map(serialize),
        limit,
        hasMore,
        nextCursor: hasMore ? encode(documents.at(-1).id, queryScope) : null,
      });
    }),
    getAdminReferralSummary: endpoint(async (_req, res) => {
      // One read. Maintained by syncReferralSummary below, not by table pagination.
      const snapshot = await db.doc("AdminSummaries/referrals").get();
      const data = snapshot.data();
      if (!snapshot.exists || data?.isComplete !== true)
        throw fail(503, "Referral summary requires initialization or backfill");
      const keys = [
        "totalReferrals",
        "totalReferrers",
        "userReferrals",
        "riderReferrals",
      ];
      if (
        keys.some((key) => !Number.isSafeInteger(data[key]) || data[key] < 0) ||
        data.userReferrals + data.riderReferrals > data.totalReferrals ||
        data.totalReferrers > data.totalReferrals ||
        !iso(data.updatedAt)
      ) {
        throw fail(503, "Referral summary requires reconciliation");
      }
      res.json({
        totalReferrals: data.totalReferrals,
        totalReferrers: data.totalReferrers,
        userReferrals: data.userReferrals,
        riderReferrals: data.riderReferrals,
        unknownTypeReferrals:
          data.totalReferrals - data.userReferrals - data.riderReferrals,
        avgReferralsPerReferrer: data.totalReferrers
          ? Number((data.totalReferrals / data.totalReferrers).toFixed(1))
          : 0,
        calculatedAt: iso(data.updatedAt),
      });
    }),
    exportAdminReferralsCsv: endpoint(async (req, res) => {
      const start = parameter(req.query, "startDate", 10);
      const end = parameter(req.query, "endDate", 10);
      const from = dateBoundary(start, "startDate");
      const through = dateBoundary(end, "endDate");
      if (from > through)
        throw fail(400, "Start date must be on or before end date");
      const until = new Date(through.getTime() + 86400000);
      const type = parameter(req.query, "referreduserType", 100);
      const base = filtered(db, { referreduserType: type })
        .where("createdAt", ">=", from)
        .where("createdAt", "<", until)
        .orderBy("createdAt", "asc")
        .orderBy(FieldPath.documentId(), "asc");
      // Check the query/index before sending CSV headers.
      let batch = await base.limit(500).get();
      res.set("Content-Type", "text/csv; charset=utf-8");
      res.set(
        "Content-Disposition",
        `attachment; filename="referrals_${start}_${end}.csv"`,
      );
      const write = async (chunk) => {
        if (res.destroyed) throw new Error("Export connection closed");
        if (!res.write(chunk))
          await new Promise((resolve, reject) => {
            const cleanup = () => {
              res.off("drain", onDrain);
              res.off("close", onClose);
              res.off("error", onError);
            };
            const onDrain = () => {
              cleanup();
              resolve();
            };
            const onClose = () => {
              cleanup();
              reject(new Error("Export connection closed"));
            };
            const onError = (error) => {
              cleanup();
              reject(error);
            };
            res.once("drain", onDrain);
            res.once("close", onClose);
            res.once("error", onError);
          });
      };
      const columns = [
        "id",
        "referredUid",
        "referrerUid",
        "referreduserType",
        "referralCodeUsed",
        "riderType",
        "createdAt",
      ];
      await write(`\uFEFF${columns.map(csv).join(",")}\r\n`);
      while (true) {
        for (const document of batch.docs) {
          const row = serialize(document);
          await write(
            `${columns.map((column) => csv(row[column])).join(",")}\r\n`,
          );
        }
        if (batch.docs.length < 500) break;
        if (res.destroyed) return;
        batch = await base.startAfter(batch.docs.at(-1)).limit(500).get();
      }
      res.end();
    }),
  };
}

// Idempotent summary maintenance. Run for every Referrals write AND for each
// existing document during the one-time backfill. Keep all helper collections private.
async function syncReferralSummary(db, referralId) {
  const source = db.collection("Referrals").doc(referralId);
  const contribution = db
    .collection("_ReferralSummaryContributions")
    .doc(referralId);
  const summary = db.doc("AdminSummaries/referrals");
  await db.runTransaction(async (transaction) => {
    const [sourceSnap, previousSnap, summarySnap] = await transaction.getAll(
      source,
      contribution,
      summary,
    );
    const previous = previousSnap.exists ? previousSnap.data() : null;
    const data = sourceSnap.data();
    const next = sourceSnap.exists
      ? {
          referrerUid: text(data.referrerUid) || null,
          referreduserType: text(data.referreduserType),
        }
      : null;
    if (JSON.stringify(previous) === JSON.stringify(next)) return;
    const oldUid = previous?.referrerUid;
    const newUid = next?.referrerUid;
    const ids = [...new Set([oldUid, newUid].filter(Boolean))];
    const refs = ids.map((uid) =>
      db
        .collection("_ReferralReferrerCounts")
        .doc(createHash("sha256").update(uid).digest("hex")),
    );
    const counts = refs.length ? await transaction.getAll(...refs) : [];
    const aggregate = summarySnap.data() || {
      isComplete: false,
      totalReferrals: 0,
      totalReferrers: 0,
      userReferrals: 0,
      riderReferrals: 0,
    };
    for (let i = 0; i < ids.length; i++) {
      const oldCount = counts[i].data()?.count || 0;
      const newCount =
        oldCount - (oldUid === ids[i] ? 1 : 0) + (newUid === ids[i] ? 1 : 0);
      if (newCount < 0)
        throw new Error("Referral counters require reconciliation");
      aggregate.totalReferrers += Number(newCount > 0) - Number(oldCount > 0);
      if (newCount === 0) transaction.delete(refs[i]);
      else transaction.set(refs[i], { count: newCount });
    }
    aggregate.totalReferrals +=
      Number(next !== null) - Number(previous !== null);
    aggregate.userReferrals +=
      Number(next?.referreduserType === "user") -
      Number(previous?.referreduserType === "user");
    aggregate.riderReferrals +=
      Number(next?.referreduserType === "rider") -
      Number(previous?.referreduserType === "rider");
    if (
      [
        aggregate.totalReferrals,
        aggregate.totalReferrers,
        aggregate.userReferrals,
        aggregate.riderReferrals,
      ].some((value) => !Number.isSafeInteger(value) || value < 0)
    )
      throw new Error("Invalid referral counters");
    aggregate.updatedAt = new Date();
    transaction.set(summary, aggregate);
    if (next) transaction.set(contribution, next);
    else transaction.delete(contribution);
  });
}

// Run once from a trusted backend script after deploying the write trigger.
// Restarting a partial run is safe: contributions make processing idempotent.
async function backfillReferralSummary(db) {
  const summary = db.doc("AdminSummaries/referrals");
  try {
    await summary.create({
      isComplete: false,
      totalReferrals: 0,
      totalReferrers: 0,
      userReferrals: 0,
      riderReferrals: 0,
      updatedAt: new Date(),
    });
  } catch (error) {
    if (error.code !== 6 && error.code !== "already-exists") throw error;
  }
  await summary.update({ isComplete: false });
  for await (const document of db.collection("Referrals").select().stream())
    await syncReferralSummary(db, document.id);
  // Also reconcile deleted source documents that still have contributions.
  for await (const document of db
    .collection("_ReferralSummaryContributions")
    .select()
    .stream())
    await syncReferralSummary(db, document.id);
  await summary.update({ isComplete: true, updatedAt: new Date() });
}
module.exports = {
  createReferralApi,
  syncReferralSummary,
  backfillReferralSummary,
};

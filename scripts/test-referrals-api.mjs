import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { EventEmitter } from "node:events";
const require = createRequire(import.meta.url);
const {
  createReferralApi,
  syncReferralSummary,
  backfillReferralSummary,
} = require("../docs/examples/referrals-api.cjs");
const store = new Map();
let reads = 0;
const clone = (value) =>
  value === undefined ? undefined : structuredClone(value);
class Ref {
  constructor(path) {
    this.path = path;
    this.id = path.split("/").at(-1);
  }
  async get() {
    reads++;
    return snapshot(this.path);
  }
  async create(data) {
    if (store.has(this.path))
      throw Object.assign(new Error("exists"), { code: 6 });
    store.set(this.path, clone(data));
  }
  async update(data) {
    assert.ok(store.has(this.path));
    store.set(this.path, { ...store.get(this.path), ...clone(data) });
  }
}
function snapshot(path) {
  return {
    id: path.split("/").at(-1),
    ref: new Ref(path),
    exists: store.has(path),
    data: () => clone(store.get(path)),
  };
}
const value = (document, field) =>
  field === "__name__" ? document.id : document.data()[field];
class Query {
  constructor(path, filters = [], orders = [], cursor, size) {
    Object.assign(this, { path, filters, orders, cursor, size });
  }
  doc(id) {
    return new Ref(`${this.path}/${id}`);
  }
  where(...filter) {
    return new Query(
      this.path,
      [...this.filters, filter],
      this.orders,
      this.cursor,
      this.size,
    );
  }
  orderBy(field, direction) {
    return new Query(
      this.path,
      this.filters,
      [...this.orders, [field, direction]],
      this.cursor,
      this.size,
    );
  }
  startAfter(cursor) {
    return new Query(this.path, this.filters, this.orders, cursor, this.size);
  }
  limit(size) {
    return new Query(this.path, this.filters, this.orders, this.cursor, size);
  }
  select() {
    return this;
  }
  async *stream() {
    for (const doc of (await this.get()).docs) yield doc;
  }
  async get() {
    reads++;
    let docs = [...store.keys()]
      .filter(
        (path) =>
          path.startsWith(`${this.path}/`) &&
          path.split("/").length === this.path.split("/").length + 1,
      )
      .map(snapshot);
    docs = docs.filter((doc) =>
      this.filters.every(([field, op, target]) => {
        const current = value(doc, field);
        return op === "=="
          ? current === target
          : current !== undefined &&
              (op === ">=" ? current >= target : current < target);
      }),
    );
    const compare = (a, b) => {
      for (const [field, direction] of this.orders) {
        const av = value(a, field);
        const bv = value(b, field);
        if (av < bv) return direction === "desc" ? 1 : -1;
        if (av > bv) return direction === "desc" ? -1 : 1;
      }
      return 0;
    };
    docs.sort(compare);
    if (this.cursor) {
      const cursor =
        typeof this.cursor === "string"
          ? { id: this.cursor, data: () => ({}) }
          : this.cursor;
      docs = docs.filter((doc) => compare(doc, cursor) > 0);
    }
    if (this.size !== undefined) docs = docs.slice(0, this.size);
    return { docs, size: docs.length };
  }
}
const db = {
  collection: (path) => new Query(path),
  doc: (path) => new Ref(path),
  runTransaction: async (callback) => {
    const writes = [];
    const result = await callback({
      getAll: async (...refs) => refs.map((ref) => snapshot(ref.path)),
      set: (ref, data) => writes.push(() => store.set(ref.path, clone(data))),
      delete: (ref) => writes.push(() => store.delete(ref.path)),
    });
    for (const write of writes) write();
    return result;
  },
};
let claims = { isAdmin: true, adminType: "regular" };
let verified = 0;
const api = createReferralApi({
  db,
  FieldPath: { documentId: () => "__name__" },
  cursorSecret: "a-secure-test-cursor-secret-of-more-than-32-characters",
  verifyIdToken: async (token, revoked) => {
    assert.equal(token, "valid");
    assert.equal(revoked, true);
    verified++;
    return claims;
  },
});
class Response extends EventEmitter {
  constructor() {
    super();
    this.code = 200;
    this.headers = {};
    this.body = "";
    this.destroyed = false;
    this.headersSent = false;
  }
  set(name, value) {
    this.headers[name] = value;
    return this;
  }
  status(code) {
    this.code = code;
    return this;
  }
  json(body) {
    this.body = body;
    this.headersSent = true;
    return this;
  }
  write(chunk) {
    this.body += chunk;
    this.headersSent = true;
    return true;
  }
  end() {
    this.ended = true;
  }
  destroy(error) {
    this.destroyed = true;
    this.error = error;
  }
}
async function request(name, query = {}, options = {}) {
  const res = new Response();
  await api[name](
    {
      method: options.method ?? "GET",
      query,
      get: () => options.token ?? "Bearer valid",
    },
    res,
  );
  return res;
}
for (let i = 0; i < 83; i++)
  store.set(`Referrals/${String(i).padStart(3, "0")}`, {
    referredUid: i < 70 ? "target-user" : "other-user",
    referrerUid: `sender-${i % 4}`,
    referreduserType: i % 2 ? "rider" : "user",
    referralCodeUsed: i % 3 ? "SAVE" : "WELCOME",
    createdAt: new Date("2026-10-17T10:00:00Z"),
  });
const first = await request("listAdminReferrals");
assert.equal(first.code, 200);
assert.equal(first.body.limit, 10);
assert.equal(first.body.items.length, 10);
assert.equal(first.body.hasMore, true);
assert.equal(first.body.items[0].id, "000");
const second = await request("listAdminReferrals", {
  cursor: first.body.nextCursor,
});
assert.equal(
  second.body.items[0].id,
  "010",
  "Lookahead document must not be skipped",
);
store.delete("Referrals/009");
assert.equal(
  (await request("listAdminReferrals", { cursor: first.body.nextCursor })).body
    .items[0].id,
  "010",
  "Deleted cursor document must remain navigable",
);
for (const limit of [10, 20, 30, 50]) {
  const data = (await request("listAdminReferrals", { limit: String(limit) }))
    .body;
  assert.equal(data.limit, limit);
  assert.equal(data.items.length, limit);
}
for (const limit of ["0", "25", "100", "10.0", "1e1", ""])
  assert.equal((await request("listAdminReferrals", { limit })).code, 400);
const filtered = await request("listAdminReferrals", {
  limit: "50",
  referredUid: "target-user",
  referreduserType: "rider",
  referralCodeUsed: "SAVE",
});
assert.ok(filtered.body.items.length > 10);
assert.ok(
  filtered.body.items.every(
    (item) =>
      item.referredUid === "target-user" &&
      item.referreduserType === "rider" &&
      item.referralCodeUsed === "SAVE",
  ),
);
assert.equal(filtered.body.hasMore, false);
assert.equal(filtered.body.nextCursor, null);
assert.equal(
  (await request("listAdminReferrals", { referredUid: "target" })).body.items
    .length,
  0,
  "User ID search is exact",
);
assert.equal(
  (
    await request("listAdminReferrals", {
      cursor: `${first.body.nextCursor}tampered`,
    })
  ).code,
  400,
);
assert.equal(
  (
    await request("listAdminReferrals", {
      cursor: first.body.nextCursor,
      referreduserType: "rider",
    })
  ).code,
  400,
);
assert.equal(
  (
    await request("listAdminReferrals", {
      cursor: first.body.nextCursor,
      limit: "20",
    })
  ).code,
  400,
);
assert.equal(
  (await request("listAdminReferrals", { referredUid: ["a", "b"] })).code,
  400,
);
const oldReads = reads;
assert.equal(
  (await request("listAdminReferrals", {}, { token: "" })).code,
  401,
);
assert.equal(
  (await request("listAdminReferrals", {}, { method: "POST" })).code,
  405,
);
claims = { isAdmin: true, adminType: "customercare" };
assert.equal((await request("getAdminReferralSummary")).code, 403);
assert.equal(reads, oldReads, "Unauthorized requests must not read Firestore");
claims = { isAdmin: true, adminType: "super" };
assert.equal((await request("getAdminReferralSummary")).code, 503);
// Backfill and all later writes use the same idempotent maintenance path.
await backfillReferralSummary(db);
const summary = (await request("getAdminReferralSummary")).body;
assert.equal(summary.totalReferrals, 82);
assert.equal(summary.totalReferrers, 4);
assert.equal(summary.avgReferralsPerReferrer, 20.5);
assert.equal(
  summary.userReferrals + summary.riderReferrals + summary.unknownTypeReferrals,
  82,
);
const beforeDuplicate = structuredClone(store.get("AdminSummaries/referrals"));
await syncReferralSummary(db, "010");
assert.deepEqual(store.get("AdminSummaries/referrals"), beforeDuplicate);
store.set("Referrals/010", {
  ...store.get("Referrals/010"),
  referrerUid: "new-sender",
  referreduserType: "unknown",
});
await syncReferralSummary(db, "010");
assert.equal(store.get("AdminSummaries/referrals").totalReferrers, 5);
assert.equal(
  (await request("getAdminReferralSummary")).body.unknownTypeReferrals,
  1,
);
store.delete("Referrals/010");
await syncReferralSummary(db, "010");
await syncReferralSummary(db, "010"); // duplicate delete event
assert.equal(store.get("AdminSummaries/referrals").totalReferrers, 4);
assert.equal(store.get("AdminSummaries/referrals").totalReferrals, 81);
await backfillReferralSummary(db); // repeat backfill must not double count
assert.equal(store.get("AdminSummaries/referrals").totalReferrals, 81);
store.clear();
await backfillReferralSummary(db);
assert.equal((await request("getAdminReferralSummary")).body.totalReferrals, 0);
// More than one export batch, inclusive Lagos day boundaries, unknown dates, and formulas.
for (let i = 0; i < 505; i++)
  store.set(`Referrals/${String(i).padStart(3, "0")}`, {
    referredUid: '=HYPERLINK("bad")',
    referreduserType: "rider",
    referralCodeUsed: 'Line1\n"Line2"',
    createdAt: new Date("2026-10-16T23:00:00Z"),
  });
store.set("Referrals/last-in-day", {
  referredUid: "last-in-day",
  referreduserType: "rider",
  createdAt: new Date("2026-10-17T22:59:59.999Z"),
});
store.set("Referrals/too-late", {
  referredUid: "too-late",
  referreduserType: "rider",
  createdAt: new Date("2026-10-17T23:00:00Z"),
});
store.set("Referrals/too-early", {
  referredUid: "too-early",
  referreduserType: "rider",
  createdAt: new Date("2026-10-16T22:59:59.999Z"),
});
store.set("Referrals/other-type", {
  referredUid: "other-type",
  referreduserType: "user",
  createdAt: new Date("2026-10-17T10:00:00Z"),
});
store.set("Referrals/no-date", {
  referredUid: "no-date",
  referreduserType: "rider",
});
const exported = await request("exportAdminReferralsCsv", {
  startDate: "2026-10-17",
  endDate: "2026-10-17",
  referreduserType: "rider",
});
assert.equal(exported.code, 200);
assert.equal(exported.ended, true);
assert.equal(exported.headers["Content-Type"], "text/csv; charset=utf-8");
assert.equal((exported.body.match(/HYPERLINK/g) ?? []).length, 505);
assert.match(exported.body, /'=/);
assert.match(exported.body, /""bad""/);
assert.match(exported.body, /Line1\n""Line2""/);
assert.match(exported.body, /last-in-day/);
assert.doesNotMatch(exported.body, /too-late|too-early|other-type|no-date/);
for (const query of [
  {},
  { startDate: "2026-02-30", endDate: "2026-03-01" },
  { startDate: "2026-10-18", endDate: "2026-10-17" },
])
  assert.equal((await request("exportAdminReferralsCsv", query)).code, 400);
console.log(
  "Referral backend examples passed: exact search, AND filters, all limits, signed cursors, deleted cursors, auth, idempotent aggregate/backfill, and multi-batch CSV dates/escaping.",
);

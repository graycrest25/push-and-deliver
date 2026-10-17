import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import vm from "node:vm";
const require = createRequire(import.meta.url);
const {
  calculateAccountSummary,
} = require("../firebase/functions/account-summary.cjs");
const now = new Date("2026-10-17T01:00:00Z");
const rows = {
  Users: [
    { createdAt: new Date("2026-10-16T23:00:00Z") }, // Lagos midnight today
    { createdAt: new Date("2026-10-16T22:59:59Z") },
    { createdAt: new Date("2026-10-09T23:00:00Z") }, // week boundary
    { createdAt: new Date("2026-10-09T22:59:59Z") },
    { createdAt: new Date("2026-10-02T23:00:00Z") }, // previous week boundary
    { createdAt: new Date("2026-10-02T22:59:59Z") },
    {}, // missing date must still contribute to total
  ],
  Riders: Array.from({ length: 58 }, (_, i) => ({
    verificationStatus: i % 3,
    vehicleType: Math.floor(i / 3) % 3,
  })).concat([{}]),
};
let queries = 0;
function collection(name, filters = []) {
  return {
    where: (field, operator, value) =>
      collection(name, [...filters, { field, operator, value }]),
    count: () => ({
      get: async () => {
        queries++;
        return {
          data: () => ({
            count: rows[name].filter((row) =>
              filters.every(({ field, operator, value }) =>
                operator === "=="
                  ? row[field] === value
                  : operator === ">="
                    ? row[field] >= value
                    : row[field] < value,
              ),
            ).length,
          }),
        };
      },
    }),
    get: () => {
      throw new Error("Summary must never download account documents");
    },
  };
}
const db = { collection };
const users = await calculateAccountSummary(db, "users", now);
assert.deepEqual(
  [
    users.total,
    users.newToday,
    users.newThisWeek,
    users.newLastWeek,
    users.growthRate,
  ],
  [7, 1, 3, 2, 50],
);
assert.equal(queries, 4);
const riders = await calculateAccountSummary(db, "riders", now);
assert.equal(riders.total, 59);
assert.equal(riders.verified.total, 19);
assert.equal(riders.pending.total, 20);
assert.equal(riders.blocked.total, 19);
assert.equal(
  Object.values(riders.byVehicle).reduce((a, b) => a + b),
  58,
);
assert.equal(
  Object.values(riders.pending.byVehicle).reduce((a, b) => a + b),
  20,
);
assert.equal(queries, 20, "Rider summary uses sixteen count aggregations");
rows.Users = [{}];
assert.equal(
  (await calculateAccountSummary(db, "users", now)).growthRate,
  null,
);

// Execute the actual HTTP handler with mocked Firebase adapters.
let claims = { isAdmin: true, adminType: "super" };
let calculations = 0;
const context = vm.createContext({
  exports: {},
  console,
  Date,
  Map,
  require: (name) =>
    ({
      "firebase-functions/v2/https": { onRequest: (_, handler) => handler },
      "firebase-admin/app": { getApps: () => [{}], initializeApp() {} },
      "firebase-admin/auth": {
        getAuth: () => ({ verifyIdToken: async () => claims }),
      },
      "firebase-admin/firestore": { getFirestore: () => db },
      "./account-summary.cjs": {
        calculateAccountSummary: async () => {
          calculations++;
          return users;
        },
      },
    })[name],
});
vm.runInContext(
  fs.readFileSync("firebase/functions/index.cjs", "utf8"),
  context,
);
async function request(type, token = "Bearer valid", method = "GET") {
  const response = {
    code: 200,
    set() {},
    status(value) {
      this.code = value;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
  };
  await context.exports.getAdminAccountSummary(
    { method, query: { type }, get: () => token },
    response,
  );
  return response;
}
assert.equal((await request("users", "")).code, 401);
assert.equal((await request("invalid")).code, 400);
assert.equal((await request("users", undefined, "POST")).code, 405);
claims = { isAdmin: true, adminType: "verifier" };
assert.equal((await request("users")).code, 403);
assert.equal((await request("riders")).code, 200);
claims = { isAdmin: true, adminType: "regular" };
await Promise.all([request("users"), request("users"), request("users")]);
assert.equal(
  calculations,
  2,
  "Concurrent summary requests must share cached calculation",
);
claims = { isAdmin: false, adminType: "super" };
assert.equal(
  (await request("users")).code,
  403,
  "Cached responses must still enforce authorization",
);
console.log(
  "Account summary passed: global counts, Lagos date boundaries, growth, numeric status/vehicle breakdowns, missing fields, authentication, roles, and concurrent cache reuse.",
);

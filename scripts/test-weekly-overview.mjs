import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { z } from "zod";
const valid = () => ({
  success: true,
  timezone: "Africa/Lagos",
  weekStartsOn: "Monday",
  startDate: "2026-10-05",
  endDate: "2026-10-15",
  weeks: [
    {
      weekStart: "2026-10-05",
      weekEnd: "2026-10-11",
      newUsers: 12,
      activeRiders: 8,
    },
    {
      weekStart: "2026-10-12",
      weekEnd: "2026-10-18",
      newUsers: 7,
      activeRiders: 5,
    },
  ],
  coverage: {
    completedOrdersScanned: 145,
    missingCompletionTimestamp: 3,
    missingRiderId: 1,
  },
});
let body = valid();
let status = 200;
let malformed = false;
let claims = { isAdmin: true, adminType: "super" };
const requests = [];
const context = vm.createContext({
  exports: {},
  z,
  URL,
  URLSearchParams,
  auth: {
    currentUser: {
      getIdToken: async (force) => {
        assert.equal(force, true);
        return "firebase-token";
      },
      getIdTokenResult: async () => ({ claims }),
    },
  },
  endpoints: {
    getAdminWeeklyOverview: "https://getAdminWeeklyOverview-example.a.run.app",
  },
  fetch: async (url, options) => {
    if (options.signal?.aborted) throw options.signal.reason;
    requests.push({ url, options });
    return {
      ok: status === 200,
      status,
      json: async () => {
        if (malformed) throw new Error("Invalid JSON");
        return body;
      },
    };
  },
});
const source = fs
  .readFileSync("src/services/admin-weekly-overview.service.ts", "utf8")
  .replace(/^import[\s\S]*?from ["'][^"']+["'];\n/gm, "");
vm.runInContext(
  ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText,
  context,
);
const service = context.exports.adminWeeklyOverviewService;
const date = context.exports.isCalendarDate;
for (const value of ["2026-10-15", "2024-02-29", "2026-12-31"])
  assert.equal(date(value), true);
for (const value of [
  "2026-02-29",
  "2026-02-30",
  "2026-04-31",
  "2026-13-01",
  "2026-10-00",
  "2026-1-5",
  "invalid",
  "2026-10-15T00:00:00Z",
])
  assert.equal(date(value), false);
let result = await service.getOverview();
assert.deepEqual(JSON.parse(JSON.stringify(result)), valid());
assert.deepEqual(
  [...new URL(requests[0].url).searchParams],
  [["weeks", "8"]],
  "Omit the default end date so the backend selects Lagos today",
);
assert.equal(requests[0].options.method, "GET");
assert.equal(
  requests[0].options.headers.Authorization,
  "Bearer firebase-token",
);
assert.equal(requests[0].options.cache, "no-store");
await service.getOverview({ weeks: 52, endDate: "2026-10-15" });
assert.equal(
  new URL(requests.at(-1).url).searchParams.get("endDate"),
  "2026-10-15",
);
assert.equal(new URL(requests.at(-1).url).searchParams.get("weeks"), "52");
assert.equal(
  result.weeks[1].weekEnd,
  "2026-10-18",
  "Full week labels must not be truncated at endDate",
);
assert.equal(result.coverage.missingCompletionTimestamp, 3);
const before = requests.length;
for (const weeks of [0, 53, 1.5, NaN, Infinity, "8"])
  await assert.rejects(service.getOverview({ weeks }), /Weeks/);
for (const endDate of ["2026-02-30", "2026-1-5", ""])
  await assert.rejects(service.getOverview({ endDate }), /End date/);
for (const adminType of [
  "regular",
  "customercare",
  "verifier",
  "",
  undefined,
]) {
  claims = { isAdmin: true, adminType };
  await assert.rejects(service.getOverview(), /Super admin/);
}
claims = { isAdmin: false, adminType: "super" };
await assert.rejects(service.getOverview(), /Super admin/);
assert.equal(
  requests.length,
  before,
  "Invalid input and non-super callers must not request the endpoint",
);
claims = { isAdmin: true, adminType: "super" };
for (const code of [400, 401, 403, 500]) {
  status = code;
  body = { success: false, error: `Server error ${code}` };
  await assert.rejects(
    service.getOverview(),
    new RegExp(`Server error ${code}`),
  );
}
status = 403;
body = { success: false, error: "Account disabled or token revoked" };
await assert.rejects(service.getOverview(), /disabled or token revoked/);
status = 200;
body = valid();
body.weeks.forEach((w) => {
  w.newUsers = 0;
  w.activeRiders = 0;
});
result = await service.getOverview({ weeks: 1 });
assert.equal(result.weeks[0].activeRiders, 0);
for (const mutate of [
  (b) => (b.timezone = "UTC"),
  (b) => (b.weeks[0].activeRiders = -1),
  (b) => (b.weeks[0].newUsers = "12"),
  (b) => (b.weeks[0].weekStart = "bad"),
  (b) => delete b.coverage,
  (b) => (b.coverage.missingRiderId = 1.5),
]) {
  body = valid();
  mutate(body);
  await assert.rejects(service.getOverview(), /invalid weekly overview/);
}
malformed = true;
await assert.rejects(service.getOverview(), /invalid weekly overview/);
malformed = false;
body = valid();
const controller = new AbortController();
await service.getOverview({}, controller.signal);
assert.equal(requests.at(-1).options.signal, controller.signal);
controller.abort();
await assert.rejects(
  service.getOverview({}, controller.signal),
  (e) => e.name === "AbortError",
);
context.auth.currentUser = null;
await assert.rejects(service.getOverview(), /Sign in/);
console.log(
  "Weekly overview tests passed: super-admin Firebase auth, 1–52 weeks, valid calendar dates, Lagos server defaults, full-week labels, partial periods, zeros, coverage, malformed responses, server revocation errors, and cancellation.",
);

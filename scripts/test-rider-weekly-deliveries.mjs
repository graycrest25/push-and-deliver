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
  count: 1,
  pageSize: 1,
  riders: [
    {
      riderid: "rider_001",
      name: "Alice",
      totalCompletedDeliveries: 5,
      weeks: [
        {
          weekStart: "2026-10-05",
          weekEnd: "2026-10-11",
          completedDeliveries: 3,
        },
        {
          weekStart: "2026-10-12",
          weekEnd: "2026-10-18",
          completedDeliveries: 2,
        },
      ],
    },
  ],
  coverage: { completedOrdersScanned: 7, missingCompletionTimestamp: 1 },
  nextPageToken: "rider_001",
});
let body = valid(),
  status = 200,
  malformed = false,
  claims = { isAdmin: true, adminType: "super" };
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
        return "super-admin-token";
      },
      getIdTokenResult: async () => ({ claims }),
    },
  },
  endpoints: {
    getAdminRiderWeeklyDeliveries:
      "https://getAdminRiderWeeklyDeliveries-example.a.run.app",
  },
  fetch: async (url, options) => {
    if (options.signal?.aborted) throw options.signal.reason;
    requests.push({ url, options });
    return {
      ok: status === 200,
      status,
      json: async () => {
        if (malformed) throw new Error("Bad JSON");
        return body;
      },
    };
  },
});
function load(file) {
  const source = fs
    .readFileSync(file, "utf8")
    .replace(/^import[\s\S]*?from ["'][^"']+["'];\n/gm, "");
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  vm.runInContext(`(function(exports) { ${code} })(exports);`, context);
}
load("src/services/admin-weekly-overview.service.ts");
context.isCalendarDate = context.exports.isCalendarDate;
load("src/services/admin-rider-weekly-deliveries.service.ts");
const service = context.exports.adminRiderWeeklyDeliveriesService;
let result = await service.getPage();
assert.deepEqual(JSON.parse(JSON.stringify(result)), valid());
assert.deepEqual(Object.fromEntries(new URL(requests[0].url).searchParams), {
  weeks: "8",
  pageSize: "50",
});
assert.equal(requests[0].options.method, "GET");
assert.equal(requests[0].options.cache, "no-store");
assert.equal(
  requests[0].options.headers.Authorization,
  "Bearer super-admin-token",
);
assert.equal(
  Object.keys(requests[0].options.headers).length,
  1,
  "Use Firebase bearer authentication only",
);
await service.getPage({
  weeks: 2,
  endDate: result.endDate,
  pageSize: 1,
  pageToken: "rider /?&=+",
});
assert.deepEqual(
  Object.fromEntries(new URL(requests.at(-1).url).searchParams),
  {
    weeks: "2",
    endDate: "2026-10-15",
    pageSize: "1",
    pageToken: "rider /?&=+",
  },
);
assert.equal(result.riders[0].totalCompletedDeliveries, 5);
assert.equal(result.riders[0].weeks[1].weekEnd, "2026-10-18");
assert.equal(result.coverage.missingCompletionTimestamp, 1);
const before = requests.length;
for (const params of [
  { weeks: 0 },
  { weeks: 53 },
  { weeks: 1.5 },
  { pageSize: 0 },
  { pageSize: 201 },
  { pageSize: 1.5 },
  { endDate: "2026-02-30" },
  { endDate: "2026-1-5" },
  { endDate: "" },
  { pageToken: "" },
  { pageToken: 42 },
])
  await assert.rejects(service.getPage(params));
for (const adminType of [
  "regular",
  "customercare",
  "verifier",
  "",
  undefined,
  "unknown",
]) {
  claims = { isAdmin: true, adminType };
  await assert.rejects(service.getPage(), /Super admin/);
}
claims = { isAdmin: false, adminType: "super" };
await assert.rejects(service.getPage(), /Super admin/);
assert.equal(requests.length, before);
claims = { isAdmin: true, adminType: "super" };
for (const code of [400, 401, 403, 405, 500]) {
  status = code;
  body = { success: false, error: `Server error ${code}` };
  await assert.rejects(service.getPage(), new RegExp(`Server error ${code}`));
}
status = 200;
body = valid();
body.nextPageToken = null;
body.riders[0].totalCompletedDeliveries = 0;
body.riders[0].weeks.forEach((w) => (w.completedDeliveries = 0));
result = await service.getPage({ weeks: 52, pageSize: 200 });
assert.equal(result.riders[0].totalCompletedDeliveries, 0);
assert.equal(result.nextPageToken, null);
body = {
  ...valid(),
  count: 0,
  riders: [],
  coverage: { completedOrdersScanned: 0, missingCompletionTimestamp: 0 },
  nextPageToken: null,
};
assert.equal((await service.getPage()).riders.length, 0);
for (const mutate of [
  (b) => (b.riders[0].weeks[0].completedDeliveries = -1),
  (b) => (b.count = 2),
  (b) => (b.riders[0].totalCompletedDeliveries = "5"),
  (b) => (b.timezone = "UTC"),
  (b) => (b.nextPageToken = 42),
  (b) => delete b.coverage,
]) {
  body = valid();
  mutate(body);
  await assert.rejects(service.getPage(), /invalid rider weekly deliveries/);
}
malformed = true;
await assert.rejects(service.getPage(), /invalid rider weekly deliveries/);
malformed = false;
body = valid();
const controller = new AbortController();
await service.getPage({}, controller.signal);
assert.equal(requests.at(-1).options.signal, controller.signal);
controller.abort();
await assert.rejects(
  service.getPage({}, controller.signal),
  (e) => e.name === "AbortError",
);
context.auth.currentUser = null;
await assert.rejects(service.getPage(), /Sign in/);
console.log(
  "Rider weekly delivery tests passed: super-only bearer auth, exact query/defaults/limits, opaque rider ID cursor, full week labels, period totals, zero/empty results, coverage, malformed responses, HTTP errors, and cancellation.",
);

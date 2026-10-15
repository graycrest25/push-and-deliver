import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { z } from "zod";
const valid = () => ({
  success: true,
  timezone: "Africa/Lagos",
  startDate: "2026-10-05",
  endDate: "2026-10-11",
  asOfDate: "2026-10-15",
  issuedCoupons: 100,
  redeemedCoupons: 25,
  notRedeemedByCutoffCoupons: 60,
  expiredUnusedCoupons: 15,
  couponRedemptionRatePercent: 25,
  usersIssuedCoupons: 60,
  usersRedeemedCoupons: 20,
  userRedemptionRatePercent: 100 / 3,
  coverage: {
    missingRedemptionTimestamp: 15,
    redemptionBeforeIssuance: 0,
    invalidUserId: 2,
    invalidIssuanceTimestamp: 0,
  },
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
        return "super-token";
      },
      getIdTokenResult: async () => ({ claims }),
    },
  },
  endpoints: {
    getAdminCouponRedemptionMetrics:
      "https://getAdminCouponRedemptionMetrics-example.a.run.app",
  },
  fetch: async (url, options) => {
    if (options.signal?.aborted) throw options.signal.reason;
    requests.push({ url, options });
    return {
      ok: status === 200,
      status,
      json: async () => {
        if (malformed) throw Error("Bad JSON");
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
  vm.runInContext(`(function(exports){${code}})(exports)`, context);
}
load("src/services/admin-weekly-overview.service.ts");
context.isCalendarDate = context.exports.isCalendarDate;
load("src/services/admin-coupon-redemption-metrics.service.ts");
const service = context.exports.adminCouponRedemptionMetricsService;
const params = { startDate: "2026-10-05", endDate: "2026-10-11" };
const result = await service.getMetrics(params);
assert.deepEqual(
  JSON.parse(JSON.stringify(result)),
  valid(),
  "Preserve reported buckets even when they do not sum to issued total",
);
assert.equal(
  result.couponRedemptionRatePercent,
  25,
  "Percentage is already on a 0–100 scale",
);
assert.deepEqual(
  Object.fromEntries(new URL(requests[0].url).searchParams),
  params,
  "Omit cutoff to let server choose Lagos today",
);
assert.equal(requests[0].options.method, "GET");
assert.equal(requests[0].options.cache, "no-store");
assert.deepEqual(Object.keys(requests[0].options.headers), ["Authorization"]);
assert.equal(requests[0].options.headers.Authorization, "Bearer super-token");
await service.getMetrics({ ...params, asOfDate: "2026-10-15" });
assert.deepEqual(
  Object.fromEntries(new URL(requests.at(-1).url).searchParams),
  { ...params, asOfDate: "2026-10-15" },
);
await service.getMetrics({
  startDate: "2024-02-29",
  endDate: "2024-02-29",
  asOfDate: "2024-02-29",
});
const before = requests.length;
for (const invalid of [
  { startDate: "" },
  { endDate: "2026-02-30" },
  { startDate: "2026-10-12" },
  { startDate: "2026-1-05" },
  { asOfDate: "" },
  { asOfDate: "2026-10-10" },
  { asOfDate: "2026-02-29" },
  { endDate: undefined },
])
  await assert.rejects(service.getMetrics({ ...params, ...invalid }));
for (const adminType of [
  "regular",
  "customercare",
  "verifier",
  "",
  undefined,
  "unknown",
]) {
  claims = { isAdmin: true, adminType };
  await assert.rejects(service.getMetrics(params), /Super admin/);
}
claims = { isAdmin: false, adminType: "super" };
await assert.rejects(service.getMetrics(params), /Super admin/);
assert.equal(
  requests.length,
  before,
  "Invalid requests and non-super roles never call endpoint",
);
claims = { isAdmin: true, adminType: "super" };
for (const code of [400, 401, 403, 405, 500]) {
  status = code;
  body = { success: false, error: `API error ${code}` };
  await assert.rejects(
    service.getMetrics(params),
    new RegExp(`API error ${code}`),
  );
}
status = 200;
body = {
  ...valid(),
  issuedCoupons: 0,
  redeemedCoupons: 0,
  notRedeemedByCutoffCoupons: 0,
  expiredUnusedCoupons: 0,
  usersIssuedCoupons: 0,
  usersRedeemedCoupons: 0,
  couponRedemptionRatePercent: null,
  userRedemptionRatePercent: null,
};
assert.equal(
  (await service.getMetrics(params)).couponRedemptionRatePercent,
  null,
);
assert.equal(
  (await service.getMetrics(params)).userRedemptionRatePercent,
  null,
);
for (const mutate of [
  (b) => (b.issuedCoupons = -1),
  (b) => (b.redeemedCoupons = "25"),
  (b) => (b.couponRedemptionRatePercent = 2500),
  (b) => (b.userRedemptionRatePercent = NaN),
  (b) => (b.asOfDate = "invalid"),
  (b) => delete b.coverage,
]) {
  body = valid();
  mutate(body);
  await assert.rejects(
    service.getMetrics(params),
    /invalid coupon redemption response/,
  );
}
malformed = true;
await assert.rejects(
  service.getMetrics(params),
  /invalid coupon redemption response/,
);
malformed = false;
body = valid();
const controller = new AbortController();
await service.getMetrics(params, controller.signal);
assert.equal(requests.at(-1).options.signal, controller.signal);
controller.abort();
await assert.rejects(
  service.getMetrics(params, controller.signal),
  (e) => e.name === "AbortError",
);
context.auth.currentUser = null;
await assert.rejects(service.getMetrics(params), /Sign in/);
console.log(
  "Coupon redemption tests passed: date bounds, Lagos default cutoff, super-only bearer auth, raw rates/nulls, independent coverage buckets, HTTP/payload errors, cancellation.",
);

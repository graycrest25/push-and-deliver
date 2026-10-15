import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { z } from "zod";
const valid = () => ({
  success: true,
  timezone: "Africa/Lagos",
  weekStartsOn: "Monday",
  weekStart: "2026-10-12",
  weekEnd: "2026-10-18",
  top: 10,
  count: 1,
  totalUsers: 1,
  totalRides: 4,
  topUsersRides: 4,
  topUsersSharePercent: 100,
  users: [
    {
      rank: 1,
      userid: "user_001",
      totalRides: 4,
      services: {
        ridehailing: 1,
        courier: 1,
        expressshipmenr: 1,
        customclearancer: 1,
      },
      name: "Alice",
      imageurl: "",
      sharePercent: 100,
    },
  ],
  coverage: { ordersScanned: 4, invalidCustomerId: 0, unsupportedService: 0 },
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
    getAdminWeeklyConcentration:
      "https://getAdminWeeklyConcentration-example.a.run.app",
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
  vm.runInContext(`(function(exports){${code}})(exports)`, context);
}
load("src/services/admin-weekly-overview.service.ts");
context.isCalendarDate = context.exports.isCalendarDate;
load("src/services/admin-weekly-concentration.service.ts");
const service = context.exports.adminWeeklyConcentrationService;
let data = await service.getReport();
assert.deepEqual(JSON.parse(JSON.stringify(data)), valid());
assert.deepEqual(Object.fromEntries(new URL(requests[0].url).searchParams), {
  top: "10",
});
assert.equal(requests[0].options.method, "GET");
assert.equal(requests[0].options.headers.Authorization, "Bearer super-token");
assert.deepEqual(Object.keys(requests[0].options.headers), ["Authorization"]);
assert.equal(data.topUsersSharePercent, 100);
assert.equal(data.users[0].sharePercent, 100);
for (const top of [10, 20, 50, 100]) {
  await service.getReport({ top, weekOf: "2026-10-15" });
  assert.deepEqual(
    Object.fromEntries(new URL(requests.at(-1).url).searchParams),
    { top: String(top), weekOf: "2026-10-15" },
  );
}
const before = requests.length;
for (const params of [
  { top: 0 },
  { top: 11 },
  { top: 200 },
  { top: "10" },
  { top: NaN },
  { weekOf: "2026-02-30" },
  { weekOf: "2026-1-5" },
  { weekOf: "" },
])
  await assert.rejects(service.getReport(params));
for (const adminType of [
  "regular",
  "customercare",
  "verifier",
  "",
  undefined,
  "unknown",
]) {
  claims = { isAdmin: true, adminType };
  await assert.rejects(service.getReport(), /Super admin/);
}
claims = { isAdmin: false, adminType: "super" };
await assert.rejects(service.getReport(), /Super admin/);
assert.equal(requests.length, before);
claims = { isAdmin: true, adminType: "super" };
for (const code of [400, 401, 403, 405, 500]) {
  status = code;
  body = { success: false, error: `API error ${code}` };
  await assert.rejects(service.getReport(), new RegExp(`API error ${code}`));
}
status = 200;
body = valid();
body.users[0].name = "";
body.users[0].imageurl = "";
assert.equal(
  (await service.getReport()).users.length,
  1,
  "Missing profiles must stay ranked",
);
body = valid();
body.totalUsers = 4;
body.totalRides = 20;
body.topUsersRides = 4;
body.topUsersSharePercent = 20;
body.users[0].sharePercent = 20;
data = await service.getReport();
assert.equal(
  data.users[0].sharePercent,
  20,
  "Never renormalize shares to returned users",
);
assert.equal(data.count, 1);
body = valid();
body.count = 2;
body.totalUsers = 2;
body.totalRides = 8;
body.topUsersRides = 8;
body.users[0].sharePercent = 50;
body.users.push({
  ...body.users[0],
  rank: 2,
  userid: "user_002",
  name: "Aaron",
});
data = await service.getReport();
assert.deepEqual(
  Array.from(data.users, (u) => u.userid),
  ["user_001", "user_002"],
  "Preserve API tie-break order instead of sorting by name",
);
body = {
  ...valid(),
  count: 0,
  totalUsers: 0,
  totalRides: 0,
  topUsersRides: 0,
  topUsersSharePercent: 0,
  users: [],
  coverage: { ordersScanned: 0, invalidCustomerId: 0, unsupportedService: 0 },
};
data = await service.getReport();
assert.equal(data.users.length, 0);
assert.equal(data.topUsersSharePercent, 0);
for (const mutate of [
  (b) => (b.topUsersSharePercent = 10000),
  (b) => (b.users[0].sharePercent = -1),
  (b) => (b.users[0].services.expressshipmenr = "1"),
  (b) => (b.count = 2),
  (b) => (b.weekEnd = "bad"),
  (b) => (b.top = 15),
  (b) => delete b.coverage,
]) {
  body = valid();
  mutate(body);
  await assert.rejects(service.getReport(), /invalid weekly concentration/);
}
malformed = true;
await assert.rejects(service.getReport(), /invalid weekly concentration/);
malformed = false;
body = valid();
const controller = new AbortController();
await service.getReport({}, controller.signal);
assert.equal(requests.at(-1).options.signal, controller.signal);
controller.abort();
await assert.rejects(
  service.getReport({}, controller.signal),
  (e) => e.name === "AbortError",
);
context.auth.currentUser = null;
await assert.rejects(service.getReport(), /Sign in/);
console.log(
  "Weekly concentration tests passed: super-only bearer auth, exact top choices/date/defaults, raw percentage scale, service spellings, missing profiles, tie order, empty weeks, weekly denominators, response validation, HTTP errors, and cancellation.",
);

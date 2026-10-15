import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { z } from "zod";
const valid = () => ({
  success: true,
  users: [
    {
      userid: "user_001",
      createdAt: "2026-10-01T00:00:00.000Z",
      firstOrderAt: "2026-10-01T12:00:00.000Z",
      timeToFirstOrderDays: 0.5,
      status: "activated",
    },
    {
      userid: "user_002",
      createdAt: "2026-10-02T00:00:00.000Z",
      firstOrderAt: null,
      timeToFirstOrderDays: null,
      status: "no_orders",
    },
  ],
  pageSummary: {
    totalUsers: 2,
    eligibleUsers: 2,
    activatedUsers: 1,
    noOrderUsers: 1,
    invalidUsers: 0,
    activationRate: 0.5,
    averageTimeToFirstOrderDays: 0.5,
  },
  nextPageToken: null,
});
let body = valid();
let status = 200;
let malformed = false;
let claims = { isAdmin: true, adminType: "super" };
const requests = [];
const context = vm.createContext({
  exports: {},
  URL,
  URLSearchParams,
  z,
  auth: {
    currentUser: {
      getIdToken: async (force) => {
        assert.equal(force, true);
        return "id-token";
      },
      getIdTokenResult: async () => ({ claims }),
    },
  },
  endpoints: {
    getAdminTimeToFirstOrder:
      "https://getAdminTimeToFirstOrder-example.a.run.app",
  },
  fetch: async (url, options) => {
    if (options.signal?.aborted) throw options.signal.reason;
    requests.push({ url, options });
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => {
        if (malformed) throw new Error("Invalid JSON");
        return body;
      },
    };
  },
});
const source = fs
  .readFileSync("src/services/admin-time-to-first-order.service.ts", "utf8")
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
const service = context.exports.adminTimeToFirstOrderService;
let data = await service.getPage();
assert.deepEqual(JSON.parse(JSON.stringify(data)), valid());
assert.equal(new URL(requests[0].url).search, "?pageSize=50");
assert.equal(requests[0].options.method, "GET");
assert.equal(requests[0].options.headers.Authorization, "Bearer id-token");
assert.equal(requests[0].options.cache, "no-store");
body.nextPageToken = "token+/ ?&=";
await service.getPage({ pageSize: 200, pageToken: body.nextPageToken });
assert.equal(new URL(requests.at(-1).url).searchParams.get("pageSize"), "200");
assert.equal(
  new URL(requests.at(-1).url).searchParams.get("pageToken"),
  body.nextPageToken,
);
await service.getPage({ id: "user/with?&=characters" });
assert.equal(
  new URL(requests.at(-1).url).searchParams.get("id"),
  "user/with?&=characters",
);
assert.deepEqual([...new URL(requests.at(-1).url).searchParams.keys()], ["id"]);
const before = requests.length;
for (const params of [
  { id: "x", pageSize: 50 },
  { id: "x", pageToken: "cursor" },
  { id: " " },
  { pageSize: 0 },
  { pageSize: 201 },
  { pageSize: 1.5 },
  { pageSize: NaN },
  { pageToken: "" },
  { pageToken: 42 },
])
  await assert.rejects(service.getPage(params));
assert.equal(requests.length, before);
for (const adminType of [
  "regular",
  "customercare",
  "verifier",
  "",
  undefined,
  "unknown",
]) {
  claims = { isAdmin: true, adminType };
  await assert.rejects(service.getPage(), /Super admin access/);
}
claims = { isAdmin: false, adminType: "super" };
await assert.rejects(service.getPage(), /Super admin access/);
assert.equal(requests.length, before);
claims = { isAdmin: true, adminType: "super" };
for (const code of [400, 401, 403, 404, 405, 500]) {
  status = code;
  body = { success: false, error: `API error ${code}` };
  await assert.rejects(
    service.getPage(),
    (e) => e.status === code && e.message === `API error ${code}`,
  );
}
status = 200;
body = { success: false, error: "Rejected" };
await assert.rejects(service.getPage(), /Rejected/);
body = valid();
body.users.push(
  ...[
    "invalid_created_at",
    "invalid_order_created_at",
    "order_before_signup",
  ].map((status, index) => ({
    userid: `invalid-${index}`,
    createdAt: null,
    firstOrderAt: null,
    timeToFirstOrderDays: null,
    status,
  })),
);
assert.equal((await service.getPage()).users.length, 5);
body = {
  success: true,
  users: [],
  pageSummary: {
    totalUsers: 0,
    eligibleUsers: 0,
    activatedUsers: 0,
    noOrderUsers: 0,
    invalidUsers: 0,
    activationRate: null,
    averageTimeToFirstOrderDays: null,
  },
  nextPageToken: null,
};
assert.equal((await service.getPage()).pageSummary.activationRate, null);
for (const mutate of [
  (b) => (b.pageSummary.activationRate = 50),
  (b) => (b.pageSummary.totalUsers = -1),
  (b) => (b.users[0].status = "unknown"),
  (b) => (b.nextPageToken = 42),
  (b) => (b.users[0].timeToFirstOrderDays = "0.5"),
  (b) => delete b.pageSummary,
]) {
  body = valid();
  mutate(body);
  await assert.rejects(service.getPage(), /invalid user activation response/);
}
malformed = true;
await assert.rejects(service.getPage(), /invalid user activation response/);
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
  "User activation tests passed: Firebase bearer auth, query encoding/defaults/limits, exclusive lookup, cursor/null handling, five statuses, nullable summaries, response validation, HTTP errors, and abort signals.",
);

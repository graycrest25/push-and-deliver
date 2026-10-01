import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function loadSource(path, context) {
  const source = fs
    .readFileSync(path, "utf8")
    .replace(/^import[\s\S]*?from ["'][^"']+["'];\n/gm, "");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
  });
  vm.runInContext(outputText.replace(/export /g, ""), context);
}

const requests = [];
const refreshes = [];
let claims = { isAdmin: true, adminType: "super" };
let response = {
  success: true,
  uid: "target",
  isAdmin: true,
  adminType: "regular",
};
let statusOk = true;
let failPostChangeRefresh = false;
const caller = {
  uid: "caller",
  getIdToken: async (force) => {
    refreshes.push(force);
    if (failPostChangeRefresh && refreshes.length === 2)
      throw new Error("offline");
    return "fresh-id-token";
  },
  getIdTokenResult: async () => ({ claims }),
};
const context = vm.createContext({
  auth: { currentUser: caller },
  endpoints: { manageAdminStatus: "manage-url" },
  isAdminType: (value) =>
    ["super", "regular", "customercare", "verifier"].includes(value),
  fetch: async (url, options) => {
    requests.push({ url, ...options });
    return { ok: statusOk, json: async () => response };
  },
});
loadSource("src/services/admin-management.service.ts", context);

let result = await context.manageAdminStatus("target", "regular");
assert.equal(result.adminType, "regular");
assert.equal(requests[0].method, "POST");
assert.equal(requests[0].headers.Authorization, "Bearer fresh-id-token");
assert.equal(requests[0].headers["Content-Type"], "application/json");
assert.deepEqual(JSON.parse(requests[0].body), {
  uid: "target",
  adminType: "regular",
});
assert.equal(
  refreshes[0],
  true,
  "Privileged requests must refresh caller claims",
);

response = { success: true, uid: "target", isAdmin: false, adminType: "" };
result = await context.manageAdminStatus("target", "");
assert.equal(result.isAdmin, false);
assert.equal(
  JSON.parse(requests[1].body).adminType,
  "",
  "Removal must send an empty role",
);

const count = requests.length;
claims = { isAdmin: true, adminType: "regular" };
await assert.rejects(
  context.manageAdminStatus("target", "super"),
  /Super admin access/,
);
assert.equal(
  requests.length,
  count,
  "Non-super callers must not submit a change",
);
context.auth.currentUser = null;
await assert.rejects(context.manageAdminStatus("target", "regular"), /Sign in/);
context.auth.currentUser = caller;
await assert.rejects(
  context.manageAdminStatus("target", "invalid"),
  /valid admin role/,
);
claims = { isAdmin: true, adminType: "super" };
statusOk = false;
response = { success: false, error: "Admin access is required" };
await assert.rejects(
  context.manageAdminStatus("target", "regular"),
  /Admin access is required/,
);
statusOk = true;
response = {
  success: true,
  uid: "wrong-target",
  isAdmin: true,
  adminType: "regular",
};
await assert.rejects(
  context.manageAdminStatus("target", "regular"),
  /unexpected admin status/,
);

response = { success: true, uid: "caller", isAdmin: false, adminType: "" };
refreshes.length = 0;
result = await context.manageAdminStatus("caller", "");
assert.deepEqual(
  refreshes,
  [true, true],
  "Self changes refresh before the request and after the server changes claims",
);
refreshes.length = 0;
failPostChangeRefresh = true;
result = await context.manageAdminStatus("caller", "");
assert.equal(
  result.success,
  true,
  "A refresh failure must not misreport a successful server mutation as failed",
);
assert.equal(result.sessionRefreshRequired, true);

// Admin listing uses opaque Auth pagination tokens, not Firestore cursors.
failPostChangeRefresh = false;
context.URL = URL;
context.endpoints.listAdminUsers = "https://listAdminUsers-example.a.run.app";
response = {
  success: true,
  count: 1,
  scannedCount: 100,
  pageSize: 100,
  nextPageToken: "NEXT+/=&",
  users: [
    {
      name: "Jane Doe",
      imageurl: null,
      email: "jane@example.com",
      userid: "target",
      isAdmin: true,
      adminType: "super",
    },
  ],
};
let list = await context.listAdminUsers();
let listRequest = requests.at(-1);
let listUrl = new URL(listRequest.url);
assert.equal(listRequest.method, "GET");
assert.equal(listRequest.headers.Authorization, "Bearer fresh-id-token");
assert.equal(listRequest.body, undefined);
assert.equal(listUrl.searchParams.get("pageSize"), "100");
assert.equal(
  listUrl.searchParams.has("pageToken"),
  false,
  "First requests must omit the token",
);
assert.equal(list.count, 1);
assert.equal(
  list.scannedCount,
  100,
  "Scanned accounts must not be mistaken for admins returned",
);
response = {
  success: true,
  count: 0,
  scannedCount: 10,
  pageSize: 10,
  nextPageToken: "CONTINUE",
  users: [],
};
list = await context.listAdminUsers({ pageSize: 10, pageToken: "NEXT+/=&" });
listUrl = new URL(requests.at(-1).url);
assert.equal(
  listUrl.searchParams.get("pageToken"),
  "NEXT+/=&",
  "Tokens must round-trip through URL encoding",
);
assert.equal(list.count, 0);
assert.equal(
  list.nextPageToken,
  "CONTINUE",
  "Empty admin batches may still have another page",
);
response = {
  ...response,
  pageSize: 1000,
  scannedCount: 1000,
  nextPageToken: null,
};
list = await context.listAdminUsers({ pageSize: 1000 });
assert.equal(list.nextPageToken, null);
response = {
  success: true,
  count: 1,
  pageSize: 10,
  scannedCount: 68,
  nextPageToken: null,
  users: [
    {
      name: "Paul David ",
      imageurl: "",
      email: "ebinehitadavid@outlook.com",
      userid: "YZihZDlSfVfv9jqlcWXMp4oa2p23",
      isAdmin: true,
      adminType: "super",
    },
  ],
};
list = await context.listAdminUsers({ pageSize: 10 });
assert.equal(list.count, 1);
assert.equal(list.scannedCount, 68);
assert.equal(list.users[0].imageurl, "");
assert.equal(list.users[0].adminType, "super");
assert.equal(list.nextPageToken, null);
for (const pageSize of [0, 1001, 2.5])
  await assert.rejects(context.listAdminUsers({ pageSize }), /Page size/);
await assert.rejects(
  context.listAdminUsers({ pageToken: "" }),
  /Omit the page token/,
);
statusOk = false;
response = { success: false, error: "Only super admins can list admin users" };
await assert.rejects(context.listAdminUsers(), /Only super admins/);
statusOk = true;
response = {
  success: true,
  count: 99,
  scannedCount: 100,
  pageSize: 100,
  nextPageToken: null,
  users: [],
};
await assert.rejects(context.listAdminUsers(), /invalid admin list response/);
claims = { isAdmin: true, adminType: "regular" };
const beforeForbiddenList = requests.length;
await assert.rejects(context.listAdminUsers(), /Only super admins/);
assert.equal(requests.length, beforeForbiddenList);
claims = { isAdmin: true, adminType: "super" };

let now = 10_000;
let refreshed = 0;
let tick;
let cleared = false;
const windowEvents = new Map();
const documentEvents = new Map();
const refreshContext = vm.createContext({
  Date: { now: () => now },
  console,
  window: {
    setInterval: (callback, delay) => {
      assert.equal(delay, 60_000);
      tick = callback;
      return 1;
    },
    clearInterval: () => {
      cleared = true;
    },
    addEventListener: (name, callback) => windowEvents.set(name, callback),
    removeEventListener: (name) => windowEvents.delete(name),
  },
  document: {
    visibilityState: "visible",
    addEventListener: (name, callback) => documentEvents.set(name, callback),
    removeEventListener: (name) => documentEvents.delete(name),
  },
});
loadSource("src/lib/admin-claims-refresh.ts", refreshContext);
const stop = refreshContext.startAdminClaimsRefresh(async () => {
  refreshed++;
});
await new Promise((resolve) => setImmediate(resolve));
assert.equal(refreshed, 1, "Restore/mount refreshes claims");
now += 2000;
await windowEvents.get("focus")();
assert.equal(refreshed, 2);
now += 60_000;
await tick();
assert.equal(refreshed, 3);
refreshContext.document.visibilityState = "hidden";
now += 60_000;
await tick();
assert.equal(refreshed, 3, "Hidden tabs must not poll");
refreshContext.document.visibilityState = "visible";
await documentEvents.get("visibilitychange")();
assert.equal(refreshed, 4);
stop();
assert.equal(cleared, true);
assert.equal(windowEvents.size, 0);
assert.equal(documentEvents.size, 0);
now += 60_000;
await tick();
assert.equal(refreshed, 4, "Stopped refresh jobs must not run");

const page = fs.readFileSync("src/pages/admin/user-management.tsx", "utf8");
assert.ok(!page.includes("Current Role"));
assert.ok(
  !page.includes("usersService.updateUser("),
  "Role changes must use the backend",
);
assert.ok(page.includes("Admin Accounts"));
console.log(
  "Admin management tests passed: authenticated requests, removal, access/error handling, response validation, token refresh, refresh failure, focus/interval refresh, cleanup, tab wiring, GET admin listing, opaque token encoding, sparse batches, and final pages.",
);

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

// Listing reads AdminUsers and uses document IDs as pagination cursors.
failPostChangeRefresh = false;
const queries = [];
let documents = [
  { id: "doc-1", data: () => ({ name: "Deen Kasim", email: "kzyjrofficial@gmail.com", imageurl: "https://example.com/avatar.jpg", userid: "auth-uid", adminType: "super" }) },
  { id: "doc-2", data: () => ({ userid: "second-uid", adminType: "regular" }) },
];
Object.assign(context, {
  db: {},
  collection: (_db, name) => ({ collection: name }),
  documentId: () => "__name__",
  orderBy: (field) => ({ orderBy: field }),
  startAfter: (cursor) => ({ startAfter: cursor }),
  limit: (value) => ({ limit: value }),
  query: (...parts) => parts,
  getDocs: async (parts) => { queries.push(parts); return { docs: documents }; },
});
const beforeList = requests.length;
let list = await context.listAdminUsers({ pageSize: 1 });
assert.equal(requests.length, beforeList, "Listing must not call the Auth listing endpoint");
assert.equal(queries[0][0].collection, "AdminUsers");
assert.equal(queries[0][1].orderBy, "__name__");
assert.equal(queries[0][2].limit, 2, "Fetch one extra document to detect the next page");
assert.equal(list.count, 1);
assert.equal(list.nextPageToken, "doc-1");
assert.equal(list.users[0].userid, "auth-uid", "Role actions use the userid field, not the document ID");
assert.equal(list.users[0].name, "Deen Kasim");
assert.equal(list.users[0].email, "kzyjrofficial@gmail.com");
assert.equal(list.users[0].imageurl, "https://example.com/avatar.jpg");
assert.equal(list.users[0].isAdmin, true, "The collection does not require an isAdmin field");
documents = documents.slice(1);
list = await context.listAdminUsers({ pageSize: 1, pageToken: "doc-1" });
assert.equal(queries.at(-1)[2].startAfter, "doc-1");
assert.equal(list.nextPageToken, null);
assert.equal(list.users[0].name, null);
documents = [];
list = await context.listAdminUsers();
assert.equal(list.count, 0);
assert.equal(list.nextPageToken, null);
for (const pageSize of [0, 1001, 2.5])
  await assert.rejects(context.listAdminUsers({ pageSize }), /Page size/);
await assert.rejects(context.listAdminUsers({ pageToken: "" }), /Omit the page token/);
claims = { isAdmin: true, adminType: "regular" };
const beforeForbiddenList = queries.length;
await assert.rejects(context.listAdminUsers(), /Only super admins/);
assert.equal(queries.length, beforeForbiddenList);
claims = { isAdmin: true, adminType: "super" };
const controller = new AbortController();
controller.abort();
await assert.rejects(context.listAdminUsers({ signal: controller.signal }), /abort/i);
documents = [{ id: "bad", data: () => ({ userid: "target", adminType: "invalid" }) }];
await assert.rejects(context.listAdminUsers(), /invalid user ID or admin role/);

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
  "Admin management tests passed: authenticated requests, removal, access/error handling, response validation, token refresh, refresh failure, focus/interval refresh, cleanup, tab wiring, AdminUsers field mapping, document cursors, cancellation, and final pages.",
);

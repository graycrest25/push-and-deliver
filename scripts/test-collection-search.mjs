import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const documents = Array.from({ length: 623 }, (_, index) => ({
  id: `account-${index}`,
  data: () => ({
    name: index >= 500 && index < 526 ? "Ada Lovelace" : "Other",
    customer: { name: "Nested" },
    tags: ["delivery"],
  }),
}));
let reads = 0;
let fail = false;
const context = vm.createContext({
  query: (base, ...constraints) => ({ base, constraints }),
  limit: (size) => ({ kind: "limit", size }),
  startAfter: (cursor) => ({ kind: "cursor", cursor }),
  getDocs: async (q) => {
    if (fail) throw new Error("permission-denied");
    reads++;
    const cursor = q.constraints.find((item) => item.kind === "cursor")?.cursor;
    const size = q.constraints.find((item) => item.kind === "limit").size;
    assert.ok(size <= 250, "Collection reads must stay bounded");
    const start = cursor ? documents.indexOf(cursor) + 1 : 0;
    const docs = documents.slice(start, start + size);
    return { docs, size: docs.length, empty: docs.length === 0 };
  },
  getCountFromServer: () => {
    throw new Error("Search totals must count matches");
  },
});
const source = fs
  .readFileSync("src/lib/firestore-pagination.ts", "utf8")
  .replace(/^import[\s\S]*?from ["'][^"']+["'];\n/gm, "");
vm.runInContext(
  ts
    .transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
      },
    })
    .outputText.replace(/export /g, ""),
  context,
);
let info;
const options = {
  pageSize: 10,
  search: { term: " aDA ", fields: ["name"] },
  searchCache: {},
  onPage: (data) => {
    info = data;
  },
};
const first = await context.getPaginatedDocs("authorized-query", options);
assert.equal(
  first.docs[0].id,
  "account-500",
  "Find records beyond the initially loaded page",
);
assert.equal(first.size, 10);
assert.equal(info.total, 26);
assert.equal(reads, 3);
const second = await context.getPaginatedDocs("authorized-query", {
  ...options,
  cursor: info.lastDocument,
});
assert.equal(second.docs[0].id, "account-510");
const third = await context.getPaginatedDocs("authorized-query", {
  ...options,
  cursor: info.lastDocument,
});
assert.equal(third.size, 6);
assert.equal(reads, 3, "Pagination must reuse search results");
assert.equal(
  context.matchesSearch(documents[622], {
    term: "ACCOUNT-622",
    fields: ["id"],
  }),
  true,
);
assert.equal(
  context.matchesSearch(documents[0], {
    term: "nested",
    fields: ["customer.name"],
  }),
  true,
);
assert.equal(
  context.matchesSearch(documents[0], { term: "delivery", fields: ["tags"] }),
  true,
);
const empty = await context.getPaginatedDocs("authorized-query", {
  search: { term: "missing", fields: ["name"] },
  onPage: (data) => {
    info = data;
  },
});
assert.equal(empty.empty, true);
assert.equal(info.total, 0);
let errors = 0;
fail = true;
await assert.rejects(
  context.getPaginatedDocs("authorized-query", {
    ...options,
    searchCache: {},
    onError: () => errors++,
  }),
  /permission-denied/,
);
assert.equal(errors, 1);
fail = false;
await assert.rejects(
  context.getPaginatedDocs("authorized-query", {
    ...options,
    searchCache: {},
    isCurrent: () => false,
  }),
  /superseded/,
);
// Related names can be resolved independently of the record's stored fields.
const related = await context.getPaginatedDocs("authorized-query", {
  search: {
    term: "related name",
    fields: [],
    matches: async (doc) => doc.id === "account-622",
  },
});
assert.equal(related.docs[0].id, "account-622");
console.log(
  "Collection search passed: off-page results, matching totals/cursors, cached paging, IDs, nested/array fields, related names, empty results, errors, and obsolete queries.",
);

// Admin accounts use document-ID tokens rather than snapshot cursors.
const admins = Array.from({ length: 623 }, (_, index) => ({
  id: String(index).padStart(3, "0"),
  data: () => ({ userid: `uid-${index}`, adminType: "regular", name: index >= 500 && index < 526 ? "Ada" : "Other" }),
}));
Object.assign(context, {
  db: {},
  collection: (_, name) => name,
  documentId: () => "__name__",
  orderBy: () => ({ kind: "order" }),
  auth: { currentUser: { uid: "caller", getIdToken: async () => "token", getIdTokenResult: async () => ({ claims: { isAdmin: true, adminType: "super" } }) } },
  isAdminType: (type) => ["super", "regular", "customercare", "verifier"].includes(type),
  getDocs: async (q) => {
    const token = q.constraints.find((item) => item.kind === "cursor")?.cursor;
    const size = q.constraints.find((item) => item.kind === "limit").size;
    const start = token ? admins.findIndex((doc) => doc.id === token) + 1 : 0;
    const docs = admins.slice(start, start + size);
    return { docs, size: docs.length };
  },
});
const adminSource = fs.readFileSync("src/services/admin-management.service.ts", "utf8").replace(/^import[\s\S]*?from ["'][^"']+["'];\n/gm, "");
vm.runInContext(ts.transpileModule(adminSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText.replace(/export /g, ""), context);
const adminFirst = await context.listAdminUsers({ pageSize: 10, searchTerm: "ADA" });
assert.equal(adminFirst.users[0].userid, "uid-500");
assert.equal(adminFirst.nextPageToken, "509");
const adminSecond = await context.listAdminUsers({ pageSize: 10, searchTerm: "Ada", pageToken: adminFirst.nextPageToken });
assert.equal(adminSecond.users[0].userid, "uid-510");
const adminThird = await context.listAdminUsers({ pageSize: 10, searchTerm: "Ada", pageToken: adminSecond.nextPageToken });
assert.equal(adminThird.users.length, 6);
assert.equal(adminThird.nextPageToken, null);
console.log("Admin collection search passed: off-page names, filtered continuation tokens, and final search page.");

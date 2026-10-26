import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

let claims = { isAdmin: true, adminType: "super" };
const valid = () => ({
  currency: "NGN",
  weightUnit: "kg",
  rates: [
    { weight: 0.5, amount: 5513.84 },
    { weight: 1, amount: 5598.39 },
  ],
});
let documents = new Map(
  ["abv", "iba", "kad", "los", "phc", "qrw"].map((id) => [id, valid()]),
);
const reads = [];
const writes = [];
let failId;
const snapshot = (id) => ({
  exists: () => documents.has(id),
  data: () => documents.get(id),
});
const context = vm.createContext({
  Error,
  db: {},
  auth: { currentUser: { getIdTokenResult: async () => ({ claims }) } },
  doc: (_db, collection, id) => {
    assert.equal(collection, "DHL_LOCAL");
    return id;
  },
  getDoc: async (id) => {
    reads.push(id);
    if (id === failId) throw new Error("permission-denied");
    return snapshot(id);
  },
  runTransaction: async (_db, callback) =>
    callback({
      get: async (id) => snapshot(id),
      update: (id, fields) => {
        writes.push({ id, fields });
        documents.set(id, { ...documents.get(id), ...fields });
      },
    }),
});
function load(path) {
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
load("src/lib/admin-access.ts");
load("src/services/dhl-local.service.ts");
const service = vm.runInContext("dhlLocalService", context);
const validate = vm.runInContext("validateDHLLocalConfig", context);

for (const role of [
  "super",
  "regular",
  "customercare",
  "verifier",
  "",
  "unknown",
]) {
  assert.equal(
    context.canAccessAdminScreen(role, "/dhl-local"),
    context.canAccessAdminScreen(role, "/dhl-zones"),
  );
  assert.equal(
    context.canAccessAdminScreen(role, "/dhl-local/abv"),
    role === "super",
  );
}
for (const denied of [
  { isAdmin: false, adminType: "super" },
  ...["regular", "customercare", "verifier", "unknown"].map((adminType) => ({
    isAdmin: true,
    adminType,
  })),
]) {
  claims = denied;
  await assert.rejects(() => service.getDocuments(), /DHL admin access/);
  await assert.rejects(
    () => service.updateDocument("abv", valid(), valid()),
    /DHL admin access/,
  );
}
assert.equal(reads.length, 0);
assert.equal(writes.length, 0);
const signedIn = context.auth.currentUser;
context.auth.currentUser = null;
await assert.rejects(() => service.getDocuments(), /Sign in/);
await assert.rejects(
  () => service.updateDocument("abv", valid(), valid()),
  /Sign in/,
);
context.auth.currentUser = signedIn;
claims = { isAdmin: true, adminType: "super" };
const loaded = await service.getDocuments();
assert.deepEqual(reads, ["abv", "iba", "kad", "los", "phc", "qrw"]);
assert.equal(loaded.length, 6);
assert.equal(loaded[0].config.rates[0].amount, 5513.84);

documents.delete("iba");
documents.set("kad", { ...valid(), rates: [{ weight: 1 }] });
failId = "phc";
const partial = await service.getDocuments();
assert.match(partial.find((item) => item.id === "iba").error, /not found/);
assert.match(partial.find((item) => item.id === "kad").error, /Rate 1/);
assert.match(
  partial.find((item) => item.id === "phc").error,
  /permission-denied/,
);
assert.ok(partial.find((item) => item.id === "los").config);
failId = undefined;

for (const invalid of [
  { ...valid(), currency: "" },
  { ...valid(), currency: "ngn" },
  { ...valid(), weightUnit: " " },
  { ...valid(), rates: [] },
  ...[0, -1, NaN, Infinity, "1"].map((weight) => ({
    ...valid(),
    rates: [{ weight, amount: 1 }],
  })),
  ...[-1, NaN, Infinity, "1"].map((amount) => ({
    ...valid(),
    rates: [{ weight: 1, amount }],
  })),
  {
    ...valid(),
    rates: [
      { weight: 1, amount: 0 },
      { weight: 1, amount: 50 },
    ],
  },
])
  assert.throws(() => validate(invalid));
assert.equal(
  validate({ ...valid(), rates: [{ weight: 0.5, amount: 0 }] }).rates[0].amount,
  0,
);
await assert.rejects(
  () => service.updateDocument("../DHL", valid(), valid()),
  /Invalid DHL Local document/,
);
await assert.rejects(
  () => service.updateDocument("iba", valid(), valid()),
  /no longer exists/,
);
assert.equal(writes.length, 0);

documents.set("abv", {
  ...valid(),
  note: "keep",
  rates: [
    { weight: 0.5, amount: 5513.84, note: "keep rate metadata" },
    { weight: 1, amount: 5598.39 },
  ],
});
const original = valid();
const edited = {
  currency: "USD",
  weightUnit: "lb",
  rates: [
    { weight: 0.5, amount: 6000.01 },
    { weight: 2, amount: 7000 },
  ],
};
const saved = await service.updateDocument("abv", edited, original);
assert.equal(saved.currency, "USD");
assert.equal(documents.get("abv").note, "keep");
assert.equal(documents.get("abv").rates[0].note, "keep rate metadata");
assert.equal(documents.get("abv").rates[0].amount, 6000.01);
assert.equal(documents.get("abv").rates[1].weight, 2);
await assert.rejects(
  () => service.updateDocument("abv", valid(), original),
  /changed since you loaded/,
);
assert.equal(writes.length, 1, "Stale edits must not overwrite a newer update");
console.log(
  "DHL Local passed: exact six reads, role parity, denied access, partial failures, numeric validation, safe updates, and concurrent-edit protection.",
);

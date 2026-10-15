import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
function load(path, context) {
  const source = fs
    .readFileSync(path, "utf8")
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
}
let claims = { isAdmin: true, adminType: "super" };
let fail = false;
const operations = [];
const offices = [
  {
    id: "ibadan-doc",
    data: () => ({
      id: "wrong-field-id",
      location: "Ibadan",
      address: "Omooke Plaza",
      active: true,
      geolocation: {
        latitude: 7.3752039724532334,
        longitude: 3.9017139001750625,
      },
    }),
  },
  { id: "lagos-doc", data: () => ({ location: "Lagos", active: false }) },
];
const context = vm.createContext({
  exports: {},
  db: {},
  auth: { currentUser: { getIdTokenResult: async () => ({ claims }) } },
  GeoPoint: class {
    constructor(latitude, longitude) {
      this.latitude = latitude;
      this.longitude = longitude;
    }
  },
  collection: (_db, name) => name,
  doc: (_db, name, id) => `${name}/${id}`,
  getDocs: async (path) => {
    operations.push(["read", path]);
    if (fail) throw new Error("permission-denied");
    return { docs: offices };
  },
  addDoc: async (path, data) => {
    operations.push(["create", path, data]);
    if (fail) throw new Error("write failed");
    return { id: "new-doc" };
  },
  updateDoc: async (path, data) => {
    operations.push(["update", path, data]);
    if (fail) throw new Error("write failed");
  },
  deleteDoc: async (path) => {
    operations.push(["delete", path]);
    if (fail) throw new Error("write failed");
  },
});
load("src/lib/require-super-admin.ts", context);
context.requireSuperAdmin = context.exports.requireSuperAdmin;
load("src/services/head-offices.service.ts", context);
const service = context.exports.headOfficesService;
const result = await service.getAll();
assert.deepEqual(
  Array.from(result, (o) => o.id),
  ["ibadan-doc", "lagos-doc"],
);
assert.equal(
  result[1].active,
  false,
  "Inactive offices must stay visible for history",
);
const input = {
  location: " Ibadan ",
  address: " Omooke Plaza ",
  latitude: 7.3752039724532334,
  longitude: 3.9017139001750625,
  active: true,
};
assert.equal(await service.create(input), "new-doc");
const create = operations.at(-1);
assert.equal(create[1], "HeadOfficeAddress");
assert.equal(create[2].location, "Ibadan");
assert.equal(create[2].address, "Omooke Plaza");
assert.equal(create[2].active, true);
assert.equal(create[2].geolocation.latitude, input.latitude);
assert.equal(create[2].geolocation.longitude, input.longitude);
await service.setActive("ibadan-doc", false);
assert.equal(operations.at(-1)[1], "HeadOfficeAddress/ibadan-doc");
assert.deepEqual(Object.keys(operations.at(-1)[2]), ["active"]);
assert.equal(operations.at(-1)[2].active, false);
await service.setActive("ibadan-doc", true);
assert.equal(operations.at(-1)[2].active, true);
await service.delete("ibadan-doc");
assert.equal(operations.at(-1)[1], "HeadOfficeAddress/ibadan-doc");
assert.equal(
  operations.filter(([kind]) => kind === "delete").length,
  1,
  "Delete must not touch shipments",
);
const before = operations.length;
for (const adminType of [
  "regular",
  "customercare",
  "verifier",
  "",
  undefined,
]) {
  claims = { isAdmin: true, adminType };
  for (const action of [
    () => service.getAll(),
    () => service.create(input),
    () => service.setActive("office", true),
    () => service.delete("office"),
  ])
    await assert.rejects(action(), /Super admin/);
}
claims = { isAdmin: false, adminType: "super" };
await assert.rejects(service.getAll(), /Super admin/);
context.auth.currentUser = null;
await assert.rejects(service.getAll(), /Sign in/);
assert.equal(
  operations.length,
  before,
  "Forbidden callers must not access Firestore",
);
context.auth.currentUser = {
  getIdTokenResult: async () => ({
    claims: { isAdmin: true, adminType: "super" },
  }),
};
for (const changes of [
  { location: " " },
  { address: "" },
  { latitude: 91 },
  { latitude: -91 },
  { latitude: NaN },
  { longitude: 181 },
  { longitude: -181 },
  { longitude: Infinity },
  { active: "true" },
])
  await assert.rejects(service.create({ ...input, ...changes }));
assert.equal(operations.length, before, "Invalid inputs must not write");
await service.create({ ...input, latitude: 0, longitude: 0 });
fail = true;
await assert.rejects(service.setActive("id", false), /write failed/);
await assert.rejects(service.delete("id"), /write failed/);
await assert.rejects(service.getAll(), /permission-denied/);
fail = false;
const reads = [];
context.console = { error() {} };
context.query = (base, ...constraints) => ({ base, constraints });
context.orderBy = (field, direction) => ({ kind: "orderBy", field, direction });
context.where = (field, op, value) => ({ kind: "where", field, op, value });
context.getPaginatedDocs = async (q, options) => {
  reads.push({ q, options });
  return { docs: [] };
};
load("src/services/shipment-orders.service.ts", context);
const shipments = context.exports.shipmentOrdersService;
const page = { pageSize: 25, cursor: "page-cursor" };
await shipments.getAllOrders(page, "ibadan-doc");
assert.equal(reads[0].q.base, "ShippmentOrders");
const eq = reads[0].q.constraints.find((c) => c.kind === "where");
assert.equal(eq.field, "pndofficelocationID");
assert.equal(eq.op, "==");
assert.equal(eq.value, "ibadan-doc");
assert.equal(
  reads[0].options,
  page,
  "Keep cursor and page size for the filtered query",
);
await shipments.getAllOrders(page);
assert.equal(
  reads[1].q.constraints.some((c) => c.kind === "where"),
  false,
);
context.auth.currentUser = {
  getIdTokenResult: async () => ({
    claims: { isAdmin: true, adminType: "regular" },
  }),
};
await assert.rejects(shipments.getAllOrders(page, "ibadan-doc"), /Super admin/);
assert.equal(reads.length, 2);
await shipments.getAllOrders(page);
assert.equal(
  reads.length,
  3,
  "Existing non-super shipment access remains available",
);
console.log(
  "Head office tests passed: claim guards, document IDs, GeoPoint precision, CRUD, validation, failed writes, inactive history, and server-side shipment filtering before pagination.",
);

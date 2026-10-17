import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const examples = JSON.parse(
  fs.readFileSync("docs/examples/summary-responses.json", "utf8"),
);
let body;
let ok = true;
let rejectFetch = false;
const requests = [];
const user = { uid: "admin", getIdToken: async () => "firebase-id-token" };
const context = vm.createContext({
  URL,
  Date,
  Number,
  AbortController,
  auth: { currentUser: user },
  endpoints: {
    getAdminOrderSummary: "https://example.com/getAdminOrderSummary",
  },
  fetch: async (url, options) => {
    requests.push({ url, options });
    if (rejectFetch) throw new Error("Network unavailable");
    return { ok, json: async () => body };
  },
});
const source = fs
  .readFileSync("src/services/order-summary.service.ts", "utf8")
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
const signal = new AbortController().signal;
for (const type of ["shipment", "ride-courier", "food", "ecommerce"]) {
  body = examples[type];
  const result = await context.getOrderSummary(type, signal);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), body);
  const request = requests.at(-1);
  assert.equal(request.options.method, "GET");
  assert.equal(
    request.options.headers.Authorization,
    "Bearer firebase-id-token",
  );
  assert.equal(request.options.cache, "no-store");
  assert.equal(request.options.signal, signal);
  const url = new URL(request.url);
  assert.deepEqual(
    [...url.searchParams.keys()],
    ["type"],
    "Summary requests must not carry table state",
  );
  assert.equal(url.searchParams.get("type"), type);
}
for (const invalid of [
  { ...examples.shipment, type: "food" },
  { ...examples.shipment, total: -1 },
  { ...examples.shipment, completed: 1001 },
  { ...examples.shipment, active: 0.5 },
  { ...examples.shipment, totalRevenue: "45000000" },
  { ...examples.shipment, completedRevenue: Infinity },
  { ...examples.shipment, unknownPayment: 20 },
  { ...examples.shipment, calculatedAt: "bad date" },
  { ...examples.shipment, calculatedAt: null },
  null,
]) {
  body = invalid;
  await assert.rejects(
    context.getOrderSummary("shipment", signal),
    /invalid order summary/,
  );
}
body = {
  type: "food",
  total: 0,
  paid: 0,
  unpaid: 0,
  unknownPayment: 0,
  totalRevenue: 0,
  calculatedAt: examples.food.calculatedAt,
};
assert.equal((await context.getOrderSummary("food", signal)).total, 0);
ok = false;
body = { error: "Admin access required" };
await assert.rejects(
  context.getOrderSummary("food", signal),
  /Admin access required/,
);
body = null;
await assert.rejects(context.getOrderSummary("food", signal), /Unable to load/);
ok = true;
rejectFetch = true;
await assert.rejects(
  context.getOrderSummary("food", signal),
  /Network unavailable/,
);
rejectFetch = false;
await assert.rejects(
  context.getOrderSummary("unknown", signal),
  /Invalid order summary type/,
);
const aborted = new AbortController();
aborted.abort();
const previousRequests = requests.length;
await assert.rejects(context.getOrderSummary("food", aborted.signal));
assert.equal(
  requests.length,
  previousRequests,
  "Aborted requests must not start a fetch",
);
context.auth.currentUser = null;
await assert.rejects(context.getOrderSummary("food", signal), /Sign in/);
console.log(
  "Order summary API tests passed: all four documented responses, global request scope, auth, errors, empty totals, cancellation, and malformed response rejection.",
);

// Exercise the independent card request lifecycle without mounting a table.
const slots = [];
const effects = [];
const pending = [];
let position = 0;
const ui = vm.createContext({
  Error,
  AbortController,
  Intl,
  React: {
    createElement: (type, props, ...children) => ({
      type,
      props: props ?? {},
      children,
    }),
  },
  getOrderSummary: (type, signal) =>
    new Promise((resolve, reject) =>
      pending.push({ type, signal, resolve, reject }),
    ),
  useState: (initial) => {
    const index = position++;
    slots[index] ??= { value: initial };
    return [
      slots[index].value,
      (value) => {
        slots[index].value =
          typeof value === "function" ? value(slots[index].value) : value;
      },
    ];
  },
  useEffect: (callback, deps) => {
    const index = position++;
    if (
      !slots[index] ||
      deps.some((value, i) => !Object.is(value, slots[index].deps[i]))
    ) {
      const cleanup = slots[index]?.cleanup;
      slots[index] = { deps };
      effects.push(() => {
        cleanup?.();
        slots[index].cleanup = callback();
      });
    }
  },
});
for (const name of [
  "Card",
  "CardContent",
  "CardHeader",
  "CardTitle",
  "Button",
  "Skeleton",
])
  ui[name] = name;
const component = fs
  .readFileSync("src/components/order-summary-cards.tsx", "utf8")
  .replace(/^import[\s\S]*?from ["'][^"']+["'];\n/gm, "");
vm.runInContext(
  ts
    .transpileModule(component, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        jsx: ts.JsxEmit.React,
      },
    })
    .outputText.replace(/export /g, ""),
  ui,
);
let tree;
let orderType = "shipment";
function render() {
  position = 0;
  tree = ui.OrderSummaryCards({ orderType });
  while (effects.length) effects.shift()();
}
function content(node) {
  if (Array.isArray(node)) return node.map(content).join("");
  return node && typeof node === "object"
    ? content(node.children)
    : String(node ?? "");
}
function nodes(node, type) {
  if (Array.isArray(node)) return node.flatMap((child) => nodes(child, type));
  if (!node || typeof node !== "object") return [];
  return [...(node.type === type ? [node] : []), ...nodes(node.children, type)];
}
const settle = async () => {
  await new Promise((resolve) => setImmediate(resolve));
  render();
};
render();
assert.equal(pending[0].type, "shipment");
assert.equal(tree.props["aria-busy"], true);
render();
assert.equal(
  pending.length,
  1,
  "Parent rerenders and table changes must not refetch summaries",
);
pending[0].resolve(examples.shipment);
await settle();
assert.equal(tree.props["aria-busy"], false);
assert.match(content(tree), /1000/);
assert.match(content(tree), /Delivered Shipments/);
assert.match(
  content(tree),
  /independent of table search, filters, and pagination/,
);
nodes(tree, "Button")[0].props.onClick();
render();
pending[1].reject(new Error("Summary service down"));
await settle();
assert.equal(tree.props.role, "alert");
assert.match(content(tree), /Summary service down/);
nodes(tree, "Button")[0].props.onClick();
render();
pending[2].resolve(examples.shipment);
await settle();
assert.equal(tree.props["aria-busy"], false);
orderType = "food";
render();
orderType = "ecommerce";
render();
assert.equal(pending[3].signal.aborted, true);
pending[4].resolve(examples.ecommerce);
pending[3].resolve(examples.food);
await settle();
assert.match(tree.props["aria-label"], /Ecommerce/);
assert.match(content(tree), /3000/);
assert.doesNotMatch(content(tree), /Paid Orders/);
for (const slot of slots) slot?.cleanup?.();
assert.equal(pending[4].signal.aborted, true);
for (const [page, type] of Object.entries({
  "shipment-orders": "shipment",
  "ride-hailing": "ride-courier",
  "restaurant-orders": "food",
  "product-orders": "ecommerce",
})) {
  const pageSource = fs.readFileSync(`src/pages/${page}/index.tsx`, "utf8");
  assert.ok(pageSource.includes(`<OrderSummaryCards orderType="${type}" />`));
  assert.doesNotMatch(
    pageSource,
    /const (totalShipments|totalRides|totalOrders) = orders.length/,
  );
}
console.log(
  "Order summary cards passed: independent loads, stable rerenders, retry, stale response suppression, abort cleanup, and all four page integrations.",
);

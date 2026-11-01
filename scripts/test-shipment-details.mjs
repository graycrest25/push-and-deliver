import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GeoPoint, Timestamp } from "firebase/firestore";

const require = createRequire(import.meta.url);
function load(file, imports = {}) {
  const context = vm.createContext({
    exports: {},
    Date,
    require: (name) => imports[name] ?? require(name),
  });
  vm.runInContext(
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    context,
  );
  return context.exports;
}
const types = load("src/types/index.ts", { "./export-rates": {} });
const status = load("src/lib/shipment-status.ts", { "@/types": types });
const utils = load("src/lib/utils.ts");
const cards = load("src/components/ui/card.tsx", {
  "@/lib/utils": utils,
  "@/components/section-help": { useTutorialsEnabled: () => false },
});
const { ShipmentOrderData } = load(
  "src/components/shipment-orders/shipment-order-data.tsx",
  {
    "@/components/ui/card": cards,
    "@/types": types,
    "@/lib/shipment-status": status,
  },
);
const timestamp = Timestamp.fromDate(new Date("2026-10-31T14:12:23Z"));
const location = {
  geohash: "s1e55b6gcy",
  geopoint: new GeoPoint(8.9668961, 4.3874051),
};
const order = {
  id: "document-id",
  breadthinCM: 0,
  cancelledAt: null,
  clearanceType: 0,
  clearancedocument: "",
  completedAt: null,
  country: "Nigeria",
  couponDiscount: 0,
  createdAt: timestamp.toDate(),
  customerID: "customer-id",
  customerName: "Test sender",
  customerPhonenumber: "+2340000000000",
  declinelist: [],
  dropoffAddress: "Kwara, Nigeria",
  dropoffLocation: location,
  heightinCM: 0,
  ispaid: false,
  itemImageURL: null,
  itemType: ["Clothes (Unbranded)"],
  itemvalue: 650000,
  localtype: "premium",
  localzone: "iba",
  orderStatus: 0,
  otp: 1860,
  paylater: true,
  paymentType: 0,
  pndofficeaddress: "Test PnD office",
  pndofficelocation: location,
  pndofficelocationID: "office-id",
  quoteID: "q".repeat(64),
  quoteType: "local",
  receiveremail: "receiver@example.com",
  receivername: "Test receiver",
  receiverphonenumber: "+2340000000001",
  riderAmount: 1290,
  riderCarColor: "",
  riderCarModel: "",
  riderCarName: "",
  riderCarPlateNumber: "",
  riderID: "",
  riderImageURL: "",
  riderName: "",
  riderPhoneNumber: "",
  senderemailaddress: "sender@example.com",
  shipmentID: "TEST01",
  shipmentType: 1,
  startoffAddress: "Lagos, Nigeria",
  startoffLocation: location,
  state: "Kwara",
  statusTimeline: [
    { status: 0, timestamp },
    { status: 5, timestamp },
  ],
  totalAmount: 86534.624,
  transactionID: "",
  usedCoupon: false,
  vehicleType: null,
  weightinKG: 20,
  widthinCM: 0,
};
const renderData = (value) =>
  renderToStaticMarkup(
    React.createElement(ShipmentOrderData, { order: value }),
  );
for (const variant of [
  { quoteType: "local", shipmentType: 1 },
  { quoteType: "international", shipmentType: 1 },
  { quoteType: "international", shipmentType: 0 },
]) {
  const html = renderData({ ...order, ...variant });
  for (const expected of [
    "Customer ID",
    "Quote ID",
    "Delivery OTP",
    "Rider amount",
    "Coupon discount",
    "State",
    "Breadth (cm)",
    "Clothes (Unbranded)",
    "650,000",
    "86,534.624",
    "1,290",
    "1860",
    "s1e55b6gcy",
    "8.9668961",
    "4.3874051",
    "Not set (null)",
    "None (empty list)",
    ">Empty<",
    ">No<",
    ">Yes<",
    "15:12:23",
    "Placed (0)",
    "Cancelled (5)",
  ]) {
    assert.ok(
      html.includes(expected),
      `Missing ${expected} for ${JSON.stringify(variant)}`,
    );
  }
  assert.match(html, /datetime="2026-10-31T14:12:23.000Z"/i);
  assert.ok(html.includes(">0</dd>"), "Zero dimensions must remain visible");
}
assert.match(
  renderData({
    ...order,
    additionalRecord: { items: [0, false, null], empty: {} },
  }),
  /Additional information/,
);
assert.match(
  renderData({ ...order, additionalRecord: { empty: {} } }),
  /Empty map/,
);
for (const ispaid of [true, false]) {
  assert.doesNotMatch(
    renderData({ ...order, orderStatus: 5, ispaid }),
    />Paid</,
  );
  assert.match(renderData({ ...order, orderStatus: 0, ispaid }), />Paid</);
}
const docs = renderData({
  ...order,
  packingListUrl: "https://example.com/packing.pdf",
  invoiceUrl: "https://example.com/invoice.pdf",
  clearancedocument: "javascript:alert(1)",
});
assert.match(docs, /href="https:\/\/example.com\/packing.pdf"/);
assert.match(docs, /href="https:\/\/example.com\/invoice.pdf"/);
assert.doesNotMatch(docs, /href="javascript:/);

// Render the real detail and list pages, with hooks supplied loaded records.
const ui = new Proxy(
  {},
  {
    get:
      (_, name) =>
      ({ children, className }) =>
        React.createElement(
          "div",
          { className, "data-test-ui": name },
          children,
        ),
  },
);
function renderPage(file, record, list = false, role = "regular") {
  let cursor = 0;
  const states = list
    ? [[record], false, "", 0]
    : [record, false, false, false];
  const imports = new Proxy(
    {
      react: {
        ...React,
        useState: () => [states[cursor++], () => {}],
        useEffect() {},
      },
      "react-router-dom": {
        useNavigate: () => () => {},
        useParams: () => ({ id: record.id }),
        Link: ui.Link,
      },
      "@/types": types,
      "@/contexts/UserContext": {
        useCurrentUser: () => ({
          user: { isAdmin: true, adminType: role },
          adminType: role,
        }),
      },
      "@/contexts/TableStateContext": {
        useTableState: (_key, initial) => [initial, () => {}],
      },
      "@/hooks/use-search-pagination": {
        useSearchPagination: () => ({ options: {} }),
      },
      "@/hooks/use-head-offices": { useHeadOffices: () => ({ offices: [] }) },
      "@/components/shipment-orders/shipment-order-data": { ShipmentOrderData },
      "@/components/shipment-orders/shipment-status-control": {
        ShipmentStatusControl: () => null,
      },
      "@/components/shipment-orders/shipment-fee-form": {
        ShipmentFeeForm: () => null,
      },
      "@/services/shipment-orders.service": {},
      "@/services/ridehailing.service": {},
    },
    {
      get: (target, name) =>
        target[name] ??
        (name.startsWith("@/components/") || name === "@tabler/icons-react"
          ? ui
          : undefined),
    },
  );
  const Page = load(file, imports).default;
  return renderToStaticMarkup(React.createElement(Page));
}
for (const [folder, cancelledStatus] of [
  ["shipment-orders", 5],
  ["ride-hailing", 4],
]) {
  for (const ispaid of [true, false]) {
    const record = {
      ...order,
      createdAt: undefined,
      cancelledAt: undefined,
      ispaid,
      paymentType: 1,
      orderStatus: cancelledStatus,
    };
    const detail = renderPage(`src/pages/${folder}/details.tsx`, record);
    assert.doesNotMatch(detail, />Paid<|>Unpaid<|Mark as Paid/);
    const list = renderPage(`src/pages/${folder}/index.tsx`, record, true);
    assert.match(list, /Payment status not applicable/);
    assert.doesNotMatch(list, /data-test-ui="Badge">(?:Paid|Unpaid)</);
    const active = renderPage(`src/pages/${folder}/details.tsx`, {
      ...record,
      orderStatus: 0,
    });
    assert.match(active, new RegExp(`>${ispaid ? "Paid" : "Unpaid"}<`));
  }
}
assert.match(
  renderPage("src/pages/shipment-orders/details.tsx", {
    ...order,
    paymentType: 1,
  }),
  /Mark as Paid/,
);
assert.doesNotMatch(
  renderPage(
    "src/pages/shipment-orders/details.tsx",
    { ...order, paymentType: 1 },
    false,
    "customercare",
  ),
  /Mark as Paid/,
);

// Reading records must retain explicit nulls and nested Firestore values.
const raw = {
  ...order,
  createdAt: timestamp,
  cancelledAt: null,
  completedAt: null,
};
const snapshot = { id: "document-id", exists: () => true, data: () => raw };
const { shipmentOrdersService } = load(
  "src/services/shipment-orders.service.ts",
  {
    "@/lib/require-super-admin": {},
    "@/lib/firestore-pagination": {
      getPaginatedDocs: async () => ({ docs: [snapshot] }),
    },
    "@/lib/firebase": { db: {} },
    "@/lib/endpoint": {},
    "@/lib/environment": {},
    "firebase/firestore": {
      doc() {},
      collection() {},
      query() {},
      orderBy() {},
      getDocFromServer: async () => snapshot,
      onSnapshot: (_ref, callback) => callback(snapshot),
    },
  },
);
const reads = [
  await shipmentOrdersService.getOrderById("document-id"),
  ...(await shipmentOrdersService.getAllOrders()),
];
shipmentOrdersService.subscribeToOrder("document-id", (value) =>
  reads.push(value),
);
for (const read of reads) {
  assert.equal(read.completedAt, null);
  assert.equal(read.cancelledAt, null);
  assert.equal(read.createdAt.toISOString(), "2026-10-31T14:12:23.000Z");
  assert.equal(read.dropoffLocation.geopoint.latitude, 8.9668961);
  assert.equal(read.statusTimeline[0].timestamp, timestamp);
}

// Optional static fixture for checking the real Card layout against built CSS.
if (process.env.SHIPMENT_REVIEW_HTML) {
  const css = fs
    .readdirSync("dist/assets")
    .find((name) => name.endsWith(".css"));
  fs.writeFileSync(
    process.env.SHIPMENT_REVIEW_HTML,
    `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="file://${process.cwd()}/dist/assets/${css}"></head><body><main class="p-6 mx-auto max-w-6xl"><h1 class="text-3xl font-bold mb-6">Shipment Details · TEST01</h1>${renderData(order)}</main></body></html>`,
  );
}
console.log(
  "Shipment details passed: complete local/international/clearance data, nested Firestore values, empty/zero/false values, document links, cancelled payment UI in details/lists, and payment permissions.",
);

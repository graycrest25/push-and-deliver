import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const requests = [];
let claims = { isAdmin: true, adminType: 'super' };
let shipment = { senderemailaddress: 'sender@example.com', id: 'display-id' };
let response = { success: true, authurl: 'https://checkout.paystack.com/example', reference: 'fee-001' };
let ok = true;
const context = vm.createContext({
  auth: { currentUser: {
    getIdToken: async (force) => { assert.equal(force, true); return 'firebase-token'; },
    getIdTokenResult: async () => ({ claims }),
  } },
  db: {},
  endpoints: { resloveShipmentFee: 'fee-endpoint' },
  doc: (_db, collection, id) => { assert.equal(collection, 'ShippmentOrders'); return { id }; },
  getDoc: async ({ id }) => ({ id, exists: () => true, data: () => shipment }),
  fetch: async (url, options) => {
    requests.push({ url, ...options });
    return { ok, json: async () => response };
  },
});
const source = fs.readFileSync('src/services/shipment-orders.service.ts', 'utf8')
  .replace(/^import[\s\S]*?from ["'][^"']+["'];\n/gm, '');
const { outputText } = ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
} });
vm.runInContext(outputText.replace(/export /g, '') + '\nglobalThis.service = shipmentOrdersService;', context);
const input = { orderId: 'document-id', amount: 1500, reference: 'fee-001' };
await context.service.resolveShipmentFee(input);
assert.equal(requests[0].url, 'fee-endpoint');
assert.equal(requests[0].method, 'POST');
assert.equal(requests[0].headers.Authorization, 'Bearer firebase-token');
assert.equal(requests[0].headers['Content-Type'], 'application/json');
assert.deepEqual(JSON.parse(requests[0].body), {
  email: 'sender@example.com', amount: 1500, reference: 'fee-001',
  metadata: { orderID: 'document-id', orderType: 'shipmentoder' },
});
await context.service.resolveShipmentFee({ ...input, newweightinKG: 2 });
assert.equal(JSON.parse(requests[1].body).metadata.newweightinKG, 2);
claims = { isAdmin: true, adminType: 'regular' };
await context.service.resolveShipmentFee(input);
assert.deepEqual(JSON.parse(requests[2].body), JSON.parse(requests[0].body));
for (const adminType of ['customercare', 'verifier', '', 'unknown']) {
  claims = { isAdmin: true, adminType };
  await assert.rejects(context.service.resolveShipmentFee(input), /Super or regular admin/);
}
for (const adminType of ['super', 'regular']) {
  claims = { isAdmin: false, adminType };
  await assert.rejects(context.service.resolveShipmentFee(input), /Super or regular admin/);
}
assert.equal(requests.length, 3);
claims = { isAdmin: true, adminType: 'super' };
for (const amount of [0, -1, NaN, Infinity]) {
  await assert.rejects(context.service.resolveShipmentFee({ ...input, amount }), /additional fee/);
}
await assert.rejects(context.service.resolveShipmentFee({ ...input, reference: 'bad reference!' }), /Reference/);
await assert.rejects(context.service.resolveShipmentFee({ ...input, newweightinKG: 0 }), /final weight/);
shipment = {};
await assert.rejects(context.service.resolveShipmentFee(input), /sender email/);
shipment = { senderemailaddress: 'sender@example.com' };
ok = false;
response = { success: false, error: 'Super admin access is required' };
await assert.rejects(context.service.resolveShipmentFee(input), /Super admin access/);
ok = true;
response = { success: true, reference: 'fee-001' };
await assert.rejects(context.service.resolveShipmentFee(input), /invalid shipment fee response/);
context.auth.currentUser = null;
await assert.rejects(context.service.resolveShipmentFee(input), /Sign in/);
console.log('Shipment fee tests passed: payload, document ID, sender email, optional weight, token, roles, validation, and API errors.');

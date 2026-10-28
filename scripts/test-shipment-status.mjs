import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as jsxRuntime from 'react/jsx-runtime';

function load(file, imports = {}, globals = {}) {
  const context = vm.createContext({
    exports: {}, Error, ...globals,
    require: (name) => name === 'react/jsx-runtime' ? jsxRuntime : imports[name] ?? {},
  });
  vm.runInContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, context);
  return context.exports;
}
const types = load('src/types/index.ts');
const flow = load('src/lib/shipment-status.ts', { '@/types': types });
const actions = (order) => Array.from(flow.getShipmentStatusActions(order), (action) => action.value);
for (const variant of [{ shipmentType: 1 }, { quoteType: 'local', shipmentType: 1 }, { quoteType: 'local', shipmentType: 0 }]) {
  for (const [status, expected] of [
    [0, ['Cancelled']], [1, ['Cancelled']], [6, ['SentToHq']],
    [2, ['OnrouteToDestination']], [3, ['DeliveredToDestination']], [4, []], [5, []],
  ]) assert.deepEqual(actions({ ...variant, orderStatus: status }), expected);
}
assert.deepEqual(actions({ shipmentType: 0, orderStatus: 0 }), ['SentToHq', 'Cancelled']);
assert.deepEqual(actions({ orderStatus: 3, paylater: true, ispaid: false }), []);
assert.deepEqual(actions({ orderStatus: 3, paylater: true, ispaid: true }), ['DeliveredToDestination']);
assert.deepEqual(actions({ orderStatus: 99 }), []);

const environment = { isDevelopmentMode: false };
const requests = [];
const tokenRefreshes = [];
let replies = [];
const auth = { currentUser: { getIdToken: async (force) => {
  tokenRefreshes.push(force);
  return force ? 'refreshed-token' : 'firebase-token';
} } };
const serviceModule = load('src/services/shipment-orders.service.ts', {
  '@/lib/firebase': { auth, db: {} },
  '@/lib/environment': environment,
  '@/lib/endpoint': { endpoints: { updateAdminShipmentOrderStatus: 'status-endpoint' } },
  'firebase/firestore': { updateDoc: () => assert.fail('Status must never write directly to Firestore') },
}, {
  fetch: async (url, options) => {
    requests.push({ url, ...options });
    const reply = replies.shift() ?? { status: 200, data: { success: true, orderId: 'document-id', orderStatus: 2, statusName: 'SentToHq', riderLocationUpdateDocID: null } };
    if (reply.networkError) throw new Error('Network unavailable');
    return { status: reply.status, ok: reply.status === 200, json: async () => {
      if (reply.nonJson) throw new Error('Invalid JSON');
      return reply.data;
    } };
  },
});
const { shipmentOrdersService: service, ShipmentStatusError } = serviceModule;
const result = await service.updateOrderStatus('document-id', 'SentToHq');
assert.equal(result.orderId, 'document-id');
assert.equal(requests[0].url, 'status-endpoint');
assert.equal(requests[0].method, 'POST');
assert.equal(requests[0].headers.Authorization, 'Bearer firebase-token');
assert.equal(requests[0].headers['Content-Type'], 'application/json');
assert.deepEqual(JSON.parse(requests[0].body), { orderId: 'document-id', orderStatus: 'SentToHq' });
for (const target of ['Placed', 'OnRouteToPndHQ', 'AcceptedByRider', '2', 2]) {
  await assert.rejects(service.updateOrderStatus('document-id', target), (error) => error.status === 400);
}
assert.equal(requests.length, 1, 'No rider assignment or pickup bypass requests');
environment.isDevelopmentMode = true;
for (const variant of [{ shipmentType: 1 }, { quoteType: 'local' }]) {
  assert.equal(flow.getShipmentStatusActions({ ...variant, orderStatus: 0 }, true)[0].value, 'AcceptedByRider');
  assert.equal(flow.getShipmentStatusActions({ ...variant, orderStatus: 0, riderID: 'existing' }, true).some((action) => action.value === 'AcceptedByRider'), false);
}
await assert.rejects(service.updateOrderStatus('document-id', 'AcceptedByRider'), /rider.*Firebase/);
await assert.rejects(service.updateOrderStatus('document-id', 'AcceptedByRider', 'bad/id'), /rider.*Firebase/);
await service.updateOrderStatus('document-id', 'AcceptedByRider', ' rider-uid ');
assert.deepEqual(JSON.parse(requests.at(-1).body), { orderId: 'document-id', orderStatus: 'AcceptedByRider', riderID: 'rider-uid' });
await assert.rejects(service.updateOrderStatus('document-id', 'SentToHq', 'rider-uid'), /only allowed when accepting/);
environment.isDevelopmentMode = false;
const productionCount = requests.length;
await assert.rejects(service.updateOrderStatus('document-id', 'AcceptedByRider', 'rider-uid'), /Unsupported/);
assert.equal(requests.length, productionCount, 'Production cannot submit rider acceptance');

replies = [{ status: 401, data: {} }, { status: 200, data: { success: true } }];
await service.updateOrderStatus('document-id', 'Cancelled');
assert.deepEqual(tokenRefreshes.slice(-2), [false, true]);
assert.equal(requests.at(-1).headers.Authorization, 'Bearer refreshed-token');
const before = requests.length;
replies = [{ status: 401, data: {} }, { status: 401, data: { code: 'unauthenticated', error: 'Sign in again' } }];
await assert.rejects(service.updateOrderStatus('document-id', 'Cancelled'), (error) => error.status === 401);
assert.equal(requests.length - before, 2, 'Refresh a rejected token only once');
for (const status of [403, 404, 409, 429, 503, 500]) {
  replies = [{ status, data: { success: false, code: 'failed-precondition', error: 'Server message' } }];
  await assert.rejects(service.updateOrderStatus('document-id', 'SentToHq'), (error) =>
    error instanceof ShipmentStatusError && error.status === status && error.code === 'failed-precondition' && error.message === 'Server message');
}
replies = [{ status: 500, nonJson: true }];
await assert.rejects(service.updateOrderStatus('document-id', 'SentToHq'), /Unable to update shipment/);
replies = [{ networkError: true }];
await assert.rejects(service.updateOrderStatus('document-id', 'SentToHq'), /Network unavailable/);
auth.currentUser = null;
await assert.rejects(service.updateOrderStatus('document-id', 'SentToHq'), (error) => error.status === 401);

// Render with stateful hook stubs to exercise the actual handlers and action gating.
let role = 'regular';
let updateError;
let refreshError;
let refreshCount = 0;
let roleRefreshCount = 0;
let mutations = 0;
let lastMutation;
let state = [];
let cursor = 0;
const component = load('src/components/shipment-orders/shipment-status-control.tsx', {
  react: {
    useState: (initial) => {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], (value) => { state[index] = value; }];
    },
    useRef: (initial) => {
      const index = cursor++;
      if (!(index in state)) state[index] = { current: initial };
      return state[index];
    },
  },
  '@/components/ui/button': { Button: 'button' },
  '@/components/ui/label': { Label: 'label' },
  '@/components/ui/input': { Input: 'input' },
  '@/lib/environment': environment,
  '@/components/ui/select': Object.fromEntries(['Select', 'SelectContent', 'SelectItem', 'SelectTrigger', 'SelectValue'].map((name) => [name, name])),
  '@/contexts/UserContext': { useCurrentUser: () => ({ user: { isAdmin: true, adminType: role }, refetchUser: async () => { roleRefreshCount++; } }) },
  '@/lib/shipment-status': flow,
  '@/services/shipment-orders.service': {
    ShipmentStatusError,
    shipmentOrdersService: { updateOrderStatus: async (...args) => { lastMutation = args; mutations++; if (updateError) throw updateError; } },
  },
  '@/types': types,
  sonner: { toast: { success() {}, error() {} } },
}).ShipmentStatusControl;
function render(order) {
  cursor = 0;
  return component({ order, onRefresh: async () => { refreshCount++; if (refreshError) throw refreshError; } });
}
function nodes(node) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  return [node, ...nodes(node.props?.children)];
}
const order = { id: 'document-id', quoteType: 'local', orderStatus: 6 };
for (role of ['super', 'regular', 'customercare']) {
  state = [];
  let tree = render(order);
  nodes(tree).find((node) => node.type === 'Select').props.onValueChange('SentToHq');
  tree = render(order);
  const button = nodes(tree).find((node) => node.type === 'button');
  assert.equal(button.props.disabled, false);
  await button.props.onClick();
  assert.equal(state[1], false, 'Pending state clears after success');
}
assert.equal(mutations, 3);
assert.equal(refreshCount, 3);
role = 'verifier';
state = [];
assert.equal(nodes(render(order)).some((node) => node.type === 'Select'), false);
role = 'regular';
for (const error of [new ShipmentStatusError(409, 'failed-precondition', 'Order changed'), new Error('Network unavailable'), new ShipmentStatusError(403, 'permission-denied', 'Role changed')]) {
  state = [];
  updateError = error;
  let tree = render(order);
  nodes(tree).find((node) => node.type === 'Select').props.onValueChange('SentToHq');
  tree = render(order);
  await nodes(tree).find((node) => node.type === 'button').props.onClick();
  tree = render(order);
  assert.equal(state[1], false, 'Pending clears after failures');
  assert.equal(nodes(tree).find((node) => node.props?.role === 'alert').props.children, error.message);
  if (error.status === 403) assert.equal(nodes(tree).some((node) => node.type === 'Select'), false);
}
assert.equal(refreshCount, 6, 'Conflicts and network failures always refresh the order');
assert.equal(roleRefreshCount, 1);
state = [];
updateError = undefined;
refreshError = new Error('Offline');
let tree = render(order);
nodes(tree).find((node) => node.type === 'Select').props.onValueChange('SentToHq');
tree = render(order);
await nodes(tree).find((node) => node.type === 'button').props.onClick();
tree = render(order);
assert.equal(nodes(tree).find((node) => node.type === 'Select').props.disabled, true, 'Failed refresh blocks further status mutations');
refreshError = undefined;
await nodes(tree).find((node) => node.type === 'button' && node.props.children === 'Refresh shipment').props.onClick();
assert.equal(nodes(render(order)).find((node) => node.type === 'Select').props.disabled, false);
console.log('Shipment status checks passed: Express/local flow, production assignment exclusion, HTTP payload/auth/retry/errors, role gating, conflict refresh, and pending cleanup.');

state = [];
environment.isDevelopmentMode = true;
const placed = { id: 'document-id', shipmentType: 1, orderStatus: 0 };
tree = render(placed);
nodes(tree).find((node) => node.type === 'Select').props.onValueChange('AcceptedByRider');
tree = render(placed);
assert.equal(nodes(tree).find((node) => node.type === 'button').props.disabled, true, 'Development acceptance requires a rider ID');
nodes(tree).find((node) => node.type === 'input').props.onChange({ target: { value: 'rider-uid' } });
tree = render(placed);
await nodes(tree).find((node) => node.type === 'button').props.onClick();
assert.deepEqual(lastMutation, ['document-id', 'AcceptedByRider', 'rider-uid']);
environment.isDevelopmentMode = false;
state = [];
tree = render(placed);
assert.equal(nodes(tree).some((node) => node.props?.value === 'AcceptedByRider'), false, 'Production hides rider assignment');
assert.equal(nodes(tree).some((node) => node.type === 'input'), false);
console.log('Development-only rider assignment checks passed: required rider ID, exact acceptance payload, no reassignment, and production UI/service exclusion.');

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as jsxRuntime from 'react/jsx-runtime';

let role;
let hookCalls = 0;
function load(file) {
  const context = vm.createContext({ exports: {}, require: (name) => {
    if (name === 'react/jsx-runtime') return jsxRuntime;
    if (name === 'react') return {
      useState: () => { hookCalls++; throw new Error('Protected report should not mount'); },
      useEffect: () => { hookCalls++; throw new Error('Protected effect should not mount'); },
    };
    if (name === '@/contexts/UserContext') return { useCurrentUser: () => ({ adminType: role, user: { id: 'admin-id', adminType: role } }) };
    return {};
  } });
  vm.runInContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, context);
  return context.exports;
}
const activation = load('src/pages/user-activation/index.tsx').default;
const concentration = load('src/pages/weekly-concentration/index.tsx').default;
const riderDeliveries = load('src/pages/rider-weekly-deliveries/index.tsx').default;
const counts = load('src/components/account-ride-counts.tsx').AccountRideCounts;
const couponPage = load('src/pages/coupon-redemption-metrics/index.tsx').default;
const couponMetrics = load('src/components/coupons/coupon-redemption-metrics.tsx').CouponRedemptionMetrics;
const weekly = load('src/components/dashboard/weekly-overview.tsx').WeeklyOverview;
for (role of ['regular', 'customercare', 'verifier', '', undefined, 'unknown']) {
  assert.equal(concentration().type, 'p');
  assert.equal(riderDeliveries().type, 'p');
  assert.equal(activation().type, 'p', 'Denied activation pages show an access message');
  assert.equal(counts({ id: 'account-id', usertype: 'user' }), null);
  assert.equal(counts({ id: 'rider-id', usertype: 'rider' }), null);
  assert.equal(weekly({ refreshKey: 0 }), null);
  assert.equal(couponMetrics(), null);
  assert.equal(couponPage().type, 'p');
}
assert.equal(hookCalls, 0, 'Non-super wrappers never mount the report hooks that request protected data');
role = 'super';
assert.equal(typeof couponMetrics().type, 'function');
assert.equal(typeof concentration().type, 'function');
assert.equal(typeof riderDeliveries().type, 'function');
assert.equal(typeof activation().type, 'function');
assert.equal(typeof counts({ id: 'account-id', usertype: 'user' }).type, 'function');
assert.equal(typeof weekly({ refreshKey: 0 }).type, 'function');
console.log('Super-admin component checks passed: activation, both account count panels, and weekly overview are gated before protected state/effects mount.');

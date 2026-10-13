import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const requests = [];
let claims = { isAdmin: true, adminType: 'super' };
let ok = true;
const caller = { uid: 'caller', getIdToken: async (force) => { assert.equal(force, true); return 'fresh-token'; }, getIdTokenResult: async () => ({ claims }) };
const context = vm.createContext({ auth: { currentUser: caller }, endpoints: { createAdminCoupon: 'coupon-url' }, fetch: async (url, options) => { requests.push({ url, ...options }); return { ok, json: async () => ok ? { success: true } : { error: 'Creation denied' } }; } });
const source = fs.readFileSync('src/services/coupons.service.ts','utf8').replace(/^import[\s\S]*?from ["'][^"']+["'];\n/gm,'');
vm.runInContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText.replace(/export /g,'').replace('const couponsService', 'var couponsService'),context);
for (const adminType of ['super','regular']) {
  claims = { isAdmin: true, adminType };
  for (const body of [{ percentageDiscount: 1 }, { percentageDiscount: 100, canExpire: true, expTime: '24hrs' }, { percentageDiscount: 10, canExpire: true, expTime: '48hrs' }]) {
    await context.couponsService.createCoupon(body);
    const request = requests.at(-1);
    assert.equal(request.url, 'coupon-url');
    assert.equal(request.method, 'POST');
    assert.equal(request.headers.Authorization, 'Bearer fresh-token');
    assert.equal(request.headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(request.body), body);
  }
}
await context.couponsService.createCoupon({ percentageDiscount: 10, canExpire: false, expTime: '48hrs', isActive: true });
assert.deepEqual(JSON.parse(requests.at(-1).body), { percentageDiscount: 10 });
for (const percentageDiscount of [0, 101, 10.5, '10', NaN]) await assert.rejects(context.couponsService.createCoupon({ percentageDiscount }), /whole-number/);
await assert.rejects(context.couponsService.createCoupon({ percentageDiscount: 10, canExpire: true, expTime: '72hrs' }), /24-hour or 48-hour/);
for (const forbidden of [{ isAdmin: true, adminType: 'customercare' }, { isAdmin: true, adminType: 'verifier' }, { isAdmin: false, adminType: 'super' }]) {
  claims = forbidden;
  const before = requests.length;
  await assert.rejects(context.couponsService.createCoupon({ percentageDiscount: 10 }), /admin access/);
  assert.equal(requests.length, before);
}
claims = { isAdmin: true, adminType: 'super' };
ok = false;
await assert.rejects(context.couponsService.createCoupon({ percentageDiscount: 10 }), /Creation denied/);
context.auth.currentUser = null;
await assert.rejects(context.couponsService.createCoupon({ percentageDiscount: 10 }), /Sign in/);
console.log('Coupon creation tests passed: roles, token, request fields, expiry, validation, and API errors.');

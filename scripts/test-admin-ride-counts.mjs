import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

let claims = { isAdmin: true, adminType: 'super' };
let body = { ridehailing: 2, courier: 1, expressshipmenr: 3, customclearancer: 4 };
let ok = true;
let status = 200;
const requests = [];
const context = vm.createContext({
  exports: {}, URL, URLSearchParams,
  auth: { currentUser: {
    getIdToken: async (force) => { assert.equal(force, true); return 'firebase-id-token'; },
    getIdTokenResult: async () => ({ claims }),
  } },
  endpoints: { getAdminRideCounts: 'https://example.com/getAdminRideCounts' },
  fetch: async (url, options) => { requests.push({ url, options }); return { ok, status, json: async () => body }; },
});
const source = fs.readFileSync('src/services/admin-ride-counts.service.ts', 'utf8').replace(/^import[\s\S]*?from ["'][^"']+["'];\n/gm, '');
vm.runInContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
const { getCounts } = context.exports.adminRideCountsService;
const signal = new AbortController().signal;
let result = await getCounts('user', 'user /?&=', signal);
assert.deepEqual(JSON.parse(JSON.stringify(result)), body);
let request = requests.at(-1);
assert.equal(request.options.method, 'GET');
assert.equal(request.options.headers.Authorization, 'Bearer firebase-id-token');
assert.equal(request.options.signal, signal);
assert.equal(new URL(request.url).searchParams.get('id'), 'user /?&=');
assert.equal(new URL(request.url).searchParams.get('usertype'), 'user');
body = { ridehailing: 0, courier: 10, expressshipmenr: 5 };
result = await getCounts('rider', 'assigned-rider');
assert.deepEqual(JSON.parse(JSON.stringify(result)), body);
assert.equal(new URL(requests.at(-1).url).searchParams.get('usertype'), 'rider');
body.customclearancer = 999;
assert.equal('customclearancer' in await getCounts('rider', 'rider'), false);
for (const role of ['regular', 'customercare', 'verifier', '', undefined]) {
  claims = { isAdmin: true, adminType: role };
  await assert.rejects(getCounts('user', 'user'), /Super admin/);
}
claims = { isAdmin: false, adminType: 'super' };
await assert.rejects(getCounts('user', 'user'), /Super admin/);
assert.equal(requests.length, 3);
claims = { isAdmin: true, adminType: 'super' };
await assert.rejects(getCounts('user', ' '), /account ID/);
await assert.rejects(getCounts('vendor', 'id'), /account type/);
for (const invalid of [-1, 1.5, '2', null, Number.MAX_SAFE_INTEGER + 1]) {
  body = { ridehailing: invalid, courier: 0, expressshipmenr: 0, customclearancer: 0 };
  await assert.rejects(getCounts('user', 'user'), /invalid ride counts/);
}
body = { ridehailing: 0, courier: 0, expressshipmenr: 0 };
await assert.rejects(getCounts('user', 'user'), /invalid ride counts/);
body = { ridehailing: 0, courier: 0, expressshipmenr: 0, customclearancer: 0 };
assert.equal((await getCounts('user', 'user')).customclearancer, 0);
ok = false; status = 403; body = { error: 'Permission denied' };
await assert.rejects(getCounts('user', 'user'), /Permission denied/);
status = 500; body = null;
await assert.rejects(getCounts('user', 'user'), /500/);
context.auth.currentUser = null;
await assert.rejects(getCounts('user', 'user'), /Sign in/);
console.log('Ride count tests passed: exact response keys, encoded parameters, token/roles, rider customs omission, zero counts, validation, errors, and cancellation signal.');

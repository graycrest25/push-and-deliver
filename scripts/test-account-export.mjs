import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const requests = [];
const downloads = [];
let ok = true;
const caller = { uid: 'admin', getIdToken: async (force) => { assert.equal(force, true); return 'token'; } };
class TestURL extends URL {
  static createObjectURL() { return 'blob:csv'; }
  static revokeObjectURL(value) { assert.equal(value, 'blob:csv'); }
}
const context = vm.createContext({
  URL: TestURL,
  format: (date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`,
  isValid: (date) => !Number.isNaN(date.getTime()),
  auth: { currentUser: caller },
  endpoints: { exportAdminAccountsCsv: 'https://exportAdminAccountsCsv-example.a.run.app' },
  fetch: async (url, options) => { requests.push({ url, options }); return { ok, json: async () => ({ error: 'Export denied' }), blob: async () => ({ csv: true }) }; },
  document: { body: { appendChild() {} }, createElement: () => ({ click() { downloads.push(this.download); }, remove() {} }) },
  setTimeout: (callback) => callback(),
});
const source = fs.readFileSync('src/services/account-export.service.ts','utf8').replace(/^import.*;\n/gm,'');
vm.runInContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText.replace(/export /g,''), context);
for (const type of ['users','riders']) {
  await context.exportAdminAccountsCsv(type, new Date(2026,8,20), new Date(2026,8,24));
  const request = requests.at(-1);
  assert.equal(request.options.method, 'GET');
  assert.equal(request.options.headers.Authorization, 'Bearer token');
  const url = new URL(request.url);
  assert.equal(url.searchParams.get('type'), type);
  assert.equal(url.searchParams.get('startDate'), '2026-09-20');
  assert.equal(url.searchParams.get('endDate'), '2026-09-24');
  assert.equal(downloads.at(-1), `${type}_2026-09-20_2026-09-24.csv`);
}
ok = false;
await assert.rejects(context.exportAdminAccountsCsv('users', new Date(2026,8,20), new Date(2026,8,24)), /Export denied/);
assert.equal(downloads.length, 2);
await assert.rejects(context.exportAdminAccountsCsv('users', new Date(2026,8,24), new Date(2026,8,20)), /valid date range/);
context.auth.currentUser = null;
await assert.rejects(context.exportAdminAccountsCsv('users', new Date(2026,8,20), new Date(2026,8,24)), /Sign in/);
console.log('Account CSV export tests passed: both types, dates, authentication, downloads, and errors.');

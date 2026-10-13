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
  endpoints: { exportWithdrawalsCsv: 'https://exportWithdrawalsCsv-example.a.run.app' },
  fetch: async (url, options) => { requests.push({ url, options }); return { ok, json: async () => ({ error: 'Export denied' }), blob: async () => ({ csv: true }) }; },
  document: { body: { appendChild() {} }, createElement: () => ({ click() { downloads.push(this.download); }, remove() {} }) },
  setTimeout: (callback) => callback(),
});
const source = fs.readFileSync('src/services/withdrawal-export.service.ts','utf8').replace(/^import.*;\n/gm,'');
vm.runInContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText.replace(/export /g,''), context);
for (const type of ['Pending','Successful','Failed','Reversed']) {
  await context.exportWithdrawalsCsv(type, new Date(2026,8,20), new Date(2026,8,24));
  const request = requests.at(-1);
  assert.equal(request.options.method, 'GET');
  assert.equal(request.options.headers.Authorization, 'Bearer token');
  const url = new URL(request.url);
  assert.equal(url.searchParams.get('status'), type);
  assert.equal(url.searchParams.get('startDate'), '2026-09-20');
  assert.equal(url.searchParams.get('endDate'), '2026-09-24');
  assert.equal(downloads.at(-1), `withdrawals_${type.toLowerCase()}_2026-09-20_2026-09-24.csv`);
}
ok = false;
await assert.rejects(context.exportWithdrawalsCsv('Pending', new Date(2026,8,20), new Date(2026,8,24)), /Export denied/);
assert.equal(downloads.length, 4);
await assert.rejects(context.exportWithdrawalsCsv('Pending', new Date(2026,8,24), new Date(2026,8,20)), /valid date range/);
context.auth.currentUser = null;
await assert.rejects(context.exportWithdrawalsCsv('Pending', new Date(2026,8,20), new Date(2026,8,24)), /Sign in/);
console.log('Withdrawal CSV export tests passed: statuses, dates, authentication, downloads, and errors.');

const page = fs.readFileSync('src/pages/withdrawals/index.tsx', 'utf8');
const tableFilter = page.slice(page.indexOf('const filteredWithdrawals'), page.indexOf('const handleEditClick'));
assert(!tableFilter.includes('dateRange'), 'Export dates must not filter the table');
assert(page.includes('<DateRangePicker'), 'Export dates must be available');

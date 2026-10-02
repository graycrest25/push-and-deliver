import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source = fs.readFileSync('src/lib/withdrawal-utils.ts', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const context = { exports: {}, Date };
vm.runInNewContext(compiled, context);
const { getUserTypeLabel, isUserTypeEqual, normalizeWithdrawal, withdrawalDate, canEditWithdrawal } = context.exports;
for (const value of [1, '1', 'Rider', ' rider ']) {
  assert.equal(getUserTypeLabel(value), 'Rider');
  assert.equal(isUserTypeEqual(value, 1), true);
}
for (const value of [0, '0', 'Vendor', ' vendor ']) assert.equal(getUserTypeLabel(value), 'Vendor');
for (const value of [2, '2', 'EcommerceMerchant', ' ecommerce merchant ']) {
  assert.equal(getUserTypeLabel(value), 'Ecommerce Merchant');
  assert.equal(isUserTypeEqual(value, 2), true);
  assert.equal(isUserTypeEqual(value, 0), false);
  assert.equal(isUserTypeEqual(value, 1), false);
}
for (const value of [null, undefined, 3, 42, {}, [], true, '1invalid']) assert.equal(getUserTypeLabel(value), 'Unknown');
assert.equal(isUserTypeEqual(undefined, 3), false);
const record = normalizeWithdrawal('real-document-id', {
  id: 'stored-id', accountname: 'BRIGHT CYPRIAN IZUWA', accountnumber: 9027782108,
  amount: 3600, bankname: 'OPay Digital Services Limited (OPay)', status: 0,
  userType: 1, userID: 'y4zSlciq9cO8YAkbhJddRwdDNc52', transactionID: 'BPmTxdZcmbmRh8Av3ZgL',
  createdAt: { toDate: () => new Date('2026-02-25T11:53:48Z') },
});
assert.equal(record.id, 'real-document-id');
assert.equal(record.amount, 3600);
assert.equal(record.accountnumber, 9027782108);
assert.equal(record.status, 0);
assert.equal(getUserTypeLabel(record.userType), 'Rider');
assert.equal(record.createdAt.toISOString(), '2026-02-25T11:53:48.000Z');
for (const data of [{}, Object.fromEntries(Object.keys(record).map(key => [key, null]))]) {
  const normalized = normalizeWithdrawal('id', data);
  for (const [key, value] of Object.entries(normalized)) if (key !== 'id') assert.equal(value, null);
}
assert.equal(normalizeWithdrawal('id', { accountnumber: '0012345678' }).accountnumber, '0012345678');
assert.equal(normalizeWithdrawal('id', { amount: NaN, accountname: 42, userType: {} }).amount, null);
for (const date of [null, undefined, 'bad-date', {}, { toDate: () => { throw Error('bad'); } }]) assert.equal(withdrawalDate(date), null);
console.log('Withdrawal regression tests passed: numeric/string types, supplied document, nullable fields, invalid dates, and document IDs.');

for (const status of [0, 2, 3, "0", "2", "3", "Successful", "Failed", "Reversed", null, undefined, 4]) {
  assert.equal(canEditWithdrawal(status), false);
}
for (const status of [1, "1", "Pending"]) assert.equal(canEditWithdrawal(status), true);
const page = fs.readFileSync('src/pages/withdrawals/index.tsx', 'utf8');
assert(page.includes('canEditWithdrawal(withdrawal.status) && (<Dialog'));
console.log('Withdrawal edit tests passed: only Pending permits editing.');

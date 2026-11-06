const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const compiled = ts.transpileModule(
  fs.readFileSync(require.resolve("../src/lib/pricing-audit.ts"), "utf8"),
  {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
    },
  },
).outputText;
const library = { exports: {} };
new Function("module", "exports", compiled)(library, library.exports);
const { rateChanges, countryChanges, auditSummary } = library.exports;
test("rates match by zone and weight, with exact before/after values and no ordering noise", () => {
  const a = { zone: 1, weightGrams: 500, amountMinor: 5337328 };
  const b = { zone: 2, weightGrams: 500, amountMinor: 20000 };
  const c = { zone: 1, weightGrams: 1000, amountMinor: 6000000 };
  assert.deepEqual(
    rateChanges({
      before: { rates: [a, b] },
      after: { rates: [{ ...a, amountMinor: 5237328 }, c] },
    }).map(({ zone, weightGrams, before, after, kind }) => ({
      zone,
      weightGrams,
      before,
      after,
      kind,
    })),
    [
      {
        zone: 1,
        weightGrams: 500,
        before: 5337328,
        after: 5237328,
        kind: "Updated",
      },
      {
        zone: 1,
        weightGrams: 1000,
        before: undefined,
        after: 6000000,
        kind: "Added",
      },
      {
        zone: 2,
        weightGrams: 500,
        before: 20000,
        after: undefined,
        kind: "Removed",
      },
    ],
  );
  assert.equal(
    rateChanges({ before: { rates: [a, b] }, after: { rates: [b, a] } }).length,
    0,
  );
});
test("country comparisons normalize postal fields and omit bookkeeping-only changes", () => {
  const before = {
    code: "NG",
    name: "Nigeria",
    active: true,
    postal_code_required: true,
    version: 1,
  };
  const after = {
    version: 2,
    active: true,
    name: "Nigeria",
    code: "NG",
    postalCodeRequired: true,
  };
  assert.equal(
    countryChanges({
      before: { countries: [before] },
      after: { countries: [after] },
    }).length,
    0,
  );
  assert.equal(
    countryChanges({
      before: { countries: [before] },
      after: { countries: [{ ...after, active: false }] },
    }).length,
    1,
  );
});
test("empty changes, null snapshots and publication summaries stay truthful", () => {
  assert.equal(
    auditSummary({
      action: "international.rates",
      before: { rates: [] },
      after: { rates: [] },
    }),
    "No price differences",
  );
  assert.equal(
    auditSummary({
      action: "catalogue.publish",
      after: { internationalRates: 352, destinations: 233 },
    }),
    "352 international prices · 233 destinations",
  );
  assert.equal(
    rateChanges({
      before: null,
      after: { rates: [{ zone: 1, weightGrams: 500, amountMinor: 100 }] },
    })[0].kind,
    "Added",
  );
});

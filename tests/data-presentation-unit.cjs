const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
function load(file) {
  const library = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  new Function("require", "module", "exports", code)(
    (id) => load(path.resolve(path.dirname(file), id + ".ts")),
    library,
    library.exports,
  );
  return library.exports;
}
const { statusTone, recordTone, metricTone } = load(
  require.resolve("../src/lib/data-presentation.ts"),
);
test("numeric statuses keep their endpoint-specific meaning", () => {
  assert.equal(statusTone(0, "status", "/v1/shipments"), "attention");
  assert.equal(statusTone(0, "status", "/v1/admin/rides"), "attention");
  assert.equal(statusTone(0, "status", "/v1/admin/withdrawals"), "positive");
  assert.equal(statusTone(1, "verificationStatus"), "positive");
  assert.equal(statusTone(2, "verificationStatus"), "danger");
  assert.equal(statusTone(99, "status", "/v1/shipments"), "neutral");
});
test("unknown and inactive rows stay neutral, blocked states override active flags", () => {
  assert.equal(recordTone({}), "neutral");
  assert.equal(recordTone({ active: false }), "neutral");
  assert.equal(recordTone({ active: true, disabled: true }), "danger");
  assert.equal(
    recordTone({ status: "active", verificationStatus: 2 }),
    "danger",
  );
  assert.equal(recordTone({ status: "processing" }), "info");
});
test("growth, missing values and unverified/unpaid metrics have distinct meanings", () => {
  assert.equal(metricTone("growthRate", -85.2), "danger");
  assert.equal(metricTone("growthRate", 25), "positive");
  assert.equal(metricTone("growthRate", 0), "neutral");
  assert.equal(metricTone("total", null), "neutral");
  assert.equal(metricTone("verified", 9), "positive");
  assert.equal(metricTone("unverified", 8), "attention");
  assert.equal(metricTone("unpaid", 4), "attention");
  assert.equal(metricTone("newThisWeek", 223), "accent");
});

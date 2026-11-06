const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  ts = require("typescript");
const compiled = ts.transpileModule(
  fs.readFileSync(require.resolve("../src/lib/admin-contracts.ts"), "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;
const lib = { exports: {} };
new Function("module", "exports", compiled)(lib, lib.exports);
const { broadcastBody, promoterBody } = lib.exports;
test("broadcasts validate UTF-8 byte limits and supported audiences", () => {
  assert.equal(
    broadcastBody({
      audience: "customer",
      title: "😀".repeat(40),
      body: "é".repeat(2000),
    }).title.length,
    80,
  );
  assert.throws(() =>
    broadcastBody({ audience: "user", title: "Hello", body: "Message" }),
  );
  assert.throws(() =>
    broadcastBody({
      audience: "rider",
      title: "😀".repeat(41),
      body: "Message",
    }),
  );
  assert.throws(() =>
    broadcastBody({ audience: "all", title: "Hello", body: "é".repeat(2001) }),
  );
  assert.throws(() =>
    broadcastBody({ audience: "all", title: "   ", body: "Message" }),
  );
  assert.deepEqual(
    broadcastBody({ audience: "rider", title: " Hello ", body: " Message " }),
    { audience: "rider", title: "Hello", body: "Message" },
  );
});
test("promoter names preserve capitalization and reject punctuation and non-ASCII letters", () => {
  assert.deepEqual(promoterBody({ name: "LagosPromoter01" }), {
    name: "LagosPromoter01",
  });
  for (const name of [
    "",
    "Lagos Promoter",
    "Lagos_01",
    "Émilie",
    " Lagos",
    "a".repeat(101),
  ])
    assert.throws(() => promoterBody({ name }));
});

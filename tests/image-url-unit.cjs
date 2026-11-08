const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const compiled = ts.transpileModule(
  fs.readFileSync(require.resolve("../src/server/image-url.ts"), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText;
const lib = { exports: {} };
new Function("exports", compiled)(lib.exports);
const { resolveImageUrl } = lib.exports;
const base = new URL("https://app.pushndeliver.com");

test("relative images resolve directly against BASE_URL and preserve capability parameters", () => {
  const path = "/v1/media/photo/avatar?cap=a%2Bb&version=2";
  for (const input of [
    path,
    path.slice(1),
    `/api/proxy${path}`,
    `${base.origin}${path}`,
  ])
    assert.equal(resolveImageUrl(input, base), `${base.origin}${path}`);
  assert.equal(
    resolveImageUrl("/images/photo.jpg", base),
    `${base.origin}/images/photo.jpg`,
  );
});

test("external image hosts remain intact, empty and unsafe URLs do not render", () => {
  assert.equal(
    resolveImageUrl("https://cdn.example.test/photo.jpg", base),
    "https://cdn.example.test/photo.jpg",
  );
  assert.equal(resolveImageUrl("", base), "");
  assert.equal(resolveImageUrl("javascript:alert(1)", base), "");
});

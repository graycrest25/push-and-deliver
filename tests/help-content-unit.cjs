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
const { pageTutorials, tutorialForPath, tutorialForSection } = load(
  require.resolve("../src/lib/tutorials.ts"),
);
const content = (help) =>
  help.steps.map(({ description }) => description).join(" ");

test("every navigation destination has its own help", () => {
  const navigation = fs.readFileSync(
    require.resolve("../src/lib/navigation.ts"),
    "utf8",
  );
  const paths = [...navigation.matchAll(/url: "([^"]+)"/g)].map(
    (match) => match[1],
  );
  assert.ok(paths.length > 30);
  for (const route of paths) {
    assert.ok(pageTutorials[route], `Missing help for ${route}`);
    assert.ok(content(tutorialForPath(route)).length > 40, route);
  }
});

test("nested routes use the specific feature and record details", () => {
  assert.equal(
    tutorialForPath("/export-rates/tariffs/draft-1?tab=workflow").title,
    "Shipping tariff",
  );
  assert.equal(
    tutorialForPath("/export-rates/countries/NG").title,
    "Country policy",
  );
  assert.equal(
    tutorialForPath("/delivery-zones/tariffs/draft-1/").title,
    "Delivery tariff",
  );
  assert.notEqual(
    content(tutorialForPath("/users/user-1")),
    content(tutorialForPath("/users")),
  );
  assert.equal(
    tutorialForPath("/users-not-a-feature").title,
    "Admin workspace",
  );
});

test("section help explains the selected task and its route", () => {
  const prices = tutorialForSection(
    "  Edit   prices ",
    "/delivery-zones/tariffs/draft-1",
  );
  assert.match(content(prices), /only those rows/);
  assert.match(content(prices), /naira/);
  assert.doesNotMatch(
    content(prices),
    /continuation|operation key|full zone and rate list/,
  );
  assert.match(
    content(tutorialForSection("Records", "/head-offices")),
    /office/i,
  );
  assert.match(
    content(tutorialForSection("Records", "/export-rates")),
    /country/i,
  );
});

test("unknown sections keep relevant page context without generic action instructions", () => {
  const help = tutorialForSection(
    "New tariff section",
    "/delivery-zones/tariffs/draft-1",
  );
  assert.equal(help.title, "New tariff section");
  assert.match(content(help), /0\.5 to 70 kg/);
  assert.doesNotMatch(content(help), /queued action|continuation/);
});

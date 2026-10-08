import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = fs.readFileSync("src/lib/tutorials.ts", "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
});
const context = vm.createContext({ exports: {} });
vm.runInContext(outputText, context);
const { pageTutorials, sectionTutorials, tutorialForPath, tutorialForSection } =
  context.exports;

// Derive coverage from the router so new admin destinations cannot silently lack help.
const routes = [
  ...fs
    .readFileSync("src/router/Router.tsx", "utf8")
    .matchAll(/path="([^"]+)"/g),
]
  .map((match) => match[1])
  .filter((path) => !path.includes("*") && !path.startsWith("/sign-"));
for (const path of routes) {
  assert.ok(
    tutorialForPath(path.replace(/:[^/]+/g, "example")),
    `Missing tutorial: ${path}`,
  );
}
for (const tutorial of [
  ...Object.values(pageTutorials),
  ...Object.values(sectionTutorials),
]) {
  assert.ok(tutorial.title);
  assert.ok(
    tutorial.steps.length >= 3 && tutorial.steps.length <= 7,
    tutorial.title,
  );
  for (const step of tutorial.steps) {
    assert.ok(
      step.title && step.description.length >= 30,
      `Insufficient guidance: ${tutorial.title}`,
    );
  }
}
assert.equal(tutorialForPath("/sign-in"), undefined);
assert.equal(tutorialForPath("/users-unknown"), undefined);
assert.equal(tutorialForSection("Welcome back", "/sign-in"), undefined);
assert.match(
  tutorialForSection(" Shipment fee payment ", "/shipment-orders/one").steps[1]
    .description,
  /total amount/,
);
assert.match(
  tutorialForSection("Additional shipment fee", "/shipment-orders/one").steps[1]
    .description,
  /not the new shipment total/,
);
assert.match(
  tutorialForSection("Order Status", "/shipment-orders/one").steps[2]
    .description,
  /final/,
);
assert.match(
  tutorialForSection("Total Amount", "/withdrawals").steps[0].description,
  /withdrawal/,
);
assert.match(
  tutorialForSection("Table pagination", "/users").steps[2].description,
  /currently loaded/,
);
assert.match(
  tutorialForSection("Order Items ( 2 )", "/product-orders/one").steps[0]
    .description,
  /products or food/,
);
console.log(
  `Tutorial checks passed: ${routes.length} admin routes, descriptive steps, contextual payment/status guidance, and pagination limits.`,
);

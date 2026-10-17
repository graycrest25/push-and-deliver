import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const examples = JSON.parse(
  fs.readFileSync("docs/examples/summary-responses.json", "utf8"),
);
let body;
let ok = true;
const requests = [];
const user = { uid: "admin", getIdToken: async () => "firebase-id-token" };
const context = vm.createContext({
  URL,
  Date,
  Number,
  AbortController,
  auth: { currentUser: user },
  endpoints: {
    getAdminAccountSummary: "https://example.com/getAdminAccountSummary",
  },
  fetch: async (url, options) => {
    requests.push({ url, options });
    return { ok, json: async () => body };
  },
});
const source = fs
  .readFileSync("src/services/account-summary.service.ts", "utf8")
  .replace(/^import[\s\S]*?from ["'][^"']+["'];\n/gm, "");
vm.runInContext(
  ts
    .transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
      },
    })
    .outputText.replace(/export /g, ""),
  context,
);
const signal = new AbortController().signal;
for (const type of ["users", "riders"]) {
  body = examples[type];
  const data = await context.getAccountSummary(type, signal);
  assert.deepEqual(JSON.parse(JSON.stringify(data)), body);
  assert.equal(new URL(requests.at(-1).url).searchParams.get("type"), type);
  assert.equal(
    requests.at(-1).options.headers.Authorization,
    "Bearer firebase-id-token",
  );
  assert.equal(requests.at(-1).options.signal, signal);
  assert.equal(requests.at(-1).options.cache, "no-store");
}
body = { ...examples.users, growthRate: null };
assert.equal(
  (await context.getAccountSummary("users", signal)).growthRate,
  null,
);
body = { ...examples.users, total: -1 };
await assert.rejects(
  context.getAccountSummary("users", signal),
  /invalid account summary/,
);
body = { ...examples.riders, verified: { total: 2, byVehicle: {} } };
await assert.rejects(
  context.getAccountSummary("riders", signal),
  /invalid account summary/,
);
ok = false;
body = { error: "Backend summary unavailable" };
await assert.rejects(
  context.getAccountSummary("users", signal),
  /Backend summary unavailable/,
);
context.auth.currentUser = null;
await assert.rejects(context.getAccountSummary("users", signal), /Sign in/);
assert.equal(
  fs.existsSync("firebase/functions"),
  false,
  "The example functions folder must be removed",
);
console.log(
  "Account summary API tests passed: documented user/rider examples, authentication, request shape, nullable growth, invalid responses, and API errors.",
);

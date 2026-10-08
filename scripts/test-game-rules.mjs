import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { z } from "zod";

function evaluate(file, dependencies) {
  const source = fs.readFileSync(file, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
    },
  });
  const context = vm.createContext({
    exports: {},
    require: (name) => {
      assert.ok(Object.hasOwn(dependencies, name), `Unexpected import ${name}`);
      return dependencies[name];
    },
  });
  vm.runInContext(outputText, context);
  return context.exports;
}

const rules = evaluate("src/lib/ten-seconds-rules.ts", { zod: { z } });
const normalise = (value) => JSON.parse(JSON.stringify(value));
const initial = normalise(rules.suggestedGameRules);
assert.deepEqual(normalise(rules.parseGameRules(initial)), {
  enabled: true,
  activeLevel: "medium",
  levels: {
    easy: { speedMultiplier: 0.5, toleranceMilliseconds: 100 },
    medium: { speedMultiplier: 1, toleranceMilliseconds: 100 },
    hard: { speedMultiplier: 2, toleranceMilliseconds: 100 },
  },
});
for (const value of [
  null,
  {},
  { ...initial, enabled: "true" },
  { ...initial, activeLevel: "unknown" },
]) {
  assert.throws(() => rules.parseGameRules(value), /Invalid game rules/);
}
for (const value of [0, -1, Infinity, NaN, "2"]) {
  const invalid = structuredClone(initial);
  invalid.levels.hard.speedMultiplier = value;
  assert.throws(() => rules.parseGameRules(invalid), /speedMultiplier/);
}
for (const value of [-1, 1.5, Infinity, NaN, "100"]) {
  const invalid = structuredClone(initial);
  invalid.levels.easy.toleranceMilliseconds = value;
  assert.throws(() => rules.parseGameRules(invalid), /toleranceMilliseconds/);
}
const zeroTolerance = structuredClone(initial);
zeroTolerance.levels.easy.toleranceMilliseconds = 0;
assert.equal(
  rules.parseGameRules(zeroTolerance).levels.easy.toleranceMilliseconds,
  0,
);

let claims = { isAdmin: true, adminType: "super" };
let document = initial;
let failure = null;
let reads = 0;
const writes = [];
const auth = { currentUser: { getIdTokenResult: async () => ({ claims }) } };
const db = {};
const { gameRulesService: service } = evaluate(
  "src/services/game-rules.service.ts",
  {
    "@/lib/ten-seconds-rules": rules,
    "@/lib/firebase": { auth, db },
    "firebase/firestore": {
      doc: (database, collection, id) => {
        assert.equal(database, db);
        assert.equal(collection, "gameRules");
        assert.equal(id, "tenSeconds");
        return "gameRules/tenSeconds";
      },
      getDocFromServer: async () => {
        reads++;
        if (failure) throw failure;
        return { exists: () => document !== null, data: () => document };
      },
      setDoc: async (path, data, options) => {
        if (failure) throw failure;
        writes.push(normalise({ path, data, options }));
      },
    },
  },
);

for (const adminType of ["super", "regular"]) {
  claims = { isAdmin: true, adminType };
  assert.deepEqual(normalise(await service.getTenSeconds()), initial);
  const edited = structuredClone(initial);
  edited.enabled = false;
  edited.activeLevel = "hard";
  edited.levels.hard.speedMultiplier = 3;
  await service.saveTenSeconds(edited);
  assert.deepEqual(writes.at(-1), {
    path: "gameRules/tenSeconds",
    data: edited,
    options: { merge: true },
  });
}
document = null;
assert.equal(await service.getTenSeconds(), null);
assert.equal(
  writes.length,
  2,
  "A missing document must not be created during a read",
);
await service.saveTenSeconds(initial);
assert.equal(writes.length, 3, "Saving can initialise the missing document");
document = {};
await assert.rejects(service.getTenSeconds(), /Invalid game rules/);
await assert.rejects(
  service.saveTenSeconds({ ...initial, activeLevel: "invalid" }),
  /Invalid game rules/,
);
assert.equal(writes.length, 3);
failure = new Error("Missing or insufficient permissions");
await assert.rejects(service.getTenSeconds(), /permissions/);
await assert.rejects(service.saveTenSeconds(initial), /permissions/);
failure = null;
const readCount = reads;
for (const adminType of ["customercare", "verifier", "", "unknown"]) {
  claims = { isAdmin: true, adminType };
  await assert.rejects(service.getTenSeconds(), /Super or regular/);
  await assert.rejects(service.saveTenSeconds(initial), /Super or regular/);
}
claims = { isAdmin: false, adminType: "super" };
await assert.rejects(service.saveTenSeconds(initial), /Super or regular/);
auth.currentUser = null;
await assert.rejects(service.getTenSeconds(), /Sign in/);
assert.equal(reads, readCount, "Disallowed roles must not read the document");
assert.equal(writes.length, 3, "Disallowed roles must not write the document");
console.log(
  "Game rules checks passed: document path, server reads, both admin roles, nested saves, missing documents, validation, and permission errors.",
);

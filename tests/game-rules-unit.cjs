const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const compiled = ts.transpileModule(
  fs.readFileSync(require.resolve("../src/lib/game-rules.ts"), "utf8"),
  {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
    },
  },
).outputText;
const library = { exports: {} };
new Function("require", "module", "exports", compiled)(
  (id) => (id === "./api" ? {} : require(id)),
  library,
  library.exports,
);
const {
  gameTiming,
  parseGameRules,
  parseGameSnapshot,
  validateGameRules,
  INITIAL_GAME_DRAFT,
  restoreGameSave,
} = library.exports;
const rules = () => structuredClone(INITIAL_GAME_DRAFT);
const snapshot = (version = 3) => ({
  configured: true,
  version,
  configuration: {
    ...rules(),
    version,
    targetMilliseconds: 10000,
    maxAttempts: 5,
    cooldownSeconds: 86400,
  },
  reason: null,
  updatedAt: "2026-11-04T12:00:00Z",
});
test("preview uses real elapsed time from speed and never applies the retired tolerance cap", () => {
  assert.deepEqual(
    gameTiming({ speedMultiplier: 0.5, toleranceMilliseconds: 100 }),
    {
      target: 20000,
      tolerance: 200,
      minimum: 19800,
      maximum: 20200,
      expiresAfter: 120000,
    },
  );
  assert.equal(
    gameTiming({ speedMultiplier: 0.1, toleranceMilliseconds: 1000 }).tolerance,
    10000,
  );
  assert.equal(
    gameTiming({ speedMultiplier: 10, toleranceMilliseconds: 0 }).target,
    1000,
  );
});
test("configured, disabled, missing and invalid states preserve actual versions", () => {
  assert.equal(parseGameSnapshot(snapshot(), "env").version, 3);
  assert.equal(parseGameSnapshot(snapshot(), "env").rules.enabled, false);
  assert.equal(
    parseGameSnapshot(
      {
        configured: false,
        version: 0,
        configuration: null,
        reason: "missing",
        updatedAt: null,
      },
      "env",
    ).rules,
    null,
  );
  assert.equal(
    parseGameSnapshot(
      {
        configured: false,
        version: 7,
        configuration: null,
        reason: "invalid",
        updatedAt: null,
      },
      "env",
    ).version,
    7,
  );
  assert.throws(() =>
    parseGameSnapshot(
      {
        ...snapshot(),
        configuration: { ...snapshot().configuration, version: 2 },
      },
      "env",
    ),
  );
  assert.throws(() =>
    parseGameSnapshot(
      {
        ...snapshot(),
        configuration: { ...snapshot().configuration, maxAttempts: 9 },
      },
      "env",
    ),
  );
  assert.throws(() =>
    parseGameRules({ enabled: false, active_level: "easy", levels: {} }),
  );
});
test("only editable fields survive parsing and all new numeric bounds are validated", () => {
  assert.deepEqual(
    Object.keys(parseGameRules(snapshot().configuration)).sort(),
    [
      "activeLevel",
      "enabled",
      "levels",
      "maxRewardsPerDay",
      "maxRewardsPerUserDay",
    ],
  );
  for (const speed of [0, -0.1, NaN, Infinity, 10.001]) {
    const value = rules();
    value.levels.easy.speedMultiplier = speed;
    assert.ok(validateGameRules(value).length);
  }
  for (const speed of [0.001, 0.05, 0.5, 10]) {
    const value = rules();
    value.levels.easy.speedMultiplier = speed;
    value.levels.easy.toleranceMilliseconds = 0;
    assert.deepEqual(validateGameRules(value), []);
  }
  for (const tolerance of [-1, 0.5, 1001]) {
    const value = rules();
    value.levels.easy.toleranceMilliseconds = tolerance;
    assert.ok(validateGameRules(value).length);
  }
  for (const daily of [0, 0.5, 10001])
    assert.ok(
      validateGameRules({ ...rules(), maxRewardsPerDay: daily }).length,
    );
  for (const player of [0, 1.5, 6])
    assert.ok(
      validateGameRules({ ...rules(), maxRewardsPerUserDay: player }).length,
    );
  assert.deepEqual(
    validateGameRules({
      ...rules(),
      maxRewardsPerDay: 10000,
      maxRewardsPerUserDay: 5,
    }),
    [],
  );
});
test("retained commands preserve their version, body and key; obsolete payloads are rejected", () => {
  const command = {
    key: "b618d608-239f-48f2-95fb-28cd6b898913",
    body: JSON.stringify({ expectedVersion: 0, ...rules() }),
  };
  assert.deepEqual(restoreGameSave(JSON.stringify(command)), command);
  assert.equal(restoreGameSave(null), null);
  assert.throws(() =>
    restoreGameSave(
      JSON.stringify({
        ...command,
        body: JSON.stringify({ ...rules(), expectedVersion: -1 }),
      }),
    ),
  );
  assert.throws(() =>
    restoreGameSave(
      JSON.stringify({
        ...command,
        body: JSON.stringify({
          ...rules(),
          expectedVersion: 3,
          maxAttempts: 5,
        }),
      }),
    ),
  );
  assert.throws(() =>
    restoreGameSave(
      JSON.stringify({
        ...command,
        body: JSON.stringify({
          enabled: false,
          active_level: "easy",
          daily_attempts: 3,
        }),
      }),
    ),
  );
});

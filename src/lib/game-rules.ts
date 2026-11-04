import { apiResponse } from "./api";
export const LEVELS = ["easy", "medium", "hard"] as const;
export type LevelName = (typeof LEVELS)[number];
export type LevelRules = {
  speedMultiplier: number;
  toleranceMilliseconds: number;
};
export type GameRules = {
  enabled: boolean;
  activeLevel: LevelName;
  levels: Record<LevelName, LevelRules>;
  maxRewardsPerDay: number;
  maxRewardsPerUserDay: number;
};
export const GAME_CONSTANTS = {
  targetMilliseconds: 10000,
  maxAttempts: 5,
  cooldownSeconds: 86400,
  attemptExpiryMilliseconds: 120000,
};
export type GameSnapshot = {
  rules: GameRules | null;
  configured: boolean;
  version: number;
  reason: "missing" | "invalid" | null;
  updatedAt: string | null;
  environment: string;
};
export type PendingGameSave = { key: string; body: string };
export const INITIAL_GAME_DRAFT: GameRules = {
  enabled: false,
  activeLevel: "easy",
  levels: {
    easy: { speedMultiplier: 0.5, toleranceMilliseconds: 100 },
    medium: { speedMultiplier: 1, toleranceMilliseconds: 100 },
    hard: { speedMultiplier: 2, toleranceMilliseconds: 100 },
  },
  maxRewardsPerDay: 10,
  maxRewardsPerUserDay: 1,
};
// Keep commands for the superseded API out of this contract's retry scope.
export const GAME_STORAGE_PREFIX = "pnd-game-rules:admin-rules:";
export const cloneRules = (rules: GameRules) => structuredClone(rules);
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
export function validateGameRules(rules: GameRules) {
  const errors: string[] = [];
  if (typeof rules.enabled !== "boolean")
    errors.push("Choose whether new attempts are enabled.");
  if (!LEVELS.includes(rules.activeLevel))
    errors.push("Select an active level.");
  if (
    !Number.isInteger(rules.maxRewardsPerDay) ||
    rules.maxRewardsPerDay < 1 ||
    rules.maxRewardsPerDay > 10000
  )
    errors.push("Daily reward cap must be a whole number from 1 to 10,000.");
  if (
    !Number.isInteger(rules.maxRewardsPerUserDay) ||
    rules.maxRewardsPerUserDay < 1 ||
    rules.maxRewardsPerUserDay > 5
  )
    errors.push(
      "Rewards per player per day must be a whole number from 1 to 5.",
    );
  if (Object.keys(rules.levels).length !== 3)
    errors.push("Exactly three levels are required.");
  for (const name of LEVELS) {
    const level = rules.levels[name];
    if (
      !level ||
      !Number.isFinite(level.speedMultiplier) ||
      level.speedMultiplier <= 0 ||
      level.speedMultiplier > 10
    )
      errors.push(
        `${name}: speed multiplier must be greater than 0 and at most 10.`,
      );
    if (
      !level ||
      !Number.isInteger(level.toleranceMilliseconds) ||
      level.toleranceMilliseconds < 0 ||
      level.toleranceMilliseconds > 1000
    )
      errors.push(
        `${name}: tolerance must be a whole number from 0 to 1,000 ms.`,
      );
  }
  return errors;
}
export function parseGameRules(value: unknown): GameRules {
  if (
    !object(value) ||
    !object(value.levels) ||
    Object.keys(value.levels).length !== 3
  )
    throw new Error(
      "Saved game rules must contain exactly easy, medium, and hard levels.",
    );
  const levels = {} as GameRules["levels"];
  for (const name of LEVELS) {
    const level = value.levels[name];
    if (
      !object(level) ||
      typeof level.speedMultiplier !== "number" ||
      typeof level.toleranceMilliseconds !== "number"
    )
      throw new Error(`Saved ${name} timing is invalid.`);
    levels[name] = {
      speedMultiplier: level.speedMultiplier,
      toleranceMilliseconds: level.toleranceMilliseconds,
    };
  }
  if (
    typeof value.enabled !== "boolean" ||
    typeof value.activeLevel !== "string" ||
    typeof value.maxRewardsPerDay !== "number" ||
    typeof value.maxRewardsPerUserDay !== "number"
  )
    throw new Error(
      "Saved game rule fields are invalid. No defaults have replaced them.",
    );
  const rules: GameRules = {
    enabled: value.enabled,
    activeLevel: value.activeLevel as LevelName,
    levels,
    maxRewardsPerDay: value.maxRewardsPerDay,
    maxRewardsPerUserDay: value.maxRewardsPerUserDay,
  };
  const errors = validateGameRules(rules);
  if (errors.length)
    throw new Error(`Saved rules are invalid: ${errors.join(" ")}`);
  return rules;
}
export function parseGameSnapshot(
  value: unknown,
  environment: string,
): GameSnapshot {
  if (
    !object(value) ||
    typeof value.configured !== "boolean" ||
    !Number.isSafeInteger(value.version) ||
    Number(value.version) < 0 ||
    !(
      value.updatedAt === null ||
      (typeof value.updatedAt === "string" &&
        Number.isFinite(Date.parse(value.updatedAt)))
    )
  )
    throw new Error(
      "The service returned invalid game configuration metadata.",
    );
  if (!value.configured) {
    if (
      value.configuration !== null ||
      !["missing", "invalid"].includes(String(value.reason))
    )
      throw new Error("The service returned an invalid setup state.");
    return {
      rules: null,
      configured: false,
      version: Number(value.version),
      reason: value.reason as "missing" | "invalid",
      updatedAt: value.updatedAt as string | null,
      environment,
    };
  }
  const config = value.configuration;
  if (
    !object(config) ||
    config.version !== value.version ||
    config.targetMilliseconds !== GAME_CONSTANTS.targetMilliseconds ||
    config.maxAttempts !== GAME_CONSTANTS.maxAttempts ||
    config.cooldownSeconds !== GAME_CONSTANTS.cooldownSeconds ||
    value.reason !== null
  )
    throw new Error(
      "The saved game configuration has inconsistent versions or unsupported fixed play limits.",
    );
  return {
    rules: parseGameRules(config),
    configured: true,
    version: Number(value.version),
    reason: null,
    updatedAt: value.updatedAt as string | null,
    environment,
  };
}
// Approximate real elapsed milliseconds; authoritative judging rounds scaled microseconds.
export function gameTiming(level: LevelRules) {
  return {
    target: GAME_CONSTANTS.targetMilliseconds / level.speedMultiplier,
    tolerance: level.toleranceMilliseconds / level.speedMultiplier,
    minimum:
      (GAME_CONSTANTS.targetMilliseconds - level.toleranceMilliseconds) /
      level.speedMultiplier,
    maximum:
      (GAME_CONSTANTS.targetMilliseconds + level.toleranceMilliseconds) /
      level.speedMultiplier,
    expiresAfter: GAME_CONSTANTS.attemptExpiryMilliseconds,
  };
}
export async function loadGameRules(
  signal?: AbortSignal,
): Promise<GameSnapshot> {
  const response = await apiResponse("/v1/admin/game/rules", { signal });
  const result: unknown = await response.json();
  const environment = response.headers.get("x-config-environment");
  if (!environment || !object(result) || !Object.hasOwn(result, "data"))
    throw new Error(
      "Unable to identify the game configuration environment or response. Reload before editing.",
    );
  return parseGameSnapshot(result.data, environment);
}
export async function saveGameRules(
  command: PendingGameSave,
  environment: string,
) {
  const response = await apiResponse("/v1/admin/game/rules", {
    method: "PUT",
    headers: {
      "Idempotency-Key": command.key,
      "X-Config-Environment": environment,
    },
    body: command.body,
  });
  const result = await response.json();
  const saved = parseGameSnapshot(result?.data, environment);
  if (!saved.configured)
    throw new Error(
      "The save response did not contain saved rules. Retain this command for retry.",
    );
  return saved;
}
export function restoreGameSave(value: string | null): PendingGameSave | null {
  if (!value) return null;
  const pending: unknown = JSON.parse(value);
  if (
    !object(pending) ||
    typeof pending.key !== "string" ||
    !/^[a-zA-Z0-9._:-]{8,128}$/.test(pending.key) ||
    typeof pending.body !== "string" ||
    new TextEncoder().encode(pending.body).length > 32768
  )
    throw new Error(
      "The retained save cannot be restored. Its original request may have committed; reload before preparing a new edit.",
    );
  const body = JSON.parse(pending.body);
  if (
    !Number.isSafeInteger(body?.expectedVersion) ||
    body.expectedVersion < 0 ||
    Object.keys(body).sort().join(",") !==
      "activeLevel,enabled,expectedVersion,levels,maxRewardsPerDay,maxRewardsPerUserDay"
  )
    throw new Error(
      "The retained save belongs to an incompatible API contract. Reload before preparing a new edit.",
    );
  parseGameRules(body);
  return { key: pending.key, body: pending.body };
}
export const GAME_PRESETS = {
  balanced: {
    label: "Balanced",
    activeLevel: "easy",
    levels: INITIAL_GAME_DRAFT.levels,
  },
  beginner: {
    label: "Wider timing windows",
    activeLevel: "easy",
    levels: {
      easy: { speedMultiplier: 0.5, toleranceMilliseconds: 250 },
      medium: { speedMultiplier: 1, toleranceMilliseconds: 150 },
      hard: { speedMultiplier: 2, toleranceMilliseconds: 100 },
    },
  },
  strict: {
    label: "Strict challenge",
    activeLevel: "hard",
    levels: {
      easy: { speedMultiplier: 0.5, toleranceMilliseconds: 50 },
      medium: { speedMultiplier: 1, toleranceMilliseconds: 25 },
      hard: { speedMultiplier: 2, toleranceMilliseconds: 10 },
    },
  },
} satisfies Record<
  string,
  { label: string; activeLevel: LevelName; levels: GameRules["levels"] }
>;

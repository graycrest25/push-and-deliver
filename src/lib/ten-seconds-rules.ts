import { z } from "zod";

export const gameLevels = ["easy", "medium", "hard"] as const;
export type GameLevel = (typeof gameLevels)[number];

const levelSchema = z.object({
  speedMultiplier: z.number().finite().positive(),
  toleranceMilliseconds: z.number().finite().int().nonnegative(),
});

const rulesSchema = z.object({
  enabled: z.boolean(),
  activeLevel: z.enum(gameLevels),
  levels: z.object({
    easy: levelSchema,
    medium: levelSchema,
    hard: levelSchema,
  }),
});

export type TenSecondsRules = z.infer<typeof rulesSchema>;

export const suggestedGameRules: TenSecondsRules = {
  enabled: true,
  activeLevel: "medium",
  levels: {
    easy: { speedMultiplier: 0.5, toleranceMilliseconds: 100 },
    medium: { speedMultiplier: 1, toleranceMilliseconds: 100 },
    hard: { speedMultiplier: 2, toleranceMilliseconds: 100 },
  },
};

export function parseGameRules(value: unknown): TenSecondsRules {
  const result = rulesSchema.safeParse(value);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new Error(
      `Invalid game rules (${issue.path.join(".") || "document"}): ${issue.message}`,
    );
  }
  return result.data;
}

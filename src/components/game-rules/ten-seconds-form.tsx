import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useCurrentUser } from "@/contexts/UserContext";
import {
  gameLevels,
  parseGameRules,
  suggestedGameRules,
  type GameLevel,
  type TenSecondsRules,
} from "@/lib/ten-seconds-rules";
import { gameRulesService } from "@/services/game-rules.service";

interface RulesDraft {
  enabled: boolean;
  activeLevel: GameLevel;
  levels: Record<
    GameLevel,
    { speedMultiplier: string; toleranceMilliseconds: string }
  >;
}

function toDraft(rules: TenSecondsRules): RulesDraft {
  return {
    enabled: rules.enabled,
    activeLevel: rules.activeLevel,
    levels: {
      easy: {
        speedMultiplier: String(rules.levels.easy.speedMultiplier),
        toleranceMilliseconds: String(rules.levels.easy.toleranceMilliseconds),
      },
      medium: {
        speedMultiplier: String(rules.levels.medium.speedMultiplier),
        toleranceMilliseconds: String(
          rules.levels.medium.toleranceMilliseconds,
        ),
      },
      hard: {
        speedMultiplier: String(rules.levels.hard.speedMultiplier),
        toleranceMilliseconds: String(rules.levels.hard.toleranceMilliseconds),
      },
    },
  };
}

export function TenSecondsForm() {
  const { user } = useCurrentUser();
  const canManage =
    user?.isAdmin === true &&
    (user.adminType === "super" || user.adminType === "regular");
  const [savedRules, setSavedRules] = useState<TenSecondsRules | null>(null);
  const [draft, setDraft] = useState<RulesDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const request = useRef(0);

  const load = useCallback(async () => {
    if (!canManage) return;
    const current = ++request.current;
    setLoading(true);
    setError("");
    setDraft(null);
    setSavedRules(null);
    try {
      const rules = await gameRulesService.getTenSeconds();
      if (request.current !== current) return;
      setSavedRules(rules);
      setDraft(rules ? toDraft(rules) : null);
    } catch (cause) {
      if (request.current === current)
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not load game rules. Try again.",
        );
    } finally {
      if (request.current === current) setLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    void load();
    return () => {
      request.current += 1;
    };
  }, [load]);

  if (!canManage) return null;

  const dirty =
    !!draft &&
    JSON.stringify(draft) !==
      JSON.stringify(savedRules ? toDraft(savedRules) : null);

  function updateLevel(
    level: GameLevel,
    field: "speedMultiplier" | "toleranceMilliseconds",
    value: string,
  ) {
    setDraft((previous) =>
      previous
        ? {
            ...previous,
            levels: {
              ...previous.levels,
              [level]: { ...previous.levels[level], [field]: value },
            },
          }
        : previous,
    );
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || !canManage || saving || !dirty) return;
    setError("");
    try {
      const levels = Object.fromEntries(
        gameLevels.map((level) => {
          const values = draft.levels[level];
          if (
            !values.speedMultiplier.trim() ||
            !values.toleranceMilliseconds.trim()
          ) {
            throw new Error(`Enter both values for the ${level} level.`);
          }
          return [
            level,
            {
              speedMultiplier: Number(values.speedMultiplier),
              toleranceMilliseconds: Number(values.toleranceMilliseconds),
            },
          ];
        }),
      );
      const rules = parseGameRules({ ...draft, levels });
      setSaving(true);
      const saved = await gameRulesService.saveTenSeconds(rules);
      setSavedRules(saved);
      setDraft(toDraft(saved));
      toast.success("Ten Seconds game rules saved");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not save game rules. Your changes have not been saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ten Seconds game rules</CardTitle>
        <CardDescription>
          Control game availability, the active difficulty, and timing for each
          level. Changes apply after you save.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div role="status" className="space-y-4">
            <span className="text-sm text-muted-foreground">
              Loading game rules…
            </span>
            <Skeleton className="h-32 w-full" />
          </div>
        ) : !draft ? (
          <div className="space-y-4">
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                No Ten Seconds game rules have been created in this environment.
                Start with the suggested settings, review them, then save to
                create the configuration.
              </p>
            )}
            {error ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => void load()}
              >
                Retry loading game rules
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => setDraft(toDraft(suggestedGameRules))}
              >
                Use suggested settings
              </Button>
            )}
          </div>
        ) : (
          <form onSubmit={save} className="space-y-6">
            {!savedRules && (
              <p role="status" className="text-sm text-muted-foreground">
                Suggested settings are shown below. They have not been saved
                yet.
              </p>
            )}
            <fieldset disabled={saving} className="min-w-0 space-y-6">
              <legend className="sr-only">Ten Seconds settings</legend>
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="ten-seconds-enabled">Game enabled</Label>
                    <p
                      id="ten-seconds-enabled-help"
                      className="text-sm text-muted-foreground"
                    >
                      Allow the game to be available to players.
                    </p>
                  </div>
                  <Switch
                    id="ten-seconds-enabled"
                    aria-describedby="ten-seconds-enabled-help"
                    checked={draft.enabled}
                    onCheckedChange={(enabled) =>
                      setDraft({ ...draft, enabled })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ten-seconds-level">Active difficulty</Label>
                  <Select
                    value={draft.activeLevel}
                    disabled={saving}
                    onValueChange={(activeLevel: GameLevel) =>
                      setDraft({ ...draft, activeLevel })
                    }
                  >
                    <SelectTrigger id="ten-seconds-level">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {gameLevels.map((level) => (
                        <SelectItem key={level} value={level}>
                          {level.charAt(0).toUpperCase() + level.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Select which level’s settings the game uses.
                  </p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Speed multiplier scales the game speed; 1 uses the base speed.
                Use a speed greater than 0. Tolerance is the allowed timing
                margin in milliseconds and must be a whole number, 0 or higher.
              </p>
              <div className="space-y-4">
                {gameLevels.map((level) => (
                  <div
                    key={level}
                    className="grid gap-4 border-t pt-4 sm:grid-cols-[5rem_1fr_1fr]"
                  >
                    <p className="font-medium capitalize sm:pt-7">{level}</p>
                    <div className="space-y-2">
                      <Label htmlFor={`ten-seconds-${level}-speed`}>
                        Speed multiplier
                      </Label>
                      <Input
                        id={`ten-seconds-${level}-speed`}
                        aria-label={`${level} speed multiplier`}
                        type="number"
                        required
                        min="0"
                        step="any"
                        value={draft.levels[level].speedMultiplier}
                        onChange={(event) =>
                          updateLevel(
                            level,
                            "speedMultiplier",
                            event.target.value,
                          )
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`ten-seconds-${level}-tolerance`}>
                        Tolerance (ms)
                      </Label>
                      <Input
                        id={`ten-seconds-${level}-tolerance`}
                        aria-label={`${level} tolerance in milliseconds`}
                        type="number"
                        required
                        min="0"
                        step="1"
                        value={draft.levels[level].toleranceMilliseconds}
                        onChange={(event) =>
                          updateLevel(
                            level,
                            "toleranceMilliseconds",
                            event.target.value,
                          )
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            </fieldset>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={saving || !dirty}>
                {saving
                  ? "Saving game rules…"
                  : savedRules
                    ? "Save game rules"
                    : "Create game rules"}
              </Button>
              {savedRules && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving || !dirty}
                  onClick={() => {
                    setDraft(toDraft(savedRules));
                    setError("");
                  }}
                >
                  Discard changes
                </Button>
              )}
              {dirty && !saving && (
                <p role="status" className="text-sm text-muted-foreground">
                  Unsaved changes
                </p>
              )}
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

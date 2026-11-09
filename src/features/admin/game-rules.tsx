import { FeatureTabs } from "./feature-tabs";
import { useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useCurrentUser } from "@/contexts/UserContext";
import { ApiError } from "@/lib/api";
import {
  LEVELS,
  INITIAL_GAME_DRAFT,
  GAME_PRESETS,
  GAME_STORAGE_PREFIX,
  GAME_CONSTANTS,
  cloneRules,
  gameTiming,
  loadGameRules,
  parseGameRules,
  restoreGameSave,
  saveGameRules,
  validateGameRules,
  type GameRules,
  type GameSnapshot,
  type LevelName,
  type PendingGameSave,
} from "@/lib/game-rules";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TabSectionSkeleton } from "@/components/ui/tab-section-skeleton";
import { RefreshButton } from "@/components/ui/refresh-button";
import {
  ErrorNotice,
  Heading,
  InformationCard,
  Notice,
  RecordView,
} from "./shared";
import { RewardCampaignManager } from "./reward-campaigns";
const selectClass =
  "h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const title = (name: string) => name[0].toUpperCase() + name.slice(1);
const milliseconds = (value: number) =>
  `${value.toLocaleString("en-NG", { maximumFractionDigits: 3 })} ms`;
export function GameRulesPage() {
  const { user } = useCurrentUser();
  const { pathname } = useLocation();
  return user ? (
    <div className="space-y-6">
      <Heading
        title="Ten Seconds"
        description="Configure game timing, reward limits and campaigns."
      />
      <FeatureTabs
        label="Ten Seconds sections"
        queryKey={pathname === "/app-config" ? "gameTab" : "tab"}
        sections={[
          {
            id: "rules",
            label: "Game rules",
            content: <GameRulesBootstrap key={user.id} actor={user.id} />,
          },
          {
            id: "campaigns",
            label: "Reward campaigns",
            content: <RewardCampaignManager forGame />,
          },
        ]}
      />
    </div>
  ) : null;
}
function GameRulesBootstrap({ actor }: { actor: string }) {
  const [snapshot, setSnapshot] = useState<GameSnapshot>();
  const [error, setError] = useState<unknown>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    void loadGameRules(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setSnapshot(result);
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(failure);
      });
    return () => controller.abort();
  }, [revision]);
  if (!snapshot)
    return (
      <div className="space-y-6">
        {error ? (
          <ErrorNotice
            error={error}
            retry={() => setRevision((value) => value + 1)}
          />
        ) : (
          <TabSectionSkeleton section="game" />
        )}
      </div>
    );
  return (
    <GameRulesEditor
      key={`${actor}:${snapshot.environment}`}
      actor={actor}
      initial={snapshot}
      changeEnvironment={setSnapshot}
    />
  );
}
type Draft = { rules: GameRules; baseVersion: number | null };
function restoreDraft(
  raw: string | null,
  saved: GameRules | null,
  version: number,
): Draft {
  if (!raw)
    return {
      rules: cloneRules(saved || INITIAL_GAME_DRAFT),
      baseVersion: version,
    };
  const draft = JSON.parse(raw) as Draft;
  if (
    !draft?.rules ||
    typeof draft.rules.enabled !== "boolean" ||
    !LEVELS.includes(draft.rules.activeLevel) ||
    !draft.rules.levels ||
    !LEVELS.every((name) => draft.rules.levels[name])
  )
    throw new Error(
      "The local draft could not be restored. Reload saved settings before editing.",
    );
  if (draft.baseVersion === undefined) draft.baseVersion = null;
  if (
    draft.baseVersion !== null &&
    (!Number.isSafeInteger(draft.baseVersion) || draft.baseVersion < 0)
  )
    throw new Error("Invalid local draft version. Reload saved settings.");
  for (const name of LEVELS)
    for (const key of ["speedMultiplier", "toleranceMilliseconds"] as const) {
      const value = draft.rules.levels[name][key];
      if (value !== null && typeof value !== "number")
        throw new Error("Invalid local timing draft. Reload saved settings.");
      if (value === null) draft.rules.levels[name][key] = NaN;
    }
  for (const key of ["maxRewardsPerDay", "maxRewardsPerUserDay"] as const) {
    if (draft.rules[key] === null) draft.rules[key] = NaN;
    else if (typeof draft.rules[key] !== "number")
      throw new Error("Invalid local reward limits. Reload saved settings.");
  }
  return draft;
}
function GameRulesEditor({
  actor,
  initial,
  changeEnvironment,
}: {
  actor: string;
  initial: GameSnapshot;
  changeEnvironment: (snapshot: GameSnapshot) => void;
}) {
  const storageKey = `${GAME_STORAGE_PREFIX}${location.origin}:${initial.environment}:${actor}`;
  const restored = useRef<{
    draft: Draft;
    pending: PendingGameSave | null;
    local: boolean;
    error: unknown;
  }>();
  if (!restored.current) {
    try {
      const pending = restoreGameSave(
        sessionStorage.getItem(`${storageKey}:pending`),
      );
      const local = sessionStorage.getItem(`${storageKey}:draft`);
      restored.current = {
        pending,
        local: !!local,
        error: null,
        draft: pending
          ? {
              rules: parseGameRules(JSON.parse(pending.body)),
              baseVersion: JSON.parse(pending.body).expectedVersion,
            }
          : restoreDraft(local, initial.rules, initial.version),
      };
    } catch (error) {
      restored.current = {
        pending: null,
        local: false,
        error,
        draft: restoreDraft(null, initial.rules, initial.version),
      };
    }
  }
  const restoredNeedsReview =
    !restored.current.pending &&
    restored.current.local &&
    restored.current.draft.baseVersion !== initial.version;
  const [rules, setRules] = useState(restored.current.draft.rules);
  const [saved, setSaved] = useState(initial.rules);
  const [version, setVersion] = useState(
    restored.current.draft.baseVersion ?? initial.version,
  );
  const [reason, setReason] = useState(initial.reason);
  const [setup, setSetup] = useState(
    !!initial.rules || !!restored.current.pending || restored.current.local,
  );
  const [pending, setPending] = useState(restored.current.pending);
  const [error, setError] = useState<unknown>(restored.current.error);
  const [validation, setValidation] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [readBlocked, setReadBlocked] = useState(!!restored.current.error);
  const [needsReview, setNeedsReview] = useState(restoredNeedsReview);
  const [latest, setLatest] = useState<GameSnapshot | null>(
    restoredNeedsReview ? initial : null,
  );
  const [status, setStatus] = useState(
    restored.current.pending
      ? "A previous save has an uncertain outcome. Retry its exact request before editing."
      : restoredNeedsReview
        ? "Saved rules changed since this local draft was prepared. Review the current rules before a new save."
        : restored.current.local
          ? "Local draft restored. It has not been saved."
          : "",
  );
  const [retryAt, setRetryAt] = useState(0);
  const [preset, setPreset] = useState<keyof typeof GAME_PRESETS>("balanced");
  const validationSummary = useRef<HTMLUListElement>(null);
  const errorSummary = useRef<HTMLDivElement>(null);
  const lock = useRef(false);
  const mounted = useRef(true);
  const draftValue: GameRules = {
    enabled: rules.enabled,
    activeLevel: rules.activeLevel,
    levels: Object.fromEntries(
      LEVELS.map((name) => [
        name,
        {
          speedMultiplier: rules.levels[name].speedMultiplier,
          toleranceMilliseconds: rules.levels[name].toleranceMilliseconds,
        },
      ]),
    ) as GameRules["levels"],
    maxRewardsPerDay: rules.maxRewardsPerDay,
    maxRewardsPerUserDay: rules.maxRewardsPerUserDay,
  };
  const dirty = !saved || JSON.stringify(draftValue) !== JSON.stringify(saved);
  const disabled = busy || !!pending || readBlocked || needsReview;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (disabled || !setup) return;
    try {
      if (dirty)
        sessionStorage.setItem(
          `${storageKey}:draft`,
          JSON.stringify({ rules, baseVersion: version }),
        );
      else sessionStorage.removeItem(`${storageKey}:draft`);
    } catch {
      /* A mutation still requires durable command storage. */
    }
  }, [rules, version, dirty, disabled, storageKey, setup]);
  useEffect(() => {
    if (!retryAt) return;
    const timer = setTimeout(
      () => setRetryAt(0),
      Math.max(0, retryAt - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [retryAt]);
  useEffect(() => {
    const summary = validation.length
      ? validationSummary.current
      : error
        ? errorSummary.current
        : null;
    if (summary) {
      summary.focus();
      summary.scrollIntoView({ block: "center" });
    }
  }, [validation, error]);
  async function reload(afterSave = false) {
    const snapshot = await loadGameRules();
    if (!mounted.current) return;
    if (snapshot.environment !== initial.environment) {
      changeEnvironment(snapshot);
      return;
    }
    sessionStorage.removeItem(`${storageKey}:draft`);
    setSaved(snapshot.rules);
    setVersion(snapshot.version);
    setReason(snapshot.reason);
    setRules(cloneRules(snapshot.rules || INITIAL_GAME_DRAFT));
    setSetup(!!snapshot.rules);
    setReadBlocked(false);
    setNeedsReview(false);
    setLatest(null);
    setStatus(
      afterSave
        ? "Save accepted. Showing the current saved configuration."
        : "Showing the current saved configuration.",
    );
  }
  async function reloadSaved(abandon = false) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    setValidation([]);
    try {
      if (abandon) {
        sessionStorage.removeItem(`${storageKey}:pending`);
        setPending(null);
      }
      await reload();
    } catch (failure) {
      if (mounted.current) {
        setError(failure);
        setReadBlocked(true);
      }
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function loadLatest() {
    try {
      const snapshot = await loadGameRules();
      if (snapshot.environment !== initial.environment)
        changeEnvironment(snapshot);
      else setLatest(snapshot);
    } catch (failure) {
      setError(failure);
    }
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current || readBlocked || needsReview || retryAt > Date.now())
      return;
    lock.current = true;
    setBusy(true);
    setError(null);
    setValidation([]);
    let command = pending;
    let sent = false;
    try {
      if (!command) {
        const errors = validateGameRules(draftValue);
        if (errors.length) {
          setValidation(errors);
          return;
        }
        command = {
          key: crypto.randomUUID(),
          body: JSON.stringify({ expectedVersion: version, ...draftValue }),
        };
        if (new TextEncoder().encode(command.body).length > 32768)
          throw new Error("Game rules exceed the 32 KiB limit.");
        sessionStorage.setItem(
          `${storageKey}:pending`,
          JSON.stringify(command),
        );
        setPending(command);
      }
      sent = true;
      await saveGameRules(command, initial.environment);
      sessionStorage.removeItem(`${storageKey}:pending`);
      sessionStorage.removeItem(`${storageKey}:draft`);
      if (!mounted.current) return;
      setPending(null);
      setReadBlocked(true);
      try {
        await reload(true);
      } catch (failure) {
        setStatus(
          "Save succeeded, but readback failed. Reload saved settings before editing again.",
        );
        setError(failure);
      }
    } catch (failure) {
      if (!mounted.current) return;
      const definitive =
        failure instanceof ApiError &&
        failure.status >= 400 &&
        failure.status < 500 &&
        ![401, 408, 429].includes(failure.status);
      if (definitive) {
        sessionStorage.removeItem(`${storageKey}:pending`);
        setPending(null);
        if (failure.status === 409) {
          setNeedsReview(true);
          setStatus(
            failure.details?.reason === "version_conflict"
              ? "The saved rules changed. Load the latest version and review your preserved draft before a new save."
              : "The service reported a command conflict. Reload and review before preparing a new save.",
          );
          await loadLatest();
        } else
          setStatus(
            "Save rejected. Review the fields and super-administrator access before trying again.",
          );
      } else
        setStatus(
          command && sent
            ? "The save outcome may be unknown. Retry the retained request unchanged, or deliberately abandon it and reload."
            : "No request was sent. Check that this tab can use session storage.",
        );
      if (
        failure instanceof ApiError &&
        failure.status === 429 &&
        failure.retryAfter
      ) {
        const until = /^\d+$/.test(failure.retryAfter)
          ? Date.now() + Number(failure.retryAfter) * 1000
          : Date.parse(failure.retryAfter);
        if (Number.isFinite(until)) setRetryAt(until);
      }
      setError(failure);
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  function editLevel(
    name: LevelName,
    key: "speedMultiplier" | "toleranceMilliseconds",
    value: string,
  ) {
    setRules((current) => ({
      ...current,
      levels: {
        ...current.levels,
        [name]: {
          ...current.levels[name],
          [key]: value === "" ? NaN : Number(value),
        },
      },
    }));
  }
  const active = rules.levels[rules.activeLevel];
  const previewValid =
    active &&
    Number.isFinite(active.speedMultiplier) &&
    active.speedMultiplier > 0 &&
    active.speedMultiplier <= 10 &&
    Number.isInteger(active.toleranceMilliseconds) &&
    active.toleranceMilliseconds >= 0 &&
    active.toleranceMilliseconds <= 1000;
  const computed = previewValid ? gameTiming(active) : null;
  const preview =
    computed && Number.isFinite(computed.target) ? computed : null;
  if (!setup && !error)
    return (
      <div className="space-y-6">
        <Notice>
          {reason === "invalid"
            ? "The service reports invalid game configuration."
            : "Game rules have not been configured."}{" "}
          Current version: {version}. Set up a draft explicitly before saving.
        </Notice>
        <Button onClick={() => setSetup(true)}>Set up game rules</Button>
      </div>
    );
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          One game. Three timing levels. One active level for every new attempt.
        </p>
        <Badge
          variant={dirty || pending || readBlocked ? "outline" : "secondary"}
        >
          {pending
            ? "Pending save"
            : readBlocked
              ? "Reload required"
              : !saved
                ? "Unsaved initial draft"
                : dirty
                  ? "Unsaved changes"
                  : "Saved configuration"}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        Loaded configuration version: {version}
      </p>
      {status && (
        <Notice>
          <p role="status">{status}</p>
        </Notice>
      )}
      {error != null && (
        <div
          ref={errorSummary}
          tabIndex={-1}
          className="scroll-mt-24 outline-none"
        >
          <ErrorNotice error={error} />
        </div>
      )}
      {!saved && !readBlocked && !pending && (
        <Notice>
          Unsaved setup draft. These suggested values will not apply until you
          save.
        </Notice>
      )}
      {validation.length > 0 && (
        <ul
          role="alert"
          ref={validationSummary}
          tabIndex={-1}
          aria-label="Game rule validation errors"
          className="scroll-mt-24 outline-none list-inside list-disc space-y-1 rounded-lg border border-destructive p-4 text-sm text-destructive"
        >
          {validation.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
      {needsReview && (
        <section
          aria-label="Review current game rules"
          className="space-y-4 rounded-xl border bg-card p-5"
        >
          <h2 className="text-lg font-semibold">Review current game rules</h2>
          <p className="text-sm text-muted-foreground">
            Your draft is preserved. Review the latest saved values before
            choosing a new version for the next request.
          </p>
          {latest && (
            <RecordView
              data={{
                version: latest.version,
                configured: latest.configured,
                ...latest.rules,
              }}
            />
          )}
          <div className="flex flex-wrap gap-2">
            {latest ? (
              <Button
                type="button"
                disabled={busy}
                onClick={() => {
                  setVersion(latest.version);
                  setSaved(latest.rules);
                  setNeedsReview(false);
                  setLatest(null);
                  setError(null);
                  setStatus(
                    "Latest version loaded. Your draft is preserved; review it before saving.",
                  );
                }}
              >
                Use latest version and review draft
              </Button>
            ) : (
              <RefreshButton loading={busy} onClick={() => void loadLatest()}>
                Load latest game rules
              </RefreshButton>
            )}
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void reloadSaved()}
            >
              Discard draft and load saved rules
            </Button>
          </div>
        </section>
      )}
      <form onSubmit={save} noValidate className="space-y-6">
        <fieldset
          disabled={disabled}
          className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]"
        >
          <legend className="sr-only">Ten Seconds game rules</legend>
          <div className="min-w-0 space-y-6">
            <InformationCard title="Game availability">
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Label htmlFor="game-enabled">Enable new attempts</Label>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Pausing blocks new starts. Existing attempts keep their
                      frozen rules and reward reservations.
                    </p>
                  </div>
                  <Switch
                    id="game-enabled"
                    checked={rules.enabled}
                    onCheckedChange={(enabled) =>
                      setRules({ ...rules, enabled })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="game-active-level">Global active level</Label>
                  <select
                    id="game-active-level"
                    className={selectClass}
                    value={rules.activeLevel}
                    onChange={(event) =>
                      setRules({
                        ...rules,
                        activeLevel: event.target.value as LevelName,
                      })
                    }
                  >
                    {LEVELS.map((name) => (
                      <option key={name} value={name}>
                        {title(name)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </InformationCard>
            <InformationCard title="Reward limits">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="game-daily-rewards">
                    Daily reward cap (UTC)
                  </Label>
                  <Input
                    id="game-daily-rewards"
                    type="number"
                    min={1}
                    max={10000}
                    step={1}
                    value={
                      Number.isFinite(rules.maxRewardsPerDay)
                        ? rules.maxRewardsPerDay
                        : ""
                    }
                    onChange={(event) =>
                      setRules({
                        ...rules,
                        maxRewardsPerDay:
                          event.target.value === ""
                            ? NaN
                            : Number(event.target.value),
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    1–10,000 across all players per UTC day.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="game-player-rewards">
                    Rewards per player per UTC day
                  </Label>
                  <Input
                    id="game-player-rewards"
                    type="number"
                    min={1}
                    max={5}
                    step={1}
                    value={
                      Number.isFinite(rules.maxRewardsPerUserDay)
                        ? rules.maxRewardsPerUserDay
                        : ""
                    }
                    onChange={(event) =>
                      setRules({
                        ...rules,
                        maxRewardsPerUserDay:
                          event.target.value === ""
                            ? NaN
                            : Number(event.target.value),
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    1–5 rewards; changes do not reset reserved or issued usage.
                  </p>
                </div>
              </div>
            </InformationCard>
            <InformationCard title="Level timing">
              <div className="space-y-5">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <Label htmlFor="game-preset">Suggested preset</Label>
                    <select
                      id="game-preset"
                      className={selectClass}
                      value={preset}
                      onChange={(event) =>
                        setPreset(
                          event.target.value as keyof typeof GAME_PRESETS,
                        )
                      }
                    >
                      {Object.entries(GAME_PRESETS).map(([key, value]) => (
                        <option key={key} value={key}>
                          {value.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const value = GAME_PRESETS[preset];
                      setRules({
                        ...rules,
                        activeLevel: value.activeLevel,
                        levels: structuredClone(value.levels),
                      });
                    }}
                  >
                    Apply preset to draft
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Presets change this draft only. Availability and reward quotas
                  are retained.
                </p>
                <div className="divide-y">
                  {LEVELS.map((name) => {
                    const level = rules.levels[name];
                    const valid =
                      Number.isFinite(level.speedMultiplier) &&
                      level.speedMultiplier > 0 &&
                      level.speedMultiplier <= 10 &&
                      Number.isInteger(level.toleranceMilliseconds) &&
                      level.toleranceMilliseconds >= 0 &&
                      level.toleranceMilliseconds <= 1000;
                    const timing = valid ? gameTiming(level) : null;
                    return (
                      <fieldset
                        key={name}
                        className="grid gap-4 py-5 first:pt-0 sm:grid-cols-[100px_minmax(0,1fr)_minmax(0,1fr)]"
                      >
                        <legend className="sr-only">{title(name)} level</legend>
                        <div className="flex items-center gap-2 sm:flex-col sm:items-start">
                          <h3 className="font-semibold">{title(name)}</h3>
                          {rules.activeLevel === name && (
                            <Badge variant="secondary">Active</Badge>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`game-${name}-speed`}>
                            {title(name)} speed multiplier
                          </Label>
                          <Input
                            id={`game-${name}-speed`}
                            type="number"
                            min={0}
                            max={10}
                            step="any"
                            value={
                              Number.isFinite(level.speedMultiplier)
                                ? level.speedMultiplier
                                : ""
                            }
                            onChange={(event) =>
                              editLevel(
                                name,
                                "speedMultiplier",
                                event.target.value,
                              )
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`game-${name}-tolerance`}>
                            {title(name)} tolerance (ms)
                          </Label>
                          <Input
                            id={`game-${name}-tolerance`}
                            type="number"
                            min={0}
                            max={1000}
                            step={1}
                            value={
                              Number.isFinite(level.toleranceMilliseconds)
                                ? level.toleranceMilliseconds
                                : ""
                            }
                            onChange={(event) =>
                              editLevel(
                                name,
                                "toleranceMilliseconds",
                                event.target.value,
                              )
                            }
                          />
                        </div>
                        <p className="text-xs text-muted-foreground sm:col-start-2 sm:col-span-2">
                          {timing
                            ? `Real target ${milliseconds(timing.target)} · Approx. elapsed window ${milliseconds(timing.minimum)}–${milliseconds(timing.maximum)}`
                            : "Enter valid timing values to preview this level."}
                        </p>
                      </fieldset>
                    );
                  })}
                </div>
              </div>
            </InformationCard>
          </div>
          <aside className="min-w-0 space-y-6 xl:sticky xl:top-24">
            <InformationCard title="Timing preview">
              <div className="space-y-5" aria-live="polite">
                {preview ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      {title(rules.activeLevel)} · {active.speedMultiplier}×
                      speed
                    </p>
                    <div>
                      <p className="text-3xl font-semibold tabular-nums">
                        {milliseconds(preview.target)}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Real elapsed target
                      </p>
                    </div>
                    <div
                      aria-hidden="true"
                      className="relative h-8 rounded-md bg-muted"
                    >
                      <span
                        className="absolute inset-y-1 rounded-sm bg-primary/30"
                        style={{
                          left: `${50 - active.toleranceMilliseconds / 20}%`,
                          width: `max(2px, ${active.toleranceMilliseconds / 10}%)`,
                        }}
                      />
                      <span className="absolute inset-y-0 left-1/2 w-px bg-primary" />
                    </div>
                    <dl className="space-y-3 text-sm">
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted-foreground">
                          Real tolerance
                        </dt>
                        <dd className="font-medium">
                          ±{milliseconds(preview.tolerance)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">
                          Approximate elapsed window
                        </dt>
                        <dd className="mt-1 font-medium tabular-nums">
                          {milliseconds(preview.minimum)}–
                          {milliseconds(preview.maximum)}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted-foreground">
                          Attempt expires after
                        </dt>
                        <dd>{milliseconds(preview.expiresAfter)}</dd>
                      </div>
                    </dl>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Enter valid speed and tolerance values for a preview.
                  </p>
                )}
                {computed &&
                  computed.minimum >=
                    GAME_CONSTANTS.attemptExpiryMilliseconds && (
                    <Notice>
                      The nominal timing window starts after the two-minute
                      expiry. This speed may make the level unwinnable.
                    </Notice>
                  )}
                <p className="text-xs text-muted-foreground">
                  Approximate real elapsed timing from this draft. The server
                  rounds scaled microseconds and checks plausibility and
                  two-minute expiry. This preview consumes no attempts.
                </p>
              </div>
            </InformationCard>
            <div className="space-y-3 px-1 text-sm text-muted-foreground">
              <p>
                Edits affect new attempts. Active attempts keep their timing and
                reward reservations.
              </p>
              <p>
                Five attempts, a ten-second virtual target and a 24-hour
                cooldown are fixed. The cooldown starts when the fifth attempt
                starts; it is not a midnight reset.
              </p>
              <p>
                Reward quota days use UTC. Enabled, game-eligible campaigns are
                selected by the server. Saving rules does not create eligible
                rewards.
              </p>
            </div>
          </aside>
        </fieldset>
        <p className="text-xs text-muted-foreground sm:hidden">
          Saves include the loaded version. Conflicts require review. Reload
          before editing and coordinate changes with other administrators.
        </p>
        <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-4 shadow-sm">
          <div className="hidden min-w-0 text-sm text-muted-foreground sm:block">
            <p>
              {pending
                ? "The retained request is locked for a safe retry."
                : "Saves use the loaded version. Review conflicts before retrying."}
            </p>
            <p className="text-xs">
              Reload before editing and coordinate changes with other
              administrators.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <RefreshButton
              loading={busy}
              disabled={busy || !!pending}
              onClick={() => void reloadSaved()}
              aria-label="Reload saved settings"
            >
              <span className="hidden sm:inline">Reload saved settings</span>
              <span className="sm:hidden">Reload</span>
            </RefreshButton>
            <Button
              type="submit"
              disabled={
                busy || readBlocked || needsReview || retryAt > Date.now()
              }
            >
              {busy
                ? "Working…"
                : retryAt > Date.now()
                  ? "Wait before retrying"
                  : pending
                    ? "Retry pending save"
                    : "Save game rules"}
            </Button>
          </div>
        </div>
      </form>
      {(pending || readBlocked) && (
        <div className="space-y-3 rounded-lg border p-4 text-sm">
          <p>
            {pending
              ? "The original save may already have committed. Abandoning it reloads current settings before you can prepare another edit."
              : "Reload saved settings to recover this editor. If a retained request could not be restored, its original save may already have committed."}
          </p>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void reloadSaved(true)}
          >
            {pending
              ? "Abandon pending save and reload"
              : "Discard local draft and reload"}
          </Button>
        </div>
      )}
    </div>
  );
}

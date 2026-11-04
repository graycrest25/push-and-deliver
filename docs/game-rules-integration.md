# Ten Seconds admin integration

Updated 4 November 2026 against the replacement backend reference, `pnd-backend/docs/game-admin-user-api-reference.md`. That reference supersedes the earlier implementation handoff. This document describes the current frontend and source contract; it does not establish live deployment readiness.

## Access and endpoints

`/game-rules`, shown under Growth, is restricted to super administrators. The route policy and same-origin proxy enforce this restriction; the proxy rechecks the native `/v2/auth/session` authority for both rule reads and writes. Reward campaign management remains available to super and regular administrators and is shared with Coupons. All requests use the existing native bearer session through the proxy, with `X-Account-Type: user`; no credentials are stored in editor drafts.

| Purpose | Method and path | Response |
| --- | --- | --- |
| Read rules and version | `GET /v1/admin/game/rules` | 200, `{data:{configured,version,configuration,reason,updatedAt},requestId}`. |
| Replace or pause rules | `PUT /v1/admin/game/rules` | 200, the same envelope with the saved configuration and incremented versions. |
| List campaigns | `GET /v1/admin/coupons/campaigns` | 200, `{data:{items,nextCursor,hasMore},requestId}`. |
| Create campaign | `POST /v1/admin/coupons/campaigns` | 200, the complete campaign in `data`. |
| Change campaign status/eligibility | `POST /v1/admin/coupons/campaigns/{id}/status` | 200, the complete updated campaign in `data`. |

Every mutation sends JSON and an `Idempotency-Key`. A new command receives a new key; an uncertain retry preserves its exact body and key. Admin mutation bodies are limited to 32 KiB.

## Versioned rules

The editable replacement is a direct camelCase object, without an additional wrapper:

```json
{
  "expectedVersion": 3,
  "enabled": true,
  "activeLevel": "easy",
  "levels": {
    "easy": {"speedMultiplier": 0.5, "toleranceMilliseconds": 100},
    "medium": {"speedMultiplier": 1, "toleranceMilliseconds": 100},
    "hard": {"speedMultiplier": 2, "toleranceMilliseconds": 100}
  },
  "maxRewardsPerDay": 10,
  "maxRewardsPerUserDay": 1
}
```

`expectedVersion` comes from the actual admin GET. All editable fields are required. To pause, retain the complete editable configuration and set `enabled:false`. The read-only `targetMilliseconds`, `maxAttempts` and `cooldownSeconds` are displayed as fixed behavior and excluded from writes. The parser checks returned metadata, matching versions and supported fixed limits before opening the editor.

| Field | Client validation |
| --- | --- |
| `expectedVersion` | Nonnegative safe integer from the loaded snapshot. |
| `enabled` | Boolean. |
| `activeLevel` | One of easy, medium or hard; one global active level. |
| `levels` | Exactly those three levels, each with both timing fields. |
| `speedMultiplier` | Finite number greater than 0 and at most 10. |
| `toleranceMilliseconds` | Integer from 0 through 1000. |
| `maxRewardsPerDay` | Integer from 1 through 10000, across players per UTC day. |
| `maxRewardsPerUserDay` | Integer from 1 through 5 per player per UTC day. |

Five attempts, a 10000 ms virtual target and an 86400-second cooldown are fixed. The cooldown starts when the fifth attempt starts; play allowance is not a calendar-midnight reset. Reward quotas use UTC days. Editing rules does not reset attempts or reserved/issued rewards. Active attempts retain frozen rules and reservations; pausing blocks new starts without cancelling them.

The server reports missing or invalid setup as 200 with `configured:false`, `configuration:null`, a `missing` or `invalid` reason, and the current version (0 for missing/unversioned setup). The page explains that state and requires **Set up game rules** before exposing suggested disabled draft values. A configured but disabled game remains a saved configuration. Transport, malformed-response and missing-environment errors show an error/retry state and never become silent defaults.

## Approximate timing preview

The preview calculates real elapsed milliseconds from the local draft:

```text
nominal target = 10000 / speedMultiplier
real tolerance = toleranceMilliseconds / speedMultiplier
nominal window = [(10000 - toleranceMilliseconds) / speedMultiplier,
                  (10000 + toleranceMilliseconds) / speedMultiplier]
attempt expiry = 120000 ms after start
```

These are approximate display values. Authoritative judging rounds `elapsedMicroseconds × speedMultiplier`, compares it with 10000000 microseconds using the configured tolerance, and applies server-age plausibility and expiry checks. For easy speed 0.5 and tolerance 100 ms, the nominal elapsed target is 20000 ms and window 19800–20200 ms. Extremely slow valid speeds can put the window after expiry; the preview warns when its nominal start is at or beyond two minutes.

The calculator makes no customer gameplay calls and consumes no attempts. It cannot establish a win. Balanced, Wider timing windows and Strict challenge presets update only the local active level and level timings; availability and reward quotas are retained until an explicit save.

## Conflicts, readback and retained saves

The editor stores drafts and pending rules commands per application origin, API-environment identity and actor. Its `pnd-game-rules:admin-rules:` prefix isolates this API contract's stored commands. The proxy attaches an environment identity derived from its configured API base URL; writes send it back, and a mismatch is rejected before forwarding. A different returned identity remounts the editor under the new scope. Successful explicit logout clears `pnd-game-rules:` storage.

Local drafts persist both `rules` and their `baseVersion`. On restoration, a stale base version or an unknown version from an older draft opens **Review current game rules** and blocks saving. The operator must review current saved values before explicitly adopting the latest version for a new save, or discard the draft and reload. This never updates the version inside an already pending command: its body, key and `expectedVersion` remain unchanged for an exact retry.

Before sending a new save, the editor validates and durably stores the exact serialized body, including `expectedVersion`, and random key in session storage. If storage is unavailable, no mutation is sent. Fields lock while a command is pending, and duplicate submissions are blocked. Network/timeout failures, unexpected responses, `401`, `408`, `429` and server errors preserve the command for explicit retry, including across editor reloads. Existing session refresh preserves request identity; `Retry-After` delays retries when present. Restored commands are checked for valid shape, field names, version and size.

A definitive rejection clears the pending command while preserving the draft. On `409`, the editor locks new saves, loads current rules and shows a review section. `error.details.reason:"version_conflict"` identifies stale rules. The operator can adopt the latest version while keeping the draft for review, or discard the draft and reload. A reviewed new save uses a new key. Identical-key replays return the original saved response, so every success is followed by a fresh GET. If readback fails after acceptance, the editor states that the save succeeded and blocks editing until reload succeeds.

Explicit abandonment removes an uncertain pending command and reloads current saved rules before further editing; the original save may already have committed. Damaged local storage similarly requires discard/reload. Status badges distinguish saved configuration, unsaved draft, pending save and reload-required states; validation and request errors receive focus.

## Shared native reward campaigns

`RewardCampaignManager` is used by Game rules and Coupons. Its cursor list reads actual campaigns newest first, using `limit` and opaque `cursor` with the same query context. The helper that refreshes a campaign before status changes scans real list pages with bounded iteration and repeated-cursor detection.

Creation sends only `title`, `percentageDiscount`, `validForHours`, `eligibleServices`, `enabled` and `gameEligible`. The client requires a trimmed nonblank title of at most 200 UTF-8 bytes, integer discount 1–100, validity 24 or 48 hours, and at least one distinct service from `courier`, `express`, `local`, `ridehailing`. Game-page creation defaults enabled and gameEligible to true; ordinary campaign creation does not imply game eligibility. Rewards are percentage coupons.

Status changes send required `enabled` and the current `expectedVersion`; an eligibility change also sends `gameEligible`. Omitting that flag preserves it. Before a new status mutation the manager reloads the campaign's actual version and refuses a change if its enabled/eligibility values changed since display. Conflicts require loading current values and reviewing before a new command.

Game selection requires enabled, game-eligible valid templates. Rule activation alone does not create rewards, and the list does not measure live availability or reserved quota. Campaign commands use shared `ActionForm` exact in-memory path/body/key retention and actor/request-fingerprinted stored idempotency keys. Unlike rule commands, full campaign bodies do not persist across unmounts or use the rule editor's environment scope.

## Design and verification scope

The page extends existing semantic colors and shared `InformationCard`, form controls, badges, notices, refresh controls, loading skeletons and responsive tables. No global tokens or sidecar were regenerated.

Local verification passed: TypeScript, four domain test groups in `tests/game-rules-unit.cjs`, and all twelve mocked game browser cases in `tests/native-game.spec.ts` across targeted runs. Independent design and source review returned **ship**. Live environment authorization, deployed contract compatibility, version races, reward quota/reservation behavior and customer timing/issuance remain separate verification work. No remote commands, staging mutations or live backend verification were executed.

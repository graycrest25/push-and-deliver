# Native admin integration status

## 6 November 2026 follow-up

- User and rider directories use the existing `GET /v1/admin/users` with a trimmed, URL-encoded `q` name search, a 300 ms debounce, cursor reset on search/type changes, and stale-response protection. Clearing restores the directory without `q`; backend order is retained. Directory exports remain scoped to the full account type.
- Broadcasts use the normal bearer-backed proxy and accept only `rider`, `customer`, or `all`. Title and body limits use UTF-8 bytes. The form requires HTTP 202 with a queued receipt, prevents pending duplicates, and preserves the operation key on retries. Queuing is not delivery confirmation.
- Order summaries retain `type=shipment|ride-courier`, render the returned counts and NGN minor-unit totals, and explain the actual `roundedPaidOrders` count. No client-side recomputation or automatic backfill is performed. Readiness, invalid-data, and temporary errors are distinct and retain request IDs.
- Promoter links are available at `/promoter-links` to super/regular administrators; `/generated` redirects there. Creation/renewal sends only an ASCII alphanumeric name and requires HTTP 201. `503 referral_pending` honors `Retry-After` and reuses the body/key. Lists use `items` and `nextCursor`; availability updates use `documentId` and only `{active}`. Returned code capitalization, share URLs, counts and expiry are preserved. Link attribution does not configure commissions or payments.

These changes are verified with local fixtures; integration tests do not send production broadcasts.

Current follow-up: see [Latest native admin integration](latest-api-integration-2026-11-03.md) for the resolved account, pricing and shipment gaps, new UI and remaining acceptance work. Earlier entries below describe the previous integration.


Updated 2026-11-03 against the supplied [native admin API update reference](../../pnd-backend/docs/admin-api-update-reference.md). This document supersedes the earlier eight-item source audit. The reference supplies native contracts for the earlier membership, releases, roles, coupons, bonus funding and support gaps. Source availability and local fixture tests are not deployed-backend verification.

## Implemented dashboard update

| Webapp section | Contracts and behavior |
|---|---|
| Authentication | `POST /v2/auth/login`, `GET /v2/auth/session`, `GET /v1/users/me`, `POST /v2/auth/refresh`, `POST /v2/auth/logout`. Membership comes exclusively from session `isAdmin` and `adminType`; session/profile UID and user context must match. Missing/malformed membership stays blocked; a known non-admin gets an access-required message. |
| Google administrator login | `POST /v2/auth/social/challenges` followed by `POST /v2/auth/admin/google`. Server-retained device ID, challenge nonce passed to Google, native token exchange and opaque credentials in HttpOnly cookies. The Google ID token is held only in memory for an identical-body/key uncertain retry. Existing linked administrators only; no signup or email auto-linking. |
| App configuration: mobile releases | `GET /v1/admin/config/mobile/{app}/{platform}` and `PUT` to the same route. Super-only editing of both apps/platforms, including safe creation of absent configuration and repair of invalid records. The editor read provides `configured`, actual `version` and nullable `configuration`; the form uses that actual version as `expectedVersion`, never guessing that a failed public read means version zero. The public mobile GET and equivalent body-scoped PUT remain allowlisted. |
| Administrator access | `GET /v1/admin/users/{id}/role`, then `POST` to the same route with subtype/null, reason and read version. Super-only UID lookup, all four subtypes and explicit removal. Own-role changes recheck the session. No private management key or unsupported admin directory lookup is used by this screen. |
| Coupons: campaigns | `GET/POST /v1/admin/coupons/campaigns`, `POST /v1/admin/coupons/campaigns/{id}/status`. Native cursor pagination, 24/48-hour templates, integer percentage and supported courier/express/local/ridehailing services. Super/regular only. |
| Coupons: customer codes | `POST /v1/admin/coupons/grants` with customer UID/campaign ID. Displays returned `code` and expiry; does not claim a notification was delivered. Ambiguous retries retain the same body/key. |
| Coupons: signup | `GET/PUT /v1/admin/coupons/signup/settings`. Explicit enablement, selected campaign IDs and version. Explains legacy `all_eligible` selection before saving explicit IDs. |
| Coupons: processing | `GET /v1/admin/coupons/signup/jobs`; `POST /v1/admin/coupons/signup/jobs/{user_id}/requeue` for a selected dead job, using its ID/generation and a reason. No old queue selector or creation of a fresh entitlement. |
| Signup wallet bonus | `GET/PUT /v1/admin/config/signup-bonus`. Super-only configuration and total allowance, with spent/remaining NGN visibility. Inputs explicitly use kobo. Budget cannot be below spent. Partial-write aliases `/v1/admin/config/signup_bonus_minor` and `/v1/admin/config/signup_bonus_budget_minor` are allowlisted; the screen uses the full versioned save to avoid separate competing edits. No arbitrary wallet-credit action. |
| Support queue and conversation | `GET /v1/admin/support/tickets`, `GET /{id}`, `GET/POST /{id}/messages`, `PUT /{id}/status`, `POST /{id}/claim`. Super/regular/customer-care access, cursor pagination, latest messages first, stable reply clientMessageId/key, closed-ticket reply restriction and current versions after claim/reply. Claim first for customer attachments, then download by asset ID through the private media proxy. Raw attachment download URLs are not rendered. Unavailable historical attachments render a placeholder via `attachmentUnavailable`, preserving the conversation. Reply uploads remain unsupported. |

## Native reads added on 3 November

| Section | Integrated native contract |
|---|---|
| User/rider directories | `GET /v1/admin/users?type=users|riders&limit&cursor`; reads `data.items`, correct native camelCase fields and real null identity values. Super/regular only. Rider selection is explicit. Unsupported vendor/merchant directories show an unavailable state instead of duplicating user records. |
| Profile details | `GET /v1/admin/users/{uid}?type=users|riders`. Uses the selected UID and context, with no invented status/review/identity writes. |
| Directory exports | `GET /v1/admin/reports/accounts?type=users&format=json|csv&limit&cursor` and `/reports/riders?format=json|csv&limit&cursor`. Rider export omits type. Each explicit download saves one bounded page; CSV uses preserved `X-Next-Cursor`, JSON uses `data.nextCursor`/`hasMore`. No old dates, after/offset, PDF or XLSX requests. |
| Ride list/detail | `GET /v1/admin/rides?status&limit&cursor`, `GET /v1/admin/rides/{id}`. Native DTO includes assignment, payment/pricing and route. Read-only controls; no old trips/offset/cancel contract. |
| Fees | `GET /v1/admin/rides/fares` and `/v1/admin/shipping/settings`, both paged allowlisted fee records. `moneyUnit=major` components are displayed as NGN naira; value retains fee-type-dependent units. Missing values stay unknown, and invalid fields remain visible. |
| Offices/countries | `GET /v1/admin/shipping/offices`, `/offices/{id}`, `/countries`, `/countries/{code}`. Paged `items`; includeInactive is camelCase. Country unknown postal-code policy remains null. |
| Tariffs | `GET /v1/admin/shipping/tariffs`, `/{id}`, `/{id}/rates`, `/{id}/countries`; local `/v1/admin/geography/tariffs`, `/{id}`, `/{id}/rates`. Summary/detail records and child collections remain separate; weights are grams and monetary amounts are kobo. |
| States | `GET /v1/admin/geography/states` with `localZone`, cursor/limit. No old LGA editing flow is exposed in this read view. |
| Audit | Super-only `GET /v1/admin/audit?limit&cursor`. Reads `items`; supports both dashboard actorUid/action rows and role actor/targetUid/adminType rows. Does not invent an action for role events or claim unified subsystem history. |
| Report coverage | Super-only `GET /v1/admin/analytics/coverage?report=...`, plus `POST /v1/admin/analytics/backfills` with stable operation key/body. Inspect returned job via `GET /v1/operations/{jobId}` and refresh coverage. HTTP 202 means accepted; incomplete reports remain visibly incomplete. |

Weekly/concentration/redemption filters use native camelCase dates (`endDate`, `weekOf`, `startDate`, `asOfDate`). Food/ecommerce order-summary choices are excluded from this rollout. Tracking is requested only for active pickup statuses 1/6; a tracking 404 shows an unavailable-location notice while retaining shipment detail. Table timestamps use a readable date line and a separate Lagos time/WAT line with non-wrapping text, including Created At.

The reference adds reads, not pricing/tariff/geography/ride mutation contracts. The replacement configuration screens expose inspection only. Directory access, ride/configuration reads and exports are super/regular; audit and coverage/backfill are super-only; customer care uses support, while verifier retains the supported report view rather than being sent to the restricted directory.

All dashboard writes carry a unique idempotency key and enforce a 32 KiB proxy body limit. Transient/uncertain errors preserve the pending body/key and disable editing while retrying. A definitive conflict disables resubmission until the record is refreshed; the new decision uses a fresh key. Successful versioned writes refetch current state rather than treating an idempotency replay snapshot as current. Lists honor `hasMore:false` and native cursors.

## Existing native integrations retained

The rider weekly deliveries and user activation tables now consume native `data.items`, camelCase row fields and `nextCursor`/`cursor`. Rider filters use `endDate`; completed totals sum the displayed weekly counts. Activation summary and coverage come from the same response, eliminating the unsupported `summary_only` request. TypeScript and three focused browser tests passed, including row rendering, null dates, summary percentages and pagination. The earlier live audit records the pre-fix observations and has not been rewritten as post-fix verification.

- Account/order reports: `GET /v1/admin/analytics/account-summary`, `/order-summary`. Unavailable data remains an error, not zero totals. Verifier sees rider account summaries only.
- Referrals: `GET /v1/admin/referrals`, `/summary`, `/export.csv`, with native page sizes, filter-bound cursors and Lagos date ranges.
- Jobs: `GET /v1/admin/jobs`, `GET /{id}`, `POST /{id}/replay`, with dead-state/generation checks and paged attempts.
- Shipments: `GET /v1/shipments`, `GET /{id}`, `GET /{id}/tracking`, with native filters and protected document downloads.
- Manual withdrawals: `GET /v1/admin/withdrawals`, `GET /{id}`, `POST /{id}/approve`, `/reject`, `/mark-successful`, assigned-admin `GET /{id}/bank-details`. Claims and recorded manual transfers; no automatic bank transfer controls.
- Assets: `POST /v1/assets/upload-intents`, signed storage PUT, `POST /v1/assets/{id}/complete`, `GET /v1/operations/{id}`, `DELETE /v1/assets/{id}` and proxied `GET /v1/media/{id}/content`. Purpose/size/checksum validation, metadata-only upload drafts and resumable processing.

## Proxy and authentication boundaries

`BASE_URL` remains server-only; no NEXT-prefixed proxy variables. The proxy alone sends bearer credentials and `X-Account-Type:user`. Caller authorization/context headers cannot switch identities. It redacts upstream origin and access/refresh tokens from browser JSON, rejects cross-origin writes and unsupported routes, and stores sessions atomically in an HttpOnly/SameSite=Strict cookie (Secure and Host-prefixed in production).

Refresh is single-flight across tabs using Web Locks and a server-derived stable rotation key. A 110-second browser cutoff bounds uncertain refresh retries. Failed refresh does not turn an account into a non-admin; revoked credentials require reauthentication. Private operator `POST /v1/admin/users/super-admin`, retired auth, standalone uploads and payout-withdrawal paths remain blocked.

The login forgot-password option and the signed-in change-password feature remain removed as requested. Existing direct recovery routes are retained; `/v2/auth/reauthenticate` and `/v2/auth/password/change` are not exposed.

For Google, configure server environment `GOOGLE_CLIENT_ID` (no NEXT_ prefix). `/api/auth/options` publishes only this public OAuth audience, never BASE_URL or a client secret. Also authorize the dashboard origin in Google and allow the audience in backend `GOOGLE_CLIENT_IDS`. The login page always displays the outlined Google button with its icon and an “or” divider. When no client ID is configured, selecting it explains that setup is required and keeps email sign-in available. Implementation follows the [Google Identity Services nonce and callback contract](https://developers.google.com/identity/gsi/web/reference/js-reference). No Firebase dependency is used.

## Remaining gaps and blockers

1. **Deployment/readiness still needs acceptance.** The reference requires PostgreSQL operational persistence, migrations through `000099_native_admin_audit_read.sql`, updated runtime grants and API/worker restart. No deployment or live write was performed in this integration. Report coverage may remain incomplete; use the coverage/rebuild screen to inspect readiness rather than treating unavailable totals as zero.
2. **Native application and mutation contracts remain limited.** Vendor/merchant directories, rider/vendor application review, account-status changes, pricing/tariff/state edits and admin ride writes are not established by these new reads. Their former forms must not be inferred from standalone payloads. Marketplace, notifications, subsystem-wide audit and destination-specific upload-on-behalf remain outside this update.
3. **Shipment status commands are integrated.** Super admins can use native versioned office acceptance, HQ receipt, dispatch, delivery and early cancellation. Grouped details, status dropdowns, conditional tracking and documents are integrated. Selected-rider assignment, arbitrary corrections, customs intake editing, clearance-only completion and cash receipts remain gaps; see [Shipment workflow contracts](shipment-workflow-contracts.md) for existing/proposed endpoints, requests and responses.
4. **Support attachment replies remain unsupported.** Claim-based native attachment reads and unavailable legacy-media placeholders are implemented. Text replies do not accept uploads or arbitrary document reassignment.
5. **Google/provider acceptance remains a deployment check.** The supplied client ID is configured locally as `GOOGLE_CLIENT_ID`; deploy it alongside the backend audience allowlist and authorized dashboard origin. Local mocked provider checks do not prove real Google sign-in acceptance.

The earlier dated live audits remain historical observations. The new directory, audit and tariff response mappings address those reported hidden rows; subsequent local fixture verification is recorded separately below.

## Verification

Verified locally on 2026-11-03: TypeScript and the isolated production build passed. All 38 browser cases passed across the full suite (37 passing plus one navigation-wait assertion corrected) and the four-case focused rerun. The rerun also checks Created At date/time layout on desktop/mobile and both CSV/JSON directory exports. Compiled browser bundles contained no configured backend URL or origin. No deployed business writes or backend migrations were performed.

Verified locally on 2026-11-02: TypeScript and the isolated production build passed. All 29 browser cases passed across the authentication/native-feature run and the corrected 11-case dashboard rerun. Desktop/mobile release views were inspected. The configured backend URL and origin appeared in none of the 23 compiled browser JavaScript files. These results use local fixtures, not a deployed backend.

`npm test` runs isolated local API fixtures on 4319 and Next on 4320 with `.next-verification`, separate from the user's normal preview. New dashboard tests use the actual application and authoritative fixture session roles. Older feature tests also retain a separate component harness under `tests/harness`; its mock context never enters the production build. Historical standalone tests under `tests/standalone-reference` are excluded.

Run `npm run typecheck`, `npm test`, and `ADMIN_TEST_BUILD=1 npm run build`. No real credentials, role changes, customer messages, coupons, wallet credits or production settings are used by these tests. The [standalone migration reference](standalone-migration-reference.md) is historical, not the supported route inventory.

## Account workflow follow-up — 3 November 2026

The restored profile sections, role selection, linked record IDs, section-scoped table state and closed-ticket restrictions are described in [Account workflow contracts](account-workflow-contracts.md). That document separates existing integrations from proposed backend routes and includes requests, responses, permission requirements and remaining blockers. NIN/BVN remains removed. Wallet/transaction sections and profile-edit/application controls do not send requests to unsupported routes or show fabricated values.

## Pricing edits and current endpoint failures

The native fee and tariff APIs currently provide reads. Missing fee, office-price, zone/tariff, country-zone and weight-band writes are specified in [Pricing backend contracts](pricing-backend-contracts.md). The [3 November live endpoint error audit](admin-endpoint-error-audit-2026-11-03.md) contains failing requests, captured responses, rechecks and scope limits; source-audit gaps are not presented as live error responses.

Latest UI verification (3 November): targeted shipment, skeleton, report-card, profile and pagination checks passed, including the existing rider-delivery and activation-report regressions. TypeScript and the isolated production build passed. All 24 compiled browser JavaScript files were checked and contained neither the configured backend URL/origin nor the supplied audit password. Live endpoint evidence is limited to the read-only audit above; no business writes were exercised against the deployed service.

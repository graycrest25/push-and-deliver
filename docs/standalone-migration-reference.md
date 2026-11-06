# Historical standalone migration reference — superseded

This records work against the earlier standalone contracts. It is not the native runtime route inventory. Claims of supported routes, missing backend endpoints, and passing browser tests below require native revalidation. See [current status](api-migration.md).

# Admin API migration and endpoint gaps

Contract sources: [`admin-endpoints-reference.md`](../admin-endpoints-reference.md) and [`uploads.md`](../uploads.md), reviewed 2026-11-02. Exact upload models were also checked against the adjacent backend’s `api/domains.yaml` and asset handlers; catalogue ownership was checked against `internal/marketplace/catalogue.go`. This document distinguishes implemented integration from backend contracts that are absent or incomplete. The reference describes source registrations; it is not a deployed API smoke test.

## Deployment readiness

Earlier read-only deployment checks on 2026-11-02 returned **404** for `GET /v1/config` and **410** for unauthenticated `GET /v1/auth/me`. These checks were not repeated during this documentation review. The documented current auth route should return 401 without a session. Deploy the documented runtime or point `BASE_URL` at its matching origin before live sign-in verification. No alternate API version or auth contract is substituted by the client.

## Implemented architecture

- Next.js App Router hosts the existing React workspace, blue design tokens, sidebar, page finder, authentication frame, shared controls, and responsive shell. Existing deep links remain supported or lead to the corresponding replacement workflow.
- Browser requests use `/api/proxy/v1/...`. Only `src/server/proxy.ts` reads `BASE_URL`. No proxy environment variable uses a `NEXT_` prefix, and no upstream origin is placed in Next config, rewrites, client props, or client bundles.
- Firebase SDKs, Firestore queries/listeners, Firebase Auth/Storage, Cloud Function URLs, the Vite client environment injection, and Clerk remnants have been removed.
- Access and refresh tokens are HttpOnly, SameSite=Strict cookies. Production uses Secure `__Host-` cookies. Only the proxy attaches bearer credentials. Login and refresh responses expose identity, not tokens.
- Mutations require a matching Origin, route/method allowlisting, bounded JSON bodies, and no forwarding of caller authorization or arbitrary headers. Redirects are rejected except authorized upload content, fetched on the server without credentials from permitted storage hosts. Upstream error bodies and JSON strings have the configured origin removed.
- Session refresh is single-flight within a tab and serialized across tabs with the Web Locks API; a waiting tab checks whether another tab already refreshed. Cookies remain subject to upstream expiration and revocation. Browsers without Web Locks only have per-tab coordination; rotating refresh tokens can race across tabs there.
- Form submissions persist an operation key plus a SHA-256 fingerprint of the method/path/body in sessionStorage before sending. Personal form values and tokens are not stored there. Unchanged retries reuse the key, including after a reload; acknowledged successes remove it. Changed input represents a new operation. Session storage must be available for safe mutations.
- Pagination uses endpoint-specific `after`, `cursor`, or `offset`. There are no invented global totals. Bounded catalogues are explicitly labelled. Export pagination reads `X-Next-Cursor`; every export page is downloaded as a separate file.
- NGN minor units display as naira; editing explicitly labels integer minor units. Timestamps display in Africa/Lagos. Dashboard query dates remain UTC; analytics/export dates use the reference's Lagos rules.

## Workflow mapping

| Workspace | Current endpoints and behavior |
|---|---|
| Sign in / security | `/v1/auth/login`, `/me`, `/refresh`, `/logout`, `/logout-all`, `/forgot-password`, `/reset-password`, `/change-password`. Public signup and Google login are removed from the admin flow. |
| Membership / navigation | `/v1/admin/users?role=admin&search=<signed-in email>&limit=100`, traversed as needed and matched by exact user ID, supplies membership absent from `/me`. No match grants no admin access. Endpoint 403s are handled independently. |
| Users / applications | `/v1/admin/users`, `/v1/admin/riders/{id}`, `/vendors/{id}`, review commands, user status and role commands. Applicant discovery does not assume applicants already have a rider/vendor primary role. |
| Dashboard | `/v1/admin/dashboard`; separates period order/revenue metrics from current queues and liabilities. |
| Analytics | All six `/v1/admin/analytics/*` routes: ride counts, weekly overview, weekly concentration, weekly rider deliveries, activation, coupon redemptions. Only super admins see these screens. |
| Account / rider exports | `/v1/admin/reports/accounts`, `/riders`; cursor pages and CSV/PDF/XLSX formats where documented. |
| Shipments | `/v1/shipments`, detail, tracking, customs intake, assignment, office receipt, dispatch, proof verification/reissue, cancellation; `/v1/admin/shipments/{id}/charges`, evidenced cash receipts and versioned clearance completion. Free-form status/payment flags are removed. |
| Rides | `/v1/rides/trips`, detail and eligible cancellation. Other rider-only transitions are not exposed as admin overrides. |
| Marketplace orders | `/v1/marketplace/orders`, detail and cancellation. Food and ecommerce share one list because a kind filter is not documented for order lists. |
| Withdrawals | `/v1/payouts/withdrawals`, detail, approval/rejection, reconciliation, OTP finalization and bounded recovery. No arbitrary “mark successful” operation. |
| Payment review / audit | Quarantined receipt list/detail/replay, reconciliation intake/status, `/v1/admin/audit`. Payment responses are unwrapped only for their documented envelope. Queued work remains distinct from completed work. |
| Support | Admin tickets and shared ticket messages/status endpoints. Newest messages first with cursor navigation for older messages, explicit refresh, and replies. There is no simulated Firestore subscription. |
| Referral links | `/v1/admin/referrals/links` create/list/status; preserves returned link codes and claim limits. |
| Coupons | Campaign create/status, direct grants, prefilled signup pool read/write, signup issuance/notification jobs and requeue with refresh; super-admin wallet bonus settings. |
| Broadcasts | `/v1/admin/notifications/broadcasts`; success says queued, not delivered. |
| Offices / countries | Shipping catalogue reads and `/v1/admin/shipping/offices/{id}` / `countries/{code}` upserts. |
| Domestic tariffs | State/LGA reads and upserts; complete draft rates, detail review, publish/retire. |
| Shipping tariffs | Country/zone/weight-band drafts and review/publish; old DHL arrays are replaced by carrier/direction/cargo tariff versions. |
| Pricing / capacity | Ride fares, complete marketplace settings replacement, shipping batch-size read/write. |
| Configuration | Public configuration read; per-key writes for mobile, referrals, Ten Seconds, signup bonus amount/budget; per-app/platform release read, prefilled replacement, validation, and refresh after save. User, rider, and existing vendor choices retain independent Android/iOS policies. |
| Catalogue | Item/category reads and writes, versioned item replacement, archival and explicit variant stock adjustments. |

## Upload contracts now covered

The supplied uploads document resolves the earlier missing-upload-documentation item. These routes and their lifecycle rules are documented:

| Operation | Documented route |
|---|---|
| Create multipart session | `POST /v1/uploads/multipart` |
| Inspect/resume session | `GET /v1/uploads/{id}/session` |
| Sign or renew a part upload | `POST /v1/uploads/{id}/parts/{part}` |
| Complete upload and queue processing | `POST /v1/uploads/{id}/complete` |
| Abort unfinished upload | `POST /v1/uploads/{id}/abort` |
| Compatibility binary upload | `POST /v1/uploads` |
| Read authorized asset metadata | `GET /v1/uploads/{id}` |
| Request signed download | `POST /v1/uploads/{id}/download` |
| Download authorized content | `GET /v1/uploads/{id}/content` |
| Delete an unreferenced finished asset | `DELETE /v1/uploads/{id}` |

Ownership, authorization through attached records, checksums, supported file types, the 10 MiB original/transmitted size limit, 5 MiB multipart chunks, resume, asynchronous readiness, quotas, idempotency and cleanup rules are also covered. Generic deletion is owner-only and cannot delete attached or still-processing assets; this restriction is intentional, not a missing delete endpoint. Session creation and part/session operations do not grant an admin an ownership bypass.

## Missing or incomplete backend contracts

These are gaps in the supplied current admin contracts, documentation still needed, or optional extensions for retained workflows. They are not a claim that every item is absent from all backend source code or deployments.

1. **Current admin membership — High.** `/v1/auth/me` omits `admin_type`. Return authoritative membership/capabilities there or through a current-admin endpoint. The frontend currently traverses the account search and accepts only an exact user-ID match; it never defaults to a privileged role.

2. **Complete admin account details — High.** No authorized full account-detail read is documented. Provide the permitted profile fields and wallet/account summaries; application detail reads do not replace an account profile.

3. **Application review queues — High.** `/v1/admin/users` has no rider/vendor approval-status or vendor-kind filters. Add `rider_status`, `vendor_status` and kind filters, or dedicated application lists. Applicants can still have primary role `customer`, so a rider/vendor role filter does not reliably find pending applications.

4. **Campaign and issued-coupon reads — High.** Campaign creation/status and grants are documented, but campaign list/detail, budget consumption and issued-coupon inventory reads are not. Add authorized read contracts for those views.

5. **Marketplace settings read — High.** `PUT /v1/marketplace/settings` has no documented matching GET. Return the normalized current settings and preferably a version to avoid overwriting concurrent changes.

6. **Signup bonus budget read — Medium.** The public configuration read excludes the budget. Add a super-admin read returning budget, spent amount, available funds and version together.

7. **Referral attribution history, summaries and export — Medium.** Current routes cover generated links, not full referral attribution. Define these contracts if the original referral reporting workflows remain required; the legacy referral adapter is explicitly not mounted.

8. **Broadcast management and delivery status — Medium.** Creation queues fanout, but no history/list, delivery status, editing, scheduling or cancellation/deletion contracts are registered in the reference. Define the supported operations and lifecycle; queue acceptance must not imply delivery.

9. **Admin wallet adjustments and merchant transaction history — Medium.** No authorized admin credit/debit commands or merchant ledger-history read are documented. If retained, implement audited financial commands and safe ledger projections rather than direct database writes.

10. **Admin profile, bank and attached-document corrections — Medium.** General rider/vendor profile editing, bank changes and admin document replacement/detachment are not documented. Upload ownership and generic deletion rules are now clear, but they do not authorize changing another account's profile or deleting an attached asset. Define permitted actors, field changes, ownership requirements, attachment transitions and auditing if these correction workflows are intended.

11. **Manual payout decision coverage — Medium; clarification required.** The reference explicitly says the legacy manual payout adapter is not mounted. Confirm whether any required manual-bank-transfer decisions are fully covered by the current payout commands or need an additional registered contract. Do not introduce an arbitrary paid-status override.

12. **Catalogue continuation — Medium; optional extension.** Geography/shipping catalogues are bounded without continuation, including the newest 100 tariff records. Add pagination if operators need records beyond the documented bounds; existing bounded reads are valid contracts.

13. **Operational list totals and broader search — Low; optional extension.** Most lists intentionally omit totals or broad text search. Add these only where the operational workflow needs them. Existing cursor pagination remains usable without totals.

14. **Legacy job/backfill administration — Low; optional extension.** Older job administration and backfill adapters are not mounted. Define replacements only for jobs still required. The old summary Cloud Function names are not themselves a gap: the current dashboard and six analytics endpoints already provide replacement reporting contracts.

15. **Admin uploads on behalf of vendors — Contract extension required.** Item and variant images must be ready assets owned by the item’s vendor. Multipart sessions always belong to the authenticated uploader; admins cannot assign their uploads to another owner. Category images support admin-owned uploads, but uploading new item/variant images for a vendor needs an explicitly authorized ownership/delegation contract. Existing authorized vendor-owned image IDs can be used today. The earlier exact-upload-schema documentation gap was resolved by reading the adjacent backend’s OpenAPI models.

16. **Custom coupon-code generation — Contract extension required.** The documented admin campaign and grant endpoints return campaign/coupon IDs, not a custom promo-code field. No standalone admin code-generation, bulk code export or admin coupon-by-code inventory contract is supplied. Campaign-linked referral creation does generate an `L-` code, but it must not be presented as a coupon code. The customer-owned coupon-by-code API is not an admin generator.

## Signup rewards integration

Coupons now includes campaign creation, availability changes, individual grants, prefilled automatic signup settings, issuance/notification job inspection and dead-work requeue with list refresh. The pool accepts at most 100 distinct campaign IDs; each must have a 24/48-hour lifetime. Campaign timing/funding/issuance capacity and recipient eligibility are enforced by the backend.

Super admins can read the current cash amount through `/v1/config`, set `signup_bonus_minor`, and replace `signup_bonus_budget_minor` from Coupons or App configuration. Both writes send the JSON integer itself. Budget/spend reads are still unavailable, so the budget form starts blank and does not invent a balance. Funding is distinct from coupon campaign budgets.

Checked against `internal/notifications/service.go` and `internal/community/extras.go`: `auth.verified`/`auth.created_verified` processing grants the wallet bonus and enqueues signup coupon work. Cash eligibility requires an active, verified customer-capable account, a positive configured amount and sufficient budget. The one-time bonus effect prevents duplicate credits, including retroactive awards after a disabled/unfunded signup. The admin UI configures this backend behavior; it does not call an arbitrary wallet-credit endpoint or prove the deployed worker has run.

## Mobile release settings

The additional `docs/user-rider-app-version-endpoints.md` supplied from the adjacent backend is integrated under App configuration. `GET /v1/config/mobile?app=...&platform=...` reads the selected policy; the proxy permits this public read without forwarding credentials. The protected `PUT /v1/admin/config/mobile/{app}/{platform}` sends a full replacement with a persistent operation key. Forms load current values before editing, validate exact numeric version syntax/order and contact byte limits, preserve false booleans/empty optional fields, and refresh through GET after saving. A 404 permits creation; other failed reads block editing. The API does not identify whether a read used global fallback. Store URLs and app binaries are outside this contract.

## Implemented upload integration

- File pickers in support replies (including attachment-only replies), shipment customs evidence, cash receipts, clearance completion, and category create/update forms use multipart sessions. Item/variant image controls validate existing authorized vendor-owned image IDs; admin-owned uploads are not offered for another vendor.
- The proxy allowlist covers multipart creation, session reads, part signing (parts 1 and 2 only), completion, abort, and deletion, in addition to existing metadata and download routes. API control requests stay on `/api/proxy/v1/...` with server-only `BASE_URL`; file bytes go directly to short-lived signed storage URLs with no cookies or API bearer credentials.
- JPEG/PNG/WebP and PDF files are limited to 10 MiB; category/catalogue images exclude PDF. Original files are transmitted unchanged, with full-file hexadecimal SHA-256 and padded-base64 checksums for each 5 MiB part. Signed headers use the documented array values; browsers supply Host and Content-Length.
- Progress shows transfer/validation stages. Ready asset IDs are attached only after `state=ready` and `asset.status=ready`. Parent forms block submission while uploads are pending or failed. Backend authorization and ownership remain authoritative.
- Creation and cleanup keys plus file metadata are kept in session storage, scoped to the current actor, page, form, and field. File bytes and signed URLs are never persisted. Within a page, retry uses the original File object; after reload/navigation, select the same original file to resume. Its hash, size and MIME must match, and completed part sizes/checksums are verified before skipping them. For dynamically added evidence rows, re-add the corresponding row to recover its draft. Successful form submissions clear their upload drafts.
- Control requests have bounded retries for transient failures, respect Retry-After, and poll processing with bounded backoff. Expired part URLs are renewed with the same checksum. Pause stops browser transfer/polling; Resume continues. Discard aborts unfinished uploads, and Delete unattached file queues owner-only deletion of ready drafts. Existing attached files are only removed from the form, never generically deleted.
- The optional legacy binary compatibility endpoint is intentionally not used; the JSON proxy does not accept binary streams. Multipart requires the backend’s S3 mode. Local-storage-only backend deployments return `s3_required` and cannot run this flow.

Browser S3 CORS must allow PUT from the admin web origin and the returned signed headers (including `x-amz-checksum-sha256`). S3 signing permissions, async workers and deployed route availability still require deployment verification. Existing authorized content downloads remain proxied; no signed download URL is saved in application records.

## Deployment and verification

Set `BASE_URL` to the API HTTPS origin on Vercel. The checked-in Vercel configuration selects Next.js; remove any project-level Vite/dist overrides. No additional credential secret is needed for this cookie-based proxy. For S3-compatible storage on a custom host, optionally set `DOWNLOAD_HOSTS` to a comma-separated list of exact trusted HTTPS storage hostnames; AWS S3 hosts are supported by default. This setting is server-only.

The backend's own permission, session, idempotency and financial invariants remain authoritative. The proxy conceals the configured API origin from this frontend; it cannot make an otherwise public backend undiscoverable or replace backend authorization.

Run `npm run typecheck`, `npm run build`, and `npm test`. Browser tests start a local mock API and local Next.js server with a temporary `BASE_URL` override; they do not mutate the configured live backend. Read-only deployment check on 2026-11-02: the configured `BASE_URL` returned HTTP 404 JSON for the documented public `GET /v1/config` and HTTP 410 JSON for unauthenticated `GET /v1/auth/me` (the current contract should reject a missing session with 401). Verify the deployed backend version/mount before rollout; no alternative route was guessed. Authenticated deployment verification still requires a provisioned admin account and the deployed version matching the reference. Existing Firebase-specific source-inspection tests and deployment snippets have been retired with their implementations.

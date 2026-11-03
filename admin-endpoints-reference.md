# Admin API: complete flow and endpoint reference

Source review date: 2026-11-02. This reference describes the routes registered by the PostgreSQL application in `internal/app/app.go`, including shared routes used by the admin dashboard. It describes checked-in behavior, not confirmation of a particular deployed version. Examples use placeholder IDs and fabricated data.

## Contents

- [Getting started and authentication](#getting-started-and-authentication)
- [Headers, responses and errors](#headers-responses-and-errors)
- [Pagination](#pagination)
- [Typical admin workflows](#typical-admin-workflows)
- [Accounts, application reviews and audit](#accounts-application-reviews-and-audit)
- [Dashboard and exports](#dashboard-and-exports)
- [Analytics](#analytics)
- [Configuration and mobile releases](#configuration-and-mobile-releases)
- [Coupons and signup jobs](#coupons-and-signup-jobs)
- [Referral links](#referral-links)
- [Support and broadcasts](#support-and-broadcasts)
- [Domestic geography and delivery tariffs](#domestic-geography-and-delivery-tariffs)
- [Shipping catalogue and settings](#shipping-catalogue-and-settings)
- [Shipment operations](#shipment-operations)
- [Payments and reconciliation](#payments-and-reconciliation)
- [Withdrawals and payouts](#withdrawals-and-payouts)
- [Ride and marketplace administration](#ride-and-marketplace-administration)
- [Metrics](#metrics)
- [Request and response model appendix](#request-and-response-model-appendix)
- [Runtime boundaries and integration notes](#runtime-boundaries-and-integration-notes)

## Getting started and authentication

Use your deployment's HTTPS API origin as `BASE_URL`. Paths below are relative to that origin. There is no separate admin login endpoint in the current runtime. Admins use the local Go/PostgreSQL authentication endpoints. Firebase tokens and legacy `/v2/auth` session contracts are not the authentication contract registered by this application.

1. An existing active, verified account must have role `admin` and an appropriate current `admin_memberships` row. Signing up does not grant administrator privileges. Only an authenticated super admin can grant membership through the role endpoint; initial bootstrap is an operational provisioning step outside this API.
2. Sign in through `POST /v1/auth/login`.
3. Keep the returned access token and refresh token private. Send the access token as a bearer credential on protected requests.
4. Use `/v1/auth/me` for the signed-in identity. Its `role` is the primary role; it does **not** return `admin_type`. A dashboard must still handle endpoint-level 403 responses.
5. Rotate the session using `/v1/auth/refresh`. Replace stored tokens with the returned values. After a role/status change, sign in again: the server revokes the affected account's sessions.

### Authentication endpoints used by admins

| Endpoint | Request | Success response | Purpose |
|---|---|---|---|
| `POST /v1/auth/login` | `{"email":"admin@example.test","password":"<password>"}` | 200, Tokens object below | Check local credentials and create a session. Unverified accounts receive 403; invalid credentials receive 401. |
| `POST /v1/auth/refresh` | `{"refresh_token":"<refresh-token>"}` | 200, Tokens | Rotate refresh credentials and access token. No bearer header required. |
| `GET /v1/auth/me` | No body; bearer required | 200, User | Read the current authenticated identity. |
| `POST /v1/auth/logout` | No body; bearer required | 200, `{"status":"signed_out"}` | Revoke this session. |
| `POST /v1/auth/logout-all` | No body; bearer required | 200, `{"status":"signed_out"}` | Revoke all of this user's sessions. |
| `POST /v1/auth/forgot-password` | `{"email":"admin@example.test"}` | 202, `{"status":"accepted","message":"If the account is eligible, an email will be sent."}` | Request a reset challenge without disclosing account existence. |
| `POST /v1/auth/reset-password` | `{"email":"admin@example.test","otp":"<code>","password":"<new-password>"}` | 200, `{"status":"password_updated"}` | Verify reset code and replace password. |
| `POST /v1/auth/change-password` | Bearer; `{"current_password":"<password>","new_password":"<new-password>"}` | 200, `{"status":"password_updated","message":"All sessions have been revoked. Sign in again."}` | Change a known password and revoke sessions. |

JSON auth bodies require `Content-Type: application/json`, reject unknown fields, and are limited to 16 KiB. New passwords require at least 12 characters and at most 256 bytes. Authentication requests are rate limited.

Tokens response (the example expiry is illustrative; use the actual `expires_in`):

```json
{
  "access_token": "<access-token>",
  "refresh_token": "<refresh-token>",
  "token_type": "Bearer",
  "expires_in": 900,
  "user": {
    "id": "admin-uid",
    "email": "admin@example.test",
    "display_name": "Administrator",
    "role": "admin",
    "roles": ["admin"],
    "capabilities": ["admin"],
    "email_verified": true,
    "status": "active"
  }
}
```

The nested `user` is the User response model returned directly by `/v1/auth/me`. Its custom JSON serializer includes `roles` and `capabilities`; admins receive `["admin"]` for both. These arrays do not expose membership subtype or replace domain authorization.

## Headers, responses and errors

Money uses integer minor units with explicit currency; NGN amounts are kobo (100 kobo = ₦1). For example `150000` means ₦1,500, not ₦150,000. BPS means basis points: 10000 = 100%. Timestamps are RFC3339 unless a route specifically asks for a calendar date. IDs are opaque; preserve imported UIDs verbatim.

### Request headers

| Header | When to send | Meaning |
|---|---|---|
| `Authorization: Bearer <access-token>` | Every protected route | Identifies the actor through a live local session. Never send the refresh token here. |
| `Content-Type: application/json` | Every JSON body | Required by common JSON decoders; send it consistently even where an older domain decoder does not enforce MIME type. |
| `Accept: application/json` | JSON requests, recommended | Documents the expected response. Export routes choose format using their query parameters. |
| `Idempotency-Key: <unique-operation-key>` | Mutations marked **Key required** below | Persist before sending. Reuse the same key and logical input after timeout/retry; use a new key for a new operation. |
| `Origin` | Set automatically by browsers | Must match an explicitly configured allowed origin when CORS middleware is enabled. |

A portable idempotency key is 8–128 characters from letters, digits, `.`, `_`, `:`, `-`; for example `admin-review-rider-001`. Some older services accept a broader character set, but this subset works across domains. Missing/invalid keys produce 400. Reusing a key with different input produces 409. Persistent receipts are scoped by actor and operation; do not infer a global key namespace. A retry may return the original mutation snapshot; fetch the resource again for its latest state.

No public `X-Admin-Role`, user ID header, or request body role can bypass authorization. `X-Account-Type` is not needed to select an admin account in this runtime. Do not supply internal gateway signature headers.

### Response headers

| Header | Meaning |
|---|---|
| `Content-Type: application/json` | Default for JSON responses. Exceptions include exports and `/metrics`. |
| `Cache-Control: no-store` | Do not cache private admin responses. |
| `X-Request-ID` | Server-generated correlation ID. Capture with failed request diagnostics. |
| `X-Content-Type-Options: nosniff` | Prevent MIME sniffing. |
| `Referrer-Policy: no-referrer` | Avoid leaking API locations through referrers. |
| `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` | Restrict executable/document content. |
| `Retry-After` | May accompany rate limiting or temporary admission failures; wait this many seconds. |
| `WWW-Authenticate: Bearer realm="api"` | Authentication middleware's 401 challenge. |
| `Content-Disposition`, `X-Report-Rows`, `X-Next-Cursor`, `X-Report-Truncated` | Export-specific; see each export. |

The supplied CORS middleware exposes `X-Request-ID`, `Retry-After`, and `X-Device-Generation`. It does **not** expose the export pagination headers. A browser integration that needs to read `X-Next-Cursor` must have that header exposed by its deployment/proxy or a future backend change. This document does not change CORS configuration.

### Success shapes

Most endpoints return a **raw** JSON object or array: no universal `data` wrapper and no body-level request ID.

```json
{"users": [{"id": "customer-001", "role": "customer", "status": "active"}]}
```

Admin payment endpoints use the **contract envelope** on successful responses:

```json
{
  "data": {"items": [], "nextCursor": null},
  "requestId": "<same-as-X-Request-ID>"
}
```

Case is significant: payment contract fields such as `nextCursor`/`jobId` are camelCase; most other domains use snake_case. Export success bodies are files, not JSON. All endpoint-specific success status codes are listed below.

### Errors

Common domain/auth errors:

```json
{"error":{"code":"forbidden","message":"Access denied"}}
```

Contract/gateway errors can additionally contain `error.details: {}` and `requestId`. Even payment endpoints can return an unwrapped `api.Fail` error, so do not assume every payment error has the success envelope.

| HTTP status | Meaning and client handling |
|---|---|
| 400 | Invalid JSON, unexpected fields, invalid enum/date/limit, missing key or failed input validation. Correct the request. |
| 401 | Missing, expired, revoked or invalid local session. Refresh once when appropriate, otherwise sign in. |
| 403 | Authenticated but insufficient current role/membership, unverified identity or forbidden ownership action. |
| 404 | Missing resource, unsupported route, or a resource not visible through that read contract. |
| 409 | State/version conflict, exhausted eligibility/budget, duplicate operation with changed input, or financial invariant failure. Re-read before deciding on a new command. |
| 429 | Rate limit reached. Respect `Retry-After`; avoid aggressive polling. |
| 500/503 | Domain/internal/dependency/provider failure or request timeout. Read status when possible; retry mutations with their original key and input. |

Do not rely on one error message string across domains. Use HTTP status and `error.code`. Database/Redis/provider availability and admission settings are deployment dependent.

## Pagination

There is no universal page-number API. GET requests have no body unless stated. Single-resource and mutation responses are not paginated.

| Style | Routes | Default / range | Continue / stop |
|---|---|---|---|
| Ascending ID, `after` | Admin users, audit, referral links | 50 / 1–100 | Send last returned `id` as `after`. No total or `next_cursor` is emitted. Empty page ends traversal; a short page also indicates no further rows at that request. Audit IDs are numeric. |
| Sequence, `after` | Admin support ticket list; support messages | 50 / 1–100 | Use response `next_cursor` as `after` to walk older entries. Empty string ends ordinary pagination. |
| Ascending user ID, `after` | Signup coupon jobs | 50 / 1–100 | Use `next_cursor`; empty string ends. |
| Ascending ID, `after` | Two paged analytics reports | 50 / 1–200 | Use `next_cursor` as `after`; null ends. |
| Opaque signed `cursor` | Payment webhook receipts | 25 / 1–100 | Use `data.nextCursor`; null ends. Token is scoped to actor/route/status/sort and expires. Do not edit it or change the status filter. |
| File response header | Accounts/withdrawals exports | 500 / 1–2000 | Send `X-Next-Cursor` as `after`; header absence ends. Cursor binds actor and filters. |
| ID in file response header | Rider export | 500 / 1–2000 | `X-Next-Cursor` is last included user ID; preserve filters. `X-Report-Truncated: true` means more rows. |
| Ascending ID, `after` | `/v1/payouts/withdrawals` | 30 / up to 100 | Raw array; send last `id` as `after`. Invalid/nonpositive limits fall back; excessive limits clamp to 100. |
| Opaque `cursor` | `/v1/shipments` | 30 / 1–100 | Use `next_cursor`; field is omitted on final page. Sorted by creation time descending, ID descending. |
| Offset | Ride and marketplace order lists | 30 / 1–100; offset 0–10000 | Raw array; increment `offset` by returned row count. No total or next cursor. Marketplace rejects invalid limits; rides use common fallback/clamping. |
| Bounded catalogue | Geography tariffs, shipping catalogues, categories, fares | Route-specific | No continuation token. Do not assume these are pageable. |

Account `after` length is at most 128; community pages allow at most 160, but signup jobs narrow it to 128. Analytics validates IDs separately. Preserve all filters during traversal. Pages are separate database reads: concurrent inserts, updates or support activity can change results; deduplicate by stable record ID. Offset pages are particularly sensitive to new records.

Example users traversal:

```http
GET /v1/admin/users?role=rider&limit=50
Authorization: Bearer <access-token>
```

If the last returned user is `rider-050`, fetch `/v1/admin/users?role=rider&limit=50&after=rider-050`. URL-encode query values. Do not send `page=2`.

## Typical admin workflows

### Review a rider or vendor

1. List users with the appropriate primary-role filter, or search by email/name. Applicants can still have primary role `customer`; inspect `rider_status`/`vendor_status` rather than assuming `role=rider` finds pending applications.
2. Read `/v1/admin/riders/{id}` or `/v1/admin/vendors/{id}`.
3. Inspect referenced private documents using the upload access endpoints. Readiness and authorization remain server checked.
4. Submit `approved` or `rejected` with a new idempotency key. Rejection needs a reason. Only pending applications can be reviewed, and self-review is forbidden.
5. Refresh application/user data and audit history. Approval changes primary role; riders retain customer capability.

### Configure pricing

For domestic ecommerce: create states → LGAs → draft geography tariff with rates → review → publish. For international shipping: create countries/offices → draft zone/weight tariff → review → publish. Published tariffs cannot be edited as drafts. Create a new tariff version instead. Ride fares and marketplace settings are separate pricing endpoints.

### Customs and physical shipping

Read shipment → enrich customs details if needed → assess charges → customer pays or operator records evidenced cash receipt. Clearance-only: when ready and fully paid, submit clearance evidence. Pickup delivery: assign eligible rider → rider proves pickup → admin receives at office → admin dispatches with carrier reference once all charges are paid → admin verifies delivery proof. Each command has its own persistent key. Current version must be supplied on customs edits/clearance completion.

### Payment incident

List quarantined webhook receipts → inspect one → correct the underlying condition → submit a reasoned replay → poll its receipt. For a wider missing-payment window, create a bounded reconciliation job and poll its status URL. A 202 acknowledges queued work; it is not proof of completed settlement.

### Coupon campaign

Create budgeted campaign → optionally enable/disable it → grant a coupon directly, attach it to a generated referral link, or add eligible 24/48-hour campaigns to signup settings. Monitor signup jobs and requeue dead work only with the documented queue selector. Issuance, redemption and notification delivery are separate effects.

## Accounts, application reviews and audit

Source: [accounts HTTP](../internal/accounts/http.go), [service](../internal/accounts/service.go).

### `GET /v1/admin/users`

**Access:** super, regular, customercare, verifier. **Request:** optional `after`, `limit`, `status=active|disabled`, `role`, `admin_type`, `search`; no body. Role/admin type are exact filters, not membership-grant inputs. Search is a case-insensitive substring of email or display name, trimmed, at most 120 bytes. Role/admin type filter strings are at most 20 bytes; unknown values simply need not match a row.

**200 response:** `{"users":[UserListEntry]}`. Entry fields: `id`, `email`, `display_name`, `role`, `status`, nullable `admin_type`, nullable `rider_status`, nullable `vendor_status`, `created_at`. Ascending-ID pagination, no total/next token. Intended for account discovery, filtering and opening review/detail screens.

### `GET /v1/admin/riders/{id}`

**Access:** super, regular, verifier for another account; the underlying application reader also permits the owner. **Request:** target UID in path, no body/query. **200:** raw rider profile row: `user_id`, approval `status`, `vehicle_type`, `vehicle`, `bank`, `profile_asset_id`, `document_asset_ids`, `document_labels`, reviewer/reason/timestamps. Returns 404 if no rider application exists. No pagination. This is an application read, not a complete user/account profile.

### `POST /v1/admin/riders/{id}/review`

**Access:** super, regular, verifier; cannot review self. **Key required.** Request: `{"status":"approved","reason":""}` or `{"status":"rejected","reason":"Document is unreadable"}`. Status must be approved/rejected; reason at most 500 bytes and nonempty on rejection.

**200:** `{"status":"approved"}` or `{"status":"rejected"}`. Only pending applications qualify. Approval rechecks current rider fields, phone/location, owned ready images and required document labels. Motorized applicants need vehicle photo, driver license, plate-number and vehicle-license images. Current implementation does not require rider bank details at approval; these are collected for withdrawals. Approval updates primary role to rider and emits review work; rejection records its reason. Invalid application/state returns 409. No pagination.

### `GET /v1/admin/vendors/{id}`

**Access:** super, regular, verifier for another account; owner exception as above. **Request:** path UID only. **200:** raw vendor profile row including `user_id`, `kind`, `status`, storefront fields, location, `profile_asset_id`, `hero_asset_id`, `document_asset_ids`, `document_labels`, `bank`, opening state/hours, registration/tax fields, reviewer and timestamps. No pagination. Private documents are distinct from the public hero image.

### `POST /v1/admin/vendors/{id}/review`

**Access:** super, regular, verifier; no self-review. **Key required.** Same review request/response as rider review. Only pending applications qualify. Approval rechecks owned ready assets, named document labels and complete valid vendor bank details; sets primary role to vendor, records reviewer/audit and emits a reviewed event. Rejection requires a reason. No pagination.

### `POST /v1/admin/users/{id}/status`

**Access:** super/regular; changing an existing admin requires super. Self-change forbidden. **Key required.** Request: `{"status":"disabled","reason":"Account review required"}`. Status is active/disabled, reason required and at most 500 characters under service validation.

**200:** `{"updated":true}`. Changes account status, revokes every target auth session, clears presence and writes audit. Closed accounts conflict. Re-enabling does not restore revoked sessions. No pagination.

### `POST /v1/admin/users/{id}/role`

**Access:** super only, no self-change. **Key required.** Request: `{"role":"admin","admin_type":"regular"}`. Roles: customer/rider/vendor/admin. Admin type is required for admin: super/regular/customercare/verifier. Omit it or send empty string for non-admin roles. Rider/vendor roles require an already approved matching application.

**200:** `{"updated":true}`. Updates membership and primary role, removes membership when leaving admin role, revokes target sessions, clears presence, writes audit. Closed accounts conflict. This is the authenticated privilege-management route; public signup cannot grant these privileges. No pagination.

### `GET /v1/admin/audit`

**Access:** super/regular. **Request:** `after` nonnegative decimal audit ID, `limit` 1–100/default 50. **200:** `{"events":[{"id":123,"actor_id":"admin-uid","target_id":"customer-001","action":"admin.status","details":{},"created_at":"2026-11-02T09:00:00Z"}]}`. Details vary by action. Immutable events sorted by ascending numeric ID; continue using the last ID, no next token. Used to trace admin and domain actions, not to execute/replay them.

## Dashboard and exports

Source: [adminops](../internal/adminops/service.go), [account exports](../internal/adminops/account_exports.go).

### `GET /v1/admin/dashboard`

**Access:** super/regular. **Request:** optional `from`, `to` as YYYY-MM-DD; UTC date boundaries, inclusive `to`; default 30-day window ending today UTC. Effective exclusive end must be after start and span at most 93 days. No body/pagination.

**200:** raw object with `period: {from,to_exclusive}`, `users`, `riders_awaiting_review`, `vendors_awaiting_review`, `active_assignments`, `shipments`, `marketplace_orders`, `rides`, `open_support_tickets`, `withdrawals_awaiting_approval`, `checkout_jobs_requiring_review`, `payments_requiring_review`, `withdrawals_requiring_review`, `dead_business_events`, `pending_signup_coupons`, `dead_signup_coupons`, `pending_signup_coupon_notices`, `dead_signup_coupon_notices`, and `financials: {currency,wallet_liability_minor,escrow_liability_minor,revenue_minor}`.

Order creation counts and revenue use the requested window; queue counts, active users, assignments and wallet/escrow liabilities are current snapshot metrics. Do not label every field as a period total.

### `GET /v1/admin/reports/accounts`

**Access:** super/regular. **Request:** required `type=users|riders`; optional `from`, `to` inclusive Lagos dates, `after`, `limit` (500/default, 1–2000). Default last 30 Lagos calendar days; maximum 366-day effective interval. No JSON body. `type=users` includes customer-capable riders. `status` must be absent/empty.

**200:** CSV attachment `accounts.csv`, columns `id,display_name,email,phone,avatar_asset_id,created_at,ridehailing,courier,express_shipping,customs_clearance`. Rows select account creation dates in range; service counts are lifetime counts for the selected identity (customer attribution for users, rider attribution for riders). `X-Report-Rows` gives included rows; `X-Next-Cursor` appears only when more exist. Cursor is opaque, actor/filter-bound. Each export page writes an audit event. No JSON response envelope.

### `GET /v1/admin/reports/withdrawals`

**Access:** super/regular. **Request:** same Lagos date/paging rules as accounts export; no `type`. Optional status: requested/approved/submitting/pending/otp/succeeded/failed/reversed/cancelled. Selects withdrawal creation dates.

**200:** `withdrawals.csv`; columns `id,user_id,user_type,amount_minor,currency,bank_code,account_last_four,status,reference,provider_transfer_id,created_at`. No full bank account number. `X-Report-Rows`, optional `X-Next-Cursor`; ascending `(created_at,id)` continuation bound to actor/filters. Audits each export page.

### `GET /v1/admin/reports/riders`

**Access:** super/regular. **Request:** `format=csv|pdf|xlsx` (default csv), `limit` 1–2000/default 500, `after` last user ID (at most 160 bytes). Filters: `vehicle_type=bicycle|motorcycle|car`, `approval_status=pending|approved|rejected`, `account_status=active|disabled`, `online_status=true|false`, `assigned=true|false`. No date-window filter in this handler.

**200:** attachment `riders.<format>`, matching MIME type; `X-Report-Rows`, `X-Report-Truncated: true|false`, optional `X-Next-Cursor`. Returns primary-role riders in ID order. Includes identity/contact, account/application statuses, location/time, online state, assignment, wallet balance, vehicle and geographic origin fields. Online is derived from active/verified/approved account, valid coordinates, unexpired presence and location freshness under two minutes. Exports are audited. Each page is a separate file; it is not an asynchronous export-job API.

## Analytics

All six endpoints below require a **super admin**, use raw JSON 200 responses, reject unknown/repeated/empty query parameters and have no request body. Dates are YYYY-MM-DD in Africa/Lagos, years 1970–2100. Read [analytics details](adminanalytics.md) for full coverage definitions. Source: [query validation](../internal/adminanalytics/service.go), [response SQL](../internal/adminanalytics/queries.go).

### `GET /v1/admin/analytics/ride-counts`

**Request:** required `account_type=customer|rider`, `account_id`. **200:** `{account_id,account_type,ride_hailing,courier,express_shipping}` plus `customs_clearance` for customer reports. Lifetime all-status counts, including cancelled/uncompleted orders; marketplace excluded. Missing account yields zero counts. No pagination.

### `GET /v1/admin/analytics/rider-weekly-deliveries`

**Request:** `weeks` 1–52/default 8, `end_date` default today Lagos, `limit` 1–200/default 50, `after` rider ID. **200:** `{timezone,week_starts_on,start_date,end_date,count,limit,next_cursor,coverage,riders}`. Rider: `{rider_id,name,total_completed_deliveries,weeks:[{week_start,week_end,completed_deliveries}]}`. Includes zero-delivery riders. `next_cursor` is last rider ID or null. Coverage reports scanned completions and missing completion timestamps. Final week can be partial through end_date; week_end still labels Sunday.

### `GET /v1/admin/analytics/time-to-first-order`

**Request:** either `summary_only=true` alone; or `account_id` alone; or optional `limit` 1–200/default 50 and `after` user ID. `summary_only=false` is also accepted in ordinary mode. Cannot combine account selection with paging.

**200:** `{global_summary,users,page_summary,next_cursor}`; summary-only returns just `{global_summary}`. Unknown/closed selected account yields 404. User: `{user_id,name,created_at,first_order_at,time_to_first_order_days,status}`. Status: activated/no_orders/order_before_signup/invalid_created_at/invalid_order_created_at. Includes customer-capable riders. First order uses earliest creation across services regardless of order status. Each summary has `total_users,eligible_users,activated_users,no_order_users,invalid_users,activation_rate,average_time_to_first_order_days`; global also has `is_complete,computed_at`. Rate is a fraction, averages are fractional days, unavailable denominators yield null. Global values do not depend on page. `next_cursor` null ends.

### `GET /v1/admin/analytics/weekly-concentration`

**Request:** `top=10|20|50|100` default 10; `week_of` default today Lagos. **200:** `{timezone,week_starts_on,week_start,week_end,top,count,total_users,total_orders,top_users_orders,top_users_share_percent,users,coverage}`. Each user has rank, user_id, name, avatar_asset_id, total_orders, share_percent and service counts. Orders placed in the full Monday–Sunday week; all statuses, ride/courier/express/customs, excluding marketplace. Ranked count descending then ID ascending. This is a bounded top-N ranking, not a pageable list.

### `GET /v1/admin/analytics/weekly-overview`

**Request:** `weeks` 1–52/default 8, `end_date` default today Lagos. **200:** calendar metadata, `weeks:[{week_start,week_end,new_users,active_riders}]`, `coverage`. Active riders are distinct riders completing at least one supported order during the week; repeated completions do not inflate rider counts. Final week can be partial. Coverage distinguishes missing timestamp/rider evidence and clearance-only completions. No pagination.

### `GET /v1/admin/analytics/coupon-redemptions`

**Request:** required `start_date`, `end_date`; optional `as_of_date` default today Lagos. Cohort at most 366 inclusive days, cutoff cannot precede end_date. **200:** date/timezone metadata and `issued_coupons,redeemed_coupons,not_redeemed_by_cutoff_coupons,expired_unused_coupons,coupon_redemption_rate_percent,users_issued_coupons,users_redeemed_coupons,user_redemption_rate_percent,coverage`. Selects coupons by issuance date and measures redemption as of end-of-cutoff day. Empty cohorts yield null rates. Refunds do not remove historical redemption. No pagination.

## Configuration and mobile releases

### `PUT /v1/admin/config/{key}`

**Access:** super/regular, except signup bonus amount/budget require super. **Key required.** Replaces the selected configuration value, audits the key changed. **200:** `{"key":"<key>"}`; no pagination. The request is the JSON **value itself**, not `{value:...}`. Unknown configuration keys are invalid; value body at most 16 KiB within the community 32 KiB decoder.

| Key | Request value and validation | Effect |
|---|---|---|
| `mobile` | `{maintenance,minimum_version,latest_version,support_email?,head_office_address?}`; versions strict numeric X.Y.Z, minimum ≤ latest | Global mobile fallback. |
| `referrals` | `{"enabled":true,"campaign_id":"campaign-001"}` | Configure referrer reward campaign; enabled mode requires active, unexpired campaign. |
| `ten_seconds` | GameRules model in appendix | Configure game level, server timing, daily attempt limit and reward pool. Enabled pool campaigns must be active/unexpired. |
| `signup_bonus_minor` | Integer, e.g. `10000`; range 0–1000000 | Amount of future eligible signup cash bonuses. Does not retroactively pay old accounts. |
| `signup_bonus_budget_minor` | Integer, e.g. `10000000`; range 0–1000000000000 | Finite bonus funding budget; cannot fall below already spent amount. |

`GET /v1/config` is a public read of mobile, ten_seconds, referrals and signup_bonus_minor; it does not return the bonus budget or signup-coupon settings. Raw configuration values are decoded by key-specific code; do not assume unknown nested fields are rejected there as strictly as typed request bodies.

### `PUT /v1/admin/config/mobile/{app}/{platform}`

**Access:** super/regular. **Key required.** Path app: user/rider/vendor; platform: ios/android. Body: MobileReleaseConfig in appendix: maintenance, minimum_version, latest_version, support_email, head_office_address, active, force_update, app_name. This is a complete value replacement; send booleans explicitly. App name nonblank and at most 120 characters; support email ≤254 bytes, office address ≤500 bytes; version pair valid and ordered.

**200:** `{app,platform,...submitted-config}`. Controls independent application/platform release settings. `GET /v1/config/mobile?app=user&platform=android` is the public read, falling back to global mobile config if no target override exists. No pagination. Source: [mobile config](../internal/community/mobile_config.go).

## Coupons and signup jobs

All endpoints in this section require super/regular. Mutations require a key. Source: [campaigns](../internal/community/coupons.go), [status](../internal/community/game.go), [signup administration](../internal/community/signup_coupon_admin.go).

### `POST /v1/admin/coupons/campaigns`

Create a campaign with finite budget and issuance limits. Request example:

```json
{
  "name": "Welcome 10 percent",
  "scope": "all",
  "basis_points": 1000,
  "max_discount_minor": 50000,
  "budget_minor": 10000000,
  "max_issuances": 1000,
  "max_per_user": 1,
  "starts_at": "2026-11-02T00:00:00Z",
  "ends_at": "2026-12-02T00:00:00Z",
  "valid_for_hours": 24
}
```

Dates must be adapted to a future campaign. Scope: all/food/ecommerce/ride/shipping/courier. Basis points 1–10000 (1000 = 10%); positive max discount and budget up to 100000000000; max issuances 1–1000000; max per user 1–100. End must follow start and be in future. Optional valid_for_hours is 0/24/48; 0 uses campaign end, 24/48 caps expiry from issuance, never beyond campaign end. **200:** `{"id":"<campaign-id>"}`. No pagination.

### `POST /v1/admin/coupons/campaigns/{id}/status`

Request `{"active":false}` or true. **200:** `{"active":false}`. Pauses/resumes an existing campaign; does not erase issued coupons/redemption history or bypass expiry/eligibility/budget. Missing campaign 404. No pagination.

### `POST /v1/admin/coupons/grants`

Request `{"user_id":"customer-001","campaign_id":"campaign-001"}`. **200:** `{"id":"<coupon-id>"}` (this ID is the issued coupon, not campaign). Recipient must exist and be active/not closed. Campaign timing/activity, issuance count and per-user limits are rechecked. Writes audited durable issuance. No pagination.

### `GET /v1/admin/coupons/signup/settings`

No body/query. **200:** `{"enabled":true,"campaign_ids":["campaign-001"]}`. Reads the distinct automatic signup reward pool; not the cash signup bonus or game pool. No pagination.

### `PUT /v1/admin/coupons/signup/settings`

Request `{"enabled":true,"campaign_ids":["campaign-001"]}`. At most 100 distinct IDs, each nonblank/trimmed and ≤128 bytes; referenced campaigns must exist with valid_for_hours 24 or 48. Empty pool is allowed and waits for configuration/funding. **200:** same normalized settings object (`campaign_ids` becomes [] when nil). Does not bulk-issue immediately; durable workers process eligible jobs. No pagination.

### `GET /v1/admin/coupons/signup/jobs`

Request `status=pending|fulfilled|cancelled|dead` optional, `after` user ID, `limit` 1–100/default 50. **200:** `{"jobs":[<job-row-with-notices>],"next_cursor":"<user-id-or-empty>"}`. Each raw issuance job includes durable status/attempt/scheduling/error/source/coupon fields and `notices` array for its notification work. Full row fields are shown in the appendix. Sorted user ID ascending. Use for issuance versus notification troubleshooting; fulfilled issuance does not imply push delivery completed.

### `POST /v1/admin/coupons/signup/jobs/{user_id}/requeue`

Request `{"queue":"issuance"}` or waiting_notice/issued_notice. **200:** `{"user_id":"customer-001","queue":"issuance","status":"pending"}`. Requeues only matching dead work, resetting attempts/schedule/error. Recipient must still be verified, active and customer-capable; obsolete/used/expired notice work can conflict. It does not create a second signup entitlement. No pagination.

## Referral links

Super/regular for all three routes; keys required for mutations. Source: [generated links](../internal/community/extras.go).

### `POST /v1/admin/referrals/links`

Request `{"name":"November campaign","campaign_id":"campaign-001","max_claims":1000}`. campaign_id optional; trimmed name 1–100 characters and unique, max_claims 1–1000000. Linked campaign must be active/unexpired with issuance capacity. **200:** `{id,name,code,relative_url,landing_url,expires_in_days:30}`. Code begins `L-`; relative_url resolves through `/v1/referrals/links/{code}`, landing_url is `/r/{code}`. Creation is audited. No pagination.

### `GET /v1/admin/referrals/links`

Request optional `after`, `limit` 1–100/default 50. **200:** `{"links":[{id,name,code,campaign_id,active,max_claims,claimed_count,expires_at,created_at}]}`. ID ascending, continue using last id; no next token/total. Lists disabled/expired links as well, enabling campaign monitoring. Creating a link does not itself attribute a user or issue a coupon.

### `POST /v1/admin/referrals/links/{id}/status`

Request `{"active":false}`. **200:** `{"active":false}`. Audited enable/disable; does not extend expiration or reset claims. Missing ID 404. No pagination.

## Support and broadcasts

Source: [community HTTP](../internal/community/http.go), [support/history](../internal/community/service.go), [broadcasts](../internal/community/service.go).

### `GET /v1/admin/support/tickets`

**Access:** super/regular/customercare. **Request:** `after` activity-sequence cursor, `limit` 1–100/default 50. **200:** `{"tickets":[<ticket-with-latest-message>],"next_cursor":"<sequence-or-empty>"}`. Newest activity first. Rows include ticket ID, owner, subject/status, activity sequence/timestamps and latest message/sender fields. No status/search filter is registered here. Activity can reorder tickets between requests; refresh and deduplicate.

### `GET /v1/support/tickets/{id}/messages`

**Access:** ticket owner or super/regular/customercare. **Request:** `limit` 1–100/default 50; optional `after` to fetch older messages or `since` to fetch newer messages, never both. Cursors nonnegative decimal sequences. **200:** `{"messages":[<message>],"next_cursor":"<sequence-or-empty>"}`. Message includes id, ticket_id, sender_id, body, asset_id, sequence, created_at. Ordinary order newest first; since order ascending and next_cursor remains a watermark even when caught up. No mutation.

### `POST /v1/support/tickets/{id}/messages`

**Access:** owner or super/regular/customercare. **Key required.** Request `{"body":"We are reviewing your request.","asset_id":""}`. At least body or asset needed; body ≤4000 bytes, valid UTF-8/no NUL. Attachment must be a ready asset owned by sender. Ticket must be open. **200:** `{"id":"<message-id>"}`. Saves message, updates ticket activity and emits notification work. No pagination.

### `POST /v1/support/tickets/{id}/status`

**Access:** owner or super/regular/customercare. **Key required.** Request `{"status":"closed"}` or open. **200:** `{"status":"closed"}`. Closes/reopens ticket, advances activity and records audit. Closed tickets cannot accept messages until reopened. No pagination.

### `POST /v1/admin/notifications/broadcasts`

**Access:** super/regular. **Key required.** Request `{"audience":"customer","title":"Service update","body":"Delivery service is available."}`. Audience all/customer/rider/vendor/restaurant/ecommerce. Title/body are bounded nonempty text (160/4000 characters respectively). **200:** `{"id":"<broadcast-id>"}`. Queues fanout; workers page through active recipients and enqueue durable notifications/delivery jobs. Customer audience includes riders' customer capability; restaurant/ecommerce select matching vendor kind. Success means saved broadcast, not every push delivered. No broadcast status/list endpoint is registered here. No pagination on creation.

## Domestic geography and delivery tariffs

These configure Nigeria destination-based ecommerce delivery fees, separately from international shipping weight/zone tariffs. All admin routes require super/regular. Mutations require a key. Source: [geography](../internal/geography/service.go).

### `PUT /v1/admin/geography/states/{id}`

Request `{"name":"Lagos","active":true}`. Path slug matches `[a-z0-9][a-z0-9-]{0,119}`, name 1–100 bytes. **200:** `{"id":"lagos"}`. Upserts state, audited. No pagination.

### `PUT /v1/admin/geography/lgas/{id}`

Request `{"state_id":"lagos","name":"Ikeja","active":true}`. Slug rules as above; existing LGA cannot be moved to another state. **200:** `{"id":"ikeja"}`. Creates/updates LGA, audited; invalid reference/state conflict fails. No pagination.

### `GET /v1/admin/geography/tariffs`

No body/paging query. **200:** `{"tariffs":[{id,name,status,historical,created_at,...}]}`. Most recent 100 tariff rows by created_at descending; there is **no continuation**. Admin configuration overview, including drafts and retired records.

### `GET /v1/admin/geography/tariffs/{id}`

Path ID only. **200:** raw tariff row plus `rates:[{lga_id,fee_minor,active}]`, ordered LGA ID. Missing tariff 404. No pagination.

### `PUT /v1/admin/geography/tariffs/{id}`

Request `{"name":"November delivery fees","historical":false,"rates":[{"lga_id":"ikeja","fee_minor":150000,"active":true}]}`. Name 1–150 bytes; 1–2000 distinct LGA rates, fee 0–100000000000. **200:** `{"id":"delivery-2026-11"}`. Creates/replaces a draft's entire rates. Active/retired tariffs conflict. Historical flag is sticky once set. No pagination.

### `POST /v1/admin/geography/tariffs/{id}/publish`

Request `{"reviewed":true,"retire":false}`. Explicit reviewed=true required. **200:** `{"id":"delivery-2026-11","status":"active"}`; retire=true yields retired. Publishing requires draft with at least one active rate and retires the previously active domestic tariff. This is the activation step; uploading a draft alone does not affect quotes. Audited. No pagination.

Related authenticated reads: `GET /v1/geography/states` → `{states:[{id,name,country_code}]}`; `GET /v1/geography/states/{id}/lgas` → `{lgas:[{id,state_id,name,delivery_fee_minor,tariff_id,currency}]}`. Active catalogue only, no paging. Missing current fee can be null; do not substitute zero.

## Shipping catalogue and settings

All admin mutations/settings reads require super/regular and mutations require a key. See [shipping types](../internal/shipping/rates.go).

### `PUT /v1/admin/shipping/countries/{code}`

Request `{"name":"Nigeria","active":true}`; optional body code must match path. Uppercase two-character path code, name 1–100 bytes. **200:** `{code,name,active}`. Upserts enabled destination/origin catalogue entry. No pagination.

### `PUT /v1/admin/shipping/offices/{id}`

Request Office model: `{name,address,latitude_e7,longitude_e7,base_pickup_minor,per_km_minor,active}`; body id optional but must match path. E7 coordinates are integer degrees ×10,000,000. Name 1–100 bytes, address 1–500, ID 1–100. Nonnegative base up to 100000000000 and per-km fee up to 100000000. **200:** full Office including id. Changes current office catalogue/pickup pricing; booked office snapshots stay captured. No pagination.

### `PUT /v1/admin/shipping/tariffs/{id}`

Request Tariff model in appendix. Carrier/name required, direction export/import, cargo document/non_document. Contains zones with country codes and weight/amount bands. Body id optional/matching. **200:** full Tariff with status draft. Only drafts editable; replaces zones/rates completely. 1–100 zones; each 1–300 countries and 2–1000 rates. Unique zone numbers 1–100, each country appears in one zone; positive increasing weights ≤100000000 grams, positive nondecreasing prices ≤100000000000. Volumetric divisor 0–1000000000 mm³/gram. No pagination.

### `POST /v1/admin/shipping/tariffs/{id}/publish`

Request `{"reviewed":true,"retire":false}`. **200:** `{id,status:"active"}` or retired. Requires explicit review, valid populated draft and complete zone/rate mapping. Activating retires previous active tariff with the same carrier/direction/cargo combination. Retire=true disables selected version for new quoting. No pagination.

### `GET /v1/admin/shipping/settings`

No body/query. **200:** `{"max_batch_size":3}` (illustrative value). Reads maximum simultaneous shipping pickup assignments per rider. No pagination.

### `PUT /v1/admin/shipping/settings`

Request `{"max_batch_size":3}`, range 1–5. **200:** same settings object. Rejects reducing below any existing rider's batch size with 409. Writes audit; does not reassign shipments. No pagination.

### Shared shipping catalogue reads

| Endpoint | Request | 200 response / purpose |
|---|---|---|
| `GET /v1/shipping/countries` | Optional `include_inactive=true` for admin | `{countries:[Country]}`, names ordered. |
| `GET /v1/shipping/offices` | Optional include_inactive | `{offices:[Office]}`, names ordered. |
| `GET /v1/shipping/tariffs` | Optional include_inactive | `{tariffs:[<tariff-summary>]}`, newest first, bounded to 100; summaries are not zone/rate detail. |
| `GET /v1/shipping/tariffs/{id}` | Path ID | Full Tariff with zones/countries/rates. |

These are authenticated and have no cursor pagination. include_inactive uses the authenticated primary admin role in this read implementation; it is not the same narrower membership check used by admin mutations.

## Shipment operations

Admin commands require super/regular; all mutations below require an idempotency key. Except creating charges (201), success is raw JSON 200. Read/list access uses authenticated admin primary role; do not assume every shipment read has the same narrower membership rule as mutations. Source: [HTTP](../internal/shipping/http.go), [transitions](../internal/shipping/transitions.go), [customs](../internal/shipping/customs.go).

### `GET /v1/shipments`

Request optional `cursor`, `status`, `limit` default 30/max 100. Only omission defaults to 30; supplied noninteger, nonpositive or greater-than-100 limits are invalid. **200:** `{"shipments":[Shipment],"next_cursor":"<opaque>"}`; next_cursor omitted on final page. Admin sees all shipments. Status is an exact filter. Creation-time descending keyset paging. Use to build shipment queues.

### `GET /v1/shipments/{id}`

Path only. **200:** Shipment model including captured office, details, status/version, charges/due/paid summaries and clearance when present. Missing 404. No pagination. Read current version before versioned commands.

### `GET /v1/shipments/{id}/tracking`

Request optional nonnegative numeric `after` event version, `limit` default 30/range 1–100 (invalid supplied values rejected). **200:** `{shipment_id,tracking_code,status,version,events:[{version,kind,status,created_at}],next_after? ,location?}`. Events ascend by version; use `next_after` as the next `after` watermark. `next_after` is present whenever events were returned, even without another page. Location appears only during accepted/en_route_hq when a location exists, with sequence, E7 coordinates and recorded_at. This is not the signed `cursor` list format.

### `PUT /v1/shipments/{id}/customs`

Request `{expected_version,fulfillment,office_id,details}`; fulfillment clearance_only/pickup_delivery, complete Details replacement. **200:** Shipment. Owner or super/regular can edit customs intake only at customs_review and current version. Sender name/email/phone and a ready transport_document asset are needed; physical package/destination details can be enriched before assessment. Asset purposes package/transport_document/packing_list/invoice, at most 10. Referenced active country/office and asset access are checked. Changes version, audit and events; stale/frozen details return 409. No pagination.

### `POST /v1/admin/shipments/{id}/charges`

Request `{"amount_minor":500000,"reason":"Customs assessment","pickup_minor":0,"weight_grams":0}`. Positive amount ≤100000000000, reason 3–500 bytes, pickup 0–amount, weight 0–100000000 grams. **201:** Shipment mutation snapshot; refresh detail to retrieve authoritative charge/payment summaries, because mutation snapshots need not hydrate the charges collection.

Creates due charge and durable checkout job. Terminal/in_transit shipments conflict. Express pickup fee cannot be overwritten. Only first customs_review assessment can set pickup component; clearance_only requires zero pickup and becomes clearance_ready, while pickup_delivery requires complete physical details/office and becomes placed. Positive weight updates assessed weight. Aggregate charge limit enforced. No pagination.

### `POST /v1/admin/shipments/{id}/charges/{charge_id}/cash`

Request `{"reference":"cash-receipt-001","proof_asset_id":"asset-001"}`. Reference uses key-compatible format, evidence must be ready and owned by operator/customer. **200:** Shipment. Requires nonterminal shipment and a due matching charge; creates immutable receipt, funds shipping escrow and marks charge paid. Customer's claim alone is insufficient. No pagination.

### `POST /v1/shipments/{id}/accept`

Request `{"rider_id":"rider-001"}` for admin assignment. **200:** Shipment with assigned rider/status accepted. Only placed pickup_delivery shipments; rider must be active, verified, approved, distinct from customer and within shared assignment/batch constraints. Creates pickup proof metadata. Rider self-accept is the same route with rider-specific eligibility. No pagination.

### `POST /v1/shipments/{id}/receive-at-office`

Request `{}`. **200:** Shipment with status at_hq. Requires en_route_hq. Credits unpaid pickup earnings from escrow where applicable and releases this shipment's rider batch slot. Other batch members remain assigned. No pagination.

### `POST /v1/shipments/{id}/dispatch`

Request `{"carrier_reference":"CARRIER-001"}` (1–150 bytes). **200:** Shipment with status in_transit. Requires at_hq and zero due charges; captures carrier reference and creates delivery proof metadata. No pagination.

### `POST /v1/shipments/{id}/deliver`

Request `{"proof_id":"proof-001","code":"<delivery-code>"}`. **200:** Shipment with status delivered, freight settled. Requires in_transit, valid unexpired delivery proof and fully paid charges; settles remaining escrow into revenue. Proof failures return conflict/invalid_proof. No pagination.

### `POST /v1/shipments/{id}/cancel`

Request `{}`. **200:** Shipment with cancelled status. Admin cancellation allowed only from placed/accepted/customs_review/clearance_ready. Refunds applicable funded amounts according to ledger/discount rules, releases assignment, writes lifecycle events. Cannot use this to reverse a dispatched/delivered shipment. Owner cancellation is separately authorized by the same route. No pagination.

### `POST /v1/shipments/{id}/proofs/{kind}`

Super/regular or shipment owner. **Key required.** Body `{}`, kind pickup/delivery. **201:** `{id,kind,expires_at}`. Reissues proof metadata when pickup is accepted or delivery is in_transit; conflicts if proof issued in the preceding 60 seconds. Plaintext code is delivered through the authorized notification mechanism, not returned here. No pagination.

### `POST /v1/admin/shipments/{id}/complete-clearance`

Request `{"expected_version":3,"proof_asset_id":"asset-001","reference":"CLEARANCE-001"}`. **200:** Shipment delivered, freight_settled true, clearance evidence recorded. Only customs + clearance_only + clearance_ready at matching version. Due must be zero, paid must be positive, escrow must reconcile; ready PDF/JPEG/PNG/WebP evidence owned by operator/customer; trimmed reference 3–150 bytes. Settles paid clearance funds, audits evidence. Creates no rider assignment or delivery OTP. No pagination.

## Payments and reconciliation

All five `/v1/admin/payments` routes require super/regular. Success uses the contract envelope `{"data":...,"requestId":"..."}`. Source: [payment HTTP](../internal/payments/http.go), [jobs](../internal/payments/reconciliation_jobs.go), [receipts](../internal/payments/inbox_admin.go).

### `POST /v1/admin/payments/reconcile`

**Key required.** Request `{"from":"2026-11-01T00:00:00Z","to":"2026-11-02T00:00:00Z","maxPages":10}`. RFC3339 interval [from,to), positive and ≤31 days; to cannot exceed now by more than one minute. maxPages defaults to 10 if zero/omitted, otherwise 1–100. Unknown query parameters rejected.

**202 data:** `{jobId,jobType:"payment.reconcile",status:"pending",statusUrl:"/v1/operations/<jobId>",from,to}`. Queues provider discovery and verification; provider pages are 50 items and bounded by maxPages. Does not perform immediate bulk settlement in the request. Gateway must be enabled. No HTTP list pagination here; maxPages bounds background work.

### `GET /v1/admin/payments/reconciliations/{id}`

No body. **200 data:** `{jobId,jobType,status,from,to,pagesProcessed,pageLimitReached,itemsDiscovered,itemsCompleted,itemsQuarantined,failureCode,createdAt,updatedAt,finishedAt}`. Job status pending/running/completed/failed. Nullable failureCode/finishedAt. Poll this for detailed reconciliation counts; pageLimitReached means configured scan bound reached, not necessarily provider history exhausted. No pagination.

### `GET /v1/operations/{id}`

Super/regular through financial authorization. Only `op_reconcile_` IDs supported by the current app. No body/query. **200 envelope data:** `{jobId,jobType,status,result,error,createdAt,updatedAt}`. Maps pending/running/completed/failed to pending/processing/succeeded/failed. result contains reconciliation summary only on success; error contains a safe failure description only on failure, otherwise null. This is the statusUrl returned on intake; not a general status endpoint for every historical job type. No pagination.

### `GET /v1/admin/payments/webhook-receipts`

Request `status=pending|processing|completed|ignored|quarantined` default quarantined; `limit` 1–100/default 25, optional signed `cursor`. Unknown/repeated/empty query values rejected. **200 data:** `{items:[WebhookReceipt],nextCursor:null|"<signed-token>"}`. Newest received_at then ID descending, scoped expiring cursor; keep status unchanged. Receipt fields: id,event,reference,providerDomain,status,attempts,replayCount,errorCode,receivedAt,finishedAt,evidence. Evidence is stored bounded provider evidence, not the original full provider response. No page number/offset.

### `GET /v1/admin/payments/webhook-receipts/{id}`

Path ID, no body/query. **200 data:** WebhookReceipt. Inspects durable receipt and processing state before deciding whether replay is appropriate. Missing receipt 404. No pagination.

### `POST /v1/admin/payments/webhook-receipts/{id}/replay`

**Key required.** Request `{"reason":"Underlying reconciliation issue has been resolved"}`; trimmed 10–500 bytes, receipt ID length 64; at most five replays per receipt. **202 data:** `{jobId:<receipt-id>,status:"pending",replayCount:<integer>}`. Requeues quarantined evidence with audited reason after replay guards; cannot replay arbitrary successful/actively leased work. Does not grant a payment or skip verification; worker reruns idempotent processing. Poll receipt afterward. No pagination.

## Withdrawals and payouts

These admin actions are registered under `/v1/payouts`, not `/v1/admin/withdrawals`. Current legacy manual-admin routes in other adapters are not mounted by `app.NewWithS3Backend`. Source: [payout HTTP](../internal/payouts/http.go), [decisions](../internal/payouts/service.go), [recovery](../internal/payouts/withdrawal_recovery.go).

### `GET /v1/payouts/withdrawals`

Owner sees own; super/regular/customercare may read across accounts. Request `after`, `status`, `limit` default 30/max100 using fallback/clamping. **200:** raw array of safe Withdrawal objects: id,user_id,beneficiary_id,reference,amount_minor,currency,status,review_required,created_at,updated_at. Ascending ID, last id → after; no next token/total. Does not return full bank details.

### `GET /v1/payouts/withdrawals/{id}`

Same read authorization. Path only. **200:** one safe Withdrawal object. No pagination. Use current status/review_required to determine next action; inability to read can return 404.

### `POST /v1/payouts/withdrawals/{id}/approve`

Super/regular; no self-approval. **Key required**, no body required. **200:** `{id,status:"approved"}`. Only requested withdrawals; records approver and queues processing. Paystack-method approval requires transfers enabled. Approval is not proof that money has arrived. No pagination.

### `POST /v1/payouts/withdrawals/{id}/reject`

Super/regular. **Key required**, no body required. **200:** `{id,status:"cancelled"}`. Requested/eligible approved withdrawals only; refunds reserved escrow to wallet once, audits rejection. Manual-bank-transfer approved records require their assigned approver. The status is cancelled, not rejected. Cannot refund an unknown in-flight provider outcome through this route. No pagination.

### `POST /v1/payouts/withdrawals/{id}/cancel`

Owner or super/regular when acting for another user. **Key required**, no body required. **200:** `{id,status:"cancelled"}`. Cancels eligible requested/approved state and refunds escrow under decision rules. Manual-transfer approved cancellation has additional restrictions. No pagination.

### `POST /v1/payouts/withdrawals/{id}/reconcile`

Owner/read-authorized admin can invoke through withdrawal visibility. No body/key consumed by this handler. **200:** safe Withdrawal after provider verification. Requires configured provider, Paystack method and status submitting/pending/otp/succeeded. Verifies original reference; financial state applies idempotently from evidence. It does not create a new transfer or trust client outcome flags. No pagination.

### `POST /v1/payouts/withdrawals/{id}/finalize`

Super/regular. **Key required.** Request `{"otp":"<provider-otp>"}` of exactly six digits. **200:** refreshed safe Withdrawal after provider finalization, or original `{id,status:"otp"}` receipt on idempotent replay or provider uncertainty. A 200 response alone does not establish provider success. Requires enabled transfers, provider secret and an otp-state transfer with code and no active lease. Claims a durable lease before provider I/O. A timeout/uncertain result needs read/reconciliation; do not create another withdrawal. No pagination.

### `POST /v1/payouts/withdrawals/{id}/recover`

Super/regular, cannot recover own withdrawal. **Key required.** Request `{"reason":"Provider outage resolved; retry verification"}`, trimmed 10–500 bytes. **202:** `{id,status,review_required:false,recovery_queued:true}`. Only review-required Paystack submitting/pending/otp outcomes with expired/no lease; owner must remain active. Requeues bounded verification/recovery using original bank, amount and reference. Fifteen-minute cooldown, maximum three recovery cycles per 24-hour window. Does not refund or replace unknown transfer outcomes. No pagination.

### `POST /v1/payouts/banks/sync`

Super/regular; no body or key consumed. **200:** `{"synced":<count>}`. Fetches and validates provider bank catalogue then upserts PostgreSQL rows. Provider must be configured. `GET /v1/payouts/banks` is an authenticated no-body read returning raw `[{code,name}]`, active banks ordered by name and bounded to 1000; no pagination. Bank sync is an explicit external refresh, not a financial transfer.

## Ride and marketplace administration

These shared routes support admin operations without an `/admin` prefix. Mutation bodies use the appendix models, keys required unless explicitly stated. Success raw JSON 200. Super/regular perform pricing/catalogue writes and admin cancellations; super/regular/customercare can read ride/marketplace order history across users.

### `GET /v1/rides/fares`

Authenticated read, no body/query/pagination. **200:** raw active Fare array. Used to display current pricing by vehicle/class; does not expose inactive rows through a separate admin list.

### `PUT /v1/rides/fares`

Request Fare model. Vehicle bicycle/motorcycle/car; classes standard/discountexpress/express/premier/courier, default standard. **200:** `{vehicle_type,ride_class,version}`. Upserts current pricing and increments server version. Monetary base/per-km/per-minute/booking 0–100000000, minimum 1–100000000; commission 0–5000 BPS, route factor 10000–30000 BPS, speed 5–100 km/h, maximum distance 1–200 km, dispatch radius 1–50 km. Server computes quote prices; client does not dictate trip amounts. No pagination.

### `POST /v1/marketplace/categories`

Request `{name,kind,active,slug,image_asset_id}`. kind food/ecommerce; slug lowercase letters/digits/hyphens without leading/trailing/double hyphen, 1–100 bytes; name nonblank ≤100 bytes. Optional image must be ready image owned by admin. **200:** `{id}`. Creates category. No pagination.

### `PUT /v1/marketplace/categories/{id}`

Same request as creation. **200:** `{id}`. Updates existing name/active/slug/image while requiring same kind; does not move between kinds. Missing/mismatched category 404, duplicate slug conflict. No pagination. Related `GET /v1/marketplace/categories` returns the raw active category list, no cursor.

### `PUT /v1/marketplace/settings`

Request Marketplace Settings model (appendix). **200:** normalized settings object. Configures base/per-km food delivery pricing, commission, max radius, cash enablement, food/ecommerce service-charge BPS and delivery policies. Policies separate/service_charge, default separate; service_charge requires positive matching charge BPS. Monetary fees 0–100000000, commission/service charges 0–5000 BPS, radius 1–200 km. Saves audited configuration. Ecommerce destination delivery fees still use geography tariffs. No pagination.

### `GET /v1/marketplace/items`

Authenticated catalogue read. Optional kind, vendor_id, category_id, q (name search, ≤100 bytes), favorites=true, mine=true, radius_km (0–200, with latitude/longitude), limit 1–100/default30 and offset 0–10000. **200:** raw item array containing id, vendor_id, kind, name, description, category_id, asset_ids, version, active, vendor_name, vendor_hero_asset_id, vendor_open, coordinates, variants. Each variant includes id/name/attributes/assets/price_minor/stock/active. Results newest first, offset pagination. `mine=true` selects the caller's vendor ID, not an admin override across vendors; ordinary catalogue listing shows active items at approved active vendors.

### `GET /v1/marketplace/items/{id}`

Authenticated read; super/regular get the admin item visibility path, which can include inactive item/variant data for a qualifying active approved vendor. **200:** single catalogue item object with the fields above. Path ID only, no paging. Missing/nonvisible result 404.

### `POST /v1/marketplace/items`

Admin or owning eligible vendor; request ItemInput with vendor_id, category_id, name, description, asset_ids, variants, active, expected_version. **200:** item mutation result `{id,version}`. Creates item/variants after category/vendor/asset validation. Name ≤160 bytes, description ≤4000, up to 8 item assets, 1–50 variants; variant price positive ≤100000000000, initial stock 0–1000000000, unique names. Ready assets must meet ownership rules. No pagination.

### `PUT /v1/marketplace/items/{id}`

Same authorization/input; current expected_version required for existing item. **200:** `{id,version}`. Versioned catalogue replacement; stale version conflicts, vendor cannot be silently changed, variants/stock preserve transaction rules. Use stock endpoint for explicit inventory adjustment. No pagination.

### `DELETE /v1/marketplace/items/{id}`

Admin or owning vendor; no body, key required. **200:** `{id,active:false}`. Archives current item instead of deleting order history. No pagination.

### `POST /v1/marketplace/variants/{id}/stock`

Admin or owning vendor. Request `{"delta":5}` (negative to reduce). **200:** `{id,stock}`. Atomically adjusts stock, enforcing resulting 0–1000000000 balance. No pagination; retries retain key so stock is not changed twice.

### Shared order inspection and cancellation

| Endpoint | Request | 200 response / action |
|---|---|---|
| `GET /v1/rides/trips` | status optional, limit default30/max100, offset 0–10000 | Raw trip array, newest creation first. Includes service/class, actors, fare/commission/tips, route, lifecycle times, timeline. |
| `GET /v1/rides/trips/{id}` | Path only | Trip detail object; missing/inaccessible 404. |
| `GET /v1/rides/trips/{id}/timeline` | Optional numeric `after` timeline ID, limit default50/max100 | Raw timeline for readable trip, ascending ID; last ID continues. |
| `GET /v1/rides/trips/{id}/locations` | Numeric after history-row ID, limit default50/max100 | Raw history array with id, sequence, coordinates, recorded_at, ascending ID. |
| `POST /v1/rides/trips/{id}/cancel` | Key + TransitionInput (appendix), including reason | `{id,status:"cancelled"}`; allowed from searching/accepted/arrived, refunds applicable funding/collateral. Admin cannot use other rider-only actions as an unrestricted override. |
| `GET /v1/marketplace/orders` | status optional; current/history special filters or exact status; limit 1–100/default30, offset 0–10000 | Raw order array including captured pickup and pricing breakdown; newest creation first. |
| `GET /v1/marketplace/orders/{id}` | Path only | Full authorized order detail; no paging. |
| `GET /v1/marketplace/orders/{id}/locations` | Numeric after sequence, limit 1–100/default30 | Raw location array ordered sequence; only active tracking states expose history. |
| `POST /v1/marketplace/orders/{id}/cancel` | Key + `{reason,proof,cash_collected}`; reason used for cancellation | `{id,status:"cancelled",proof_id:""}`; admin can cancel before completed/cancelled/picked_up/arrived, applying refund/stock rules. No paging. |

Read-only GET requests above have no body. See exact large order response field lists in [ride source](../internal/rides/http.go) and [marketplace source](../internal/marketplace/orders.go); response objects are not wrapped in `{orders:...}`. An admin role does not grant customer/rider-only quote, accept, pickup or GPS actions automatically.

## Metrics

### `GET /metrics`

**Access:** super/regular. No body/query/pagination. **200:** `Content-Type: text/plain; version=0.0.4`, Prometheus-style metric lines. Includes HTTP request/error/in-flight counts, PostgreSQL connections/acquired connections, upload pending jobs/oldest age, pending ready tags/oldest tag age. Example `pnd_http_in_flight 1`. **403** for insufficient membership; **503** if upload metrics unavailable. Operational metrics, not revenue/analytics data. Counters are not a production-capacity guarantee.

## Request and response model appendix

The following Go declarations record exact JSON field names and primitive/nested types used above. Read `json:"..."` as the wire name; embedded structs flatten their fields. `time.Time` is an RFC3339 JSON timestamp, `int64` is an integer, `[]T` is an array, `*T` can be null, `omitempty` means the field may be omitted. These are field definitions, not promises that every combination passes domain validation. Do not send response-only fields to endpoints with smaller request types.


### Community configuration

Source: [internal/community/game.go](../internal/community/game.go).

```go
type MobileConfig struct {
	Maintenance       bool   `json:"maintenance"`
	MinimumVersion    string `json:"minimum_version"`
	LatestVersion     string `json:"latest_version"`
	SupportEmail      string `json:"support_email,omitempty"`
	HeadOfficeAddress string `json:"head_office_address,omitempty"`
}

type ReferralConfig struct {
	Enabled    bool   `json:"enabled"`
	CampaignID string `json:"campaign_id"`
}

type GameLevel struct {
	SpeedMultiplier float64 `json:"speed_multiplier"`
	ToleranceMS     int64   `json:"tolerance_ms"`
}

type GameRules struct {
	Enabled       bool                 `json:"enabled"`
	ActiveLevel   string               `json:"active_level"`
	Levels        map[string]GameLevel `json:"levels"`
	DailyAttempts int                  `json:"daily_attempts"`
	CampaignID    string               `json:"campaign_id"`
	CampaignIDs   []string             `json:"campaign_ids,omitempty"`
}

```

Source: [internal/community/mobile_config.go](../internal/community/mobile_config.go).

```go
type MobileReleaseConfig struct {
	MobileConfig
	Active      bool   `json:"active"`
	ForceUpdate bool   `json:"force_update"`
	AppName     string `json:"app_name"`
}

```


### Shipping catalogue and shipment response

Source: [internal/shipping/rates.go](../internal/shipping/rates.go).

```go
type Country struct {
	Code   string `json:"code"`
	Name   string `json:"name"`
	Active bool   `json:"active"`
}

type Office struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Address string `json:"address"`
	Point
	BasePickupMinor int64 `json:"base_pickup_minor"`
	PerKMMinor      int64 `json:"per_km_minor"`
	Active          bool  `json:"active"`
}

type OfficeSnapshot struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Address string `json:"address"`
	Point
	Source string `json:"source"`
}

type Rate struct {
	WeightGrams int64 `json:"weight_grams"`
	AmountMinor int64 `json:"amount_minor"`
}

type Zone struct {
	Number    int      `json:"number"`
	Name      string   `json:"name"`
	Countries []string `json:"countries"`
	Rates     []Rate   `json:"rates"`
}

type Tariff struct {
	ID                string `json:"id"`
	Name              string `json:"name"`
	Carrier           string `json:"carrier"`
	Direction         string `json:"direction"`
	Cargo             string `json:"cargo"`
	Status            string `json:"status"`
	Historical        bool   `json:"historical"`
	VolumetricDivisor int64  `json:"volumetric_divisor_mm3_per_gram"`
	Zones             []Zone `json:"zones"`
}

```

Source: [internal/shipping/service.go](../internal/shipping/service.go).

```go
type Contact struct {
	Name       string `json:"name"`
	Email      string `json:"email"`
	Phone      string `json:"phone"`
	Address    string `json:"address"`
	PostalCode string `json:"postal_code"`
}

type Point struct {
	LatitudeE7  int64 `json:"latitude_e7"`
	LongitudeE7 int64 `json:"longitude_e7"`
}

type Dimensions struct {
	LengthMM int64 `json:"length_mm"`
	WidthMM  int64 `json:"width_mm"`
	HeightMM int64 `json:"height_mm"`
}

type Asset struct {
	ID      string `json:"id"`
	Purpose string `json:"purpose"`
}

type Details struct {
	Sender             Contact    `json:"sender"`
	Receiver           Contact    `json:"receiver"`
	Description        string     `json:"description"`
	DeclaredValueMinor int64      `json:"declared_value_minor"`
	CountryCode        string     `json:"country_code"`
	WeightGrams        int64      `json:"weight_grams"`
	Dimensions         Dimensions `json:"dimensions"`
	Pickup             Point      `json:"pickup"`
	Assets             []Asset    `json:"assets"`
}

type Shipment struct {
	ID               string           `json:"id"`
	TrackingCode     string           `json:"tracking_code"`
	CustomerID       string           `json:"customer_id"`
	Kind             string           `json:"kind"`
	Mode             string           `json:"mode"`
	Fulfillment      string           `json:"fulfillment"`
	QuoteID          string           `json:"quote_id,omitempty"`
	OfficeID         string           `json:"office_id"`
	OfficeSnapshot   *OfficeSnapshot  `json:"office_snapshot"`
	Status           string           `json:"status"`
	RiderID          string           `json:"rider_id,omitempty"`
	Details          Details          `json:"details"`
	Currency         string           `json:"currency"`
	PickupMinor      int64            `json:"pickup_minor"`
	PickupPaid       bool             `json:"pickup_paid"`
	FreightSettled   bool             `json:"freight_settled"`
	PayLater         bool             `json:"pay_later"`
	Version          int64            `json:"version"`
	CarrierReference string           `json:"carrier_reference"`
	CreatedAt        time.Time        `json:"created_at"`
	UpdatedAt        time.Time        `json:"updated_at"`
	Proofs           []Proof          `json:"proofs"`
	Charges          []Charge         `json:"charges"`
	DueMinor         int64            `json:"due_minor"`
	PaidMinor        int64            `json:"paid_minor"`
	Clearance        *ClearanceRecord `json:"clearance,omitempty"`
}

type Charge struct {
	ID          string    `json:"id"`
	ShipmentID  string    `json:"shipment_id"`
	Reason      string    `json:"reason"`
	AmountMinor int64     `json:"amount_minor"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"created_at"`
}

type ClearanceRecord struct {
	ProofAssetID string    `json:"proof_asset_id"`
	Reference    string    `json:"reference"`
	CompletedAt  time.Time `json:"completed_at"`
}

```


### Shipping proof and tracking models

```go
type Proof struct {
	ID        string    `json:"id"`
	Kind      string    `json:"kind"`
	ExpiresAt time.Time `json:"expires_at"`
}

type Event struct {
	Version   int64     `json:"version"`
	Kind      string    `json:"kind"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
}

type Location struct {
	Sequence int64 `json:"sequence"`
	Point
	RecordedAt time.Time `json:"recorded_at"`
}

```

### Marketplace request models

Source: [internal/marketplace/catalogue.go](../internal/marketplace/catalogue.go).

```go
type VariantInput struct {
	AssetIDs     []string          `json:"asset_ids"`
	ID           string            `json:"id"`
	Name         string            `json:"name"`
	Attributes   map[string]string `json:"attributes"`
	PriceMinor   int64             `json:"price_minor"`
	InitialStock int64             `json:"initial_stock"`
	Active       bool              `json:"active"`
}

type ItemInput struct {
	VendorID        string         `json:"vendor_id"`
	CategoryID      string         `json:"category_id"`
	Name            string         `json:"name"`
	Description     string         `json:"description"`
	AssetIDs        []string       `json:"asset_ids"`
	Variants        []VariantInput `json:"variants"`
	Active          bool           `json:"active"`
	ExpectedVersion int64          `json:"expected_version"`
}

```

Source: [internal/marketplace/checkout.go](../internal/marketplace/checkout.go).

```go
type Settings struct {
	FoodServiceChargeBPS      int    `json:"food_service_charge_bps"`
	EcommerceServiceChargeBPS int    `json:"ecommerce_service_charge_bps"`
	FoodDeliveryPolicy        string `json:"food_delivery_policy"`
	EcommerceDeliveryPolicy   string `json:"ecommerce_delivery_policy"`
	DeliveryBaseMinor         int64  `json:"delivery_base_minor"`
	DeliveryPerKMMinor        int64  `json:"delivery_per_km_minor"`
	CommissionBPS             int    `json:"commission_bps"`
	MaxRadiusKM               int    `json:"max_radius_km"`
	CashEnabled               bool   `json:"cash_enabled"`
}

```


### Ride fare and transition input

Source: [internal/rides/service.go](../internal/rides/service.go).

```go
type Fare struct {
	RideClass        string `json:"ride_class"`
	VehicleType      string `json:"vehicle_type"`
	Active           bool   `json:"active"`
	BaseMinor        int64  `json:"base_minor"`
	PerKMMinor       int64  `json:"per_km_minor"`
	PerMinuteMinor   int64  `json:"per_minute_minor"`
	MinimumMinor     int64  `json:"minimum_minor"`
	BookingMinor     int64  `json:"booking_minor"`
	CommissionBPS    int    `json:"commission_bps"`
	RouteFactorBPS   int    `json:"route_factor_bps"`
	SpeedKMH         int    `json:"speed_kmh"`
	MaxDistanceKM    int    `json:"max_distance_km"`
	DispatchRadiusKM int    `json:"dispatch_radius_km"`
	CashEnabled      bool   `json:"cash_enabled"`
	Version          int64  `json:"version"`
}

```

Source: [internal/rides/trips.go](../internal/rides/trips.go).

```go
type TransitionInput struct {
	Proof         string `json:"proof"`
	CashCollected bool   `json:"cash_collected"`
	Reason        string `json:"reason"`
}

```

### Raw row responses

Application reads expose the stored profile row, rather than a public profile projection. Bank/document fields may contain sensitive data and should only appear in authorized review interfaces.

| Model | Fields |
|---|---|
| Rider application | user_id, status, vehicle_type, vehicle (object), bank (object), profile_asset_id, document_asset_ids (array), document_labels (object), reviewed_by (nullable), reviewed_at (nullable), rejection_reason, created_at, updated_at |
| Vendor application | user_id, kind (restaurant/ecommerce), status, name, description, address, latitude, longitude, profile_asset_id, hero_asset_id (nullable), document_asset_ids, document_labels, bank, is_open, opening_hours, registration_number, tax_number, reviewed_by, reviewed_at, rejection_reason, created_at, updated_at |
| Signup issuance job | user_id, source_event_id, status, attempts, available_at, waiting_notified, coupon_id (nullable), last_error_code, created_at, updated_at, notices (array) |
| Signup notice | user_id, kind (waiting/issued), notification_id, coupon_id (nullable), status (pending/sent/skipped/dead), attempts, available_at, last_error_code, created_at, updated_at |
| Support ticket | id, user_id, subject, status, created_at, updated_at, activity_sequence, latest_message (nullable) |
| latest_message | id, body, asset_id, sequence, created_at, sender: {id,display_name,role} |

Job statuses describe durable internal work; do not use error-code fields as user-facing messages. Raw-row response fields can grow with migrations; clients should tolerate additional response fields.

### JSON request examples for larger models

Shipping office (`PUT /v1/admin/shipping/offices/lagos-hq`):

```json
{
  "name": "Lagos HQ",
  "address": "Example office address",
  "latitude_e7": 65965000,
  "longitude_e7": 33423000,
  "base_pickup_minor": 100000,
  "per_km_minor": 20000,
  "active": true
}
```

Shipping tariff (`PUT /v1/admin/shipping/tariffs/export-doc-001`; referenced country must already exist):

```json
{
  "name": "Example document exports",
  "carrier": "example-carrier",
  "direction": "export",
  "cargo": "document",
  "historical": false,
  "volumetric_divisor_mm3_per_gram": 5000,
  "zones": [{
    "number": 1,
    "name": "Example zone",
    "countries": ["NG"],
    "rates": [
      {"weight_grams": 500, "amount_minor": 1000000},
      {"weight_grams": 1000, "amount_minor": 1800000}
    ]
  }]
}
```

Game configuration (`PUT /v1/admin/config/ten_seconds`):

```json
{
  "enabled": true,
  "active_level": "medium",
  "levels": {
    "easy": {"speed_multiplier": 1, "tolerance_ms": 500},
    "medium": {"speed_multiplier": 1.5, "tolerance_ms": 250},
    "hard": {"speed_multiplier": 2, "tolerance_ms": 100}
  },
  "daily_attempts": 3,
  "campaign_ids": ["campaign-001"]
}
```

Game requires exactly easy/medium/hard definitions, speed multiplier 0.1–10, tolerance 0–1000 ms, daily attempts 1–5. Use campaign_ids (max100 distinct trimmed IDs) or legacy campaign_id, never both. Enabled mode needs a reward pool. Game attempts snapshot timing/pool; editing configuration does not rewrite existing attempts.

## Runtime boundaries and integration notes

### Routes present in older adapters but not mounted by the current app

Do not build a current client against these simply because a source file or older OpenAPI document contains them:

- `/v1/admin/jobs`, detail/replay and legacy-coupon replay: legacy queue administration.
- `/v1/admin/withdrawals`, bank-details and mark-successful/manual decisions: legacy manual payout HTTP adapter.
- `/v1/admin/referrals/export.csv`, referral-code backfill and older referral administration adapters.
- `/v1/admin/analytics/backfills` and native admin-summary endpoints: older analytics adapter.
- `/v1/admin/riders/regions/backfill` and region job detail: separate migration adapter.
- `/v1/admin/shipments/{id}/assessment`: older shipping-command adapter; current charge route is `/charges`.
- `/v1/compat/admin/...`: compatibility registrations from older hybrid execution, not this app's current registration path.

A different older deployment can have a different surface. Treat `internal/app/app.go` and the matching deployed commit as authoritative for current integration. This reference does not authorize enabling Firebase dependencies or editing client repositories.

### Private files for review

For application/receipt evidence, use the authenticated upload APIs and current document access rules. In S3 mode, `GET /v1/uploads/{id}` reads metadata; `GET /v1/uploads/{id}/content` returns 307 to a short-lived signed download URL; `POST /v1/uploads/{id}/download` returns a signed download response. Never construct a permanent public URL for private KYC/bank/receipt documents. Full upload request/session contracts are in [uploads.md](uploads.md).

### Practical request example

The variables below must come from your chosen deployment/session. This example does not print or persist the token. Use a new operation key per intended action, retaining the original on retry.

```bash
curl --request POST "${BASE_URL}/v1/admin/riders/${RIDER_ID}/review" \
  --header "Authorization: Bearer ${ACCESS_TOKEN}" \
  --header 'Content-Type: application/json' \
  --header 'Accept: application/json' \
  --header 'Idempotency-Key: admin-rider-review-001' \
  --data '{"status":"approved","reason":""}'
```

Expected success: HTTP 200, `{"status":"approved"}`. Then GET the application again to display the current state. On 409, refresh the application and resolve its current status or missing approval conditions before issuing a new decision.

### Validation of this reference

This is documentation from route registration, handler decoding, service authorization, SQL result construction and migrations. It does not claim a deployed API smoke test, passing runtime/integration suite, production capacity or import reconciliation. No application code or runtime configuration is changed. For the detailed domain contracts also see [domains OpenAPI](../api/domains.yaml), [core OpenAPI](../api/openapi.yaml), [shipping OpenAPI](../api/shipping.yaml), [analytics](adminanalytics.md) and [endpoint parity](endpoint-parity.md). Where historical documentation differs, the current registered handler/service governs this reference.

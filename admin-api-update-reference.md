# Native admin API update: requests, responses and headers

Reviewed 2026-11-03 against commits `6628b84`, `85a314c`, `b7166e7` and `b7cb56d`, merged into the current checkout. Origin history was refreshed before this update. This document covers native dashboard writes, the new administrative read contracts, and updated session/mobile/report behavior. Examples use fabricated identifiers, timestamps and versions. Replace BASE_URL with the deployment API origin.

These routes are registered by the PostgreSQL operational runtime. They supersede earlier statements that dashboard role, release, coupon, funding and support endpoints were missing. Old standalone payloads are not compatible simply because a path has the same spelling.

## Contents

- [Shared headers and conventions](#shared-headers-and-conventions)
- [Authentication and current admin](#authentication-and-current-admin)
- [Mobile releases](#mobile-releases)
- [Admin role management](#admin-role-management)
- [Coupons and signup processing](#coupons-and-signup-processing)
- [Signup wallet bonus and funding](#signup-wallet-bonus-and-funding)
- [Support dashboard](#support-dashboard)
- [Account directory and exports](#account-directory-and-exports)
- [Admin rides and fee reads](#admin-rides-and-fee-reads)
- [Shipping and geography configuration reads](#shipping-and-geography-configuration-reads)
- [Audit feed](#audit-feed)
- [Analytics coverage and integration corrections](#analytics-coverage-and-integration-corrections)
- [Errors and deployment](#errors-and-deployment)

## Changes added on 3 November

Commit `b7cb56d` adds account directory/detail and JSON/CSV exports, admin ride list/detail, allowlisted fee reads, shipping/geography catalogue reads, audit metadata and a mobile editor read that works even when public configuration is missing or invalid. It also adds analytics coverage inspection, checks reports against active PostgreSQL records after cutover, and preserves conversations with unavailable legacy media. These are mounted native reads; they do not add pricing, tariff or ride mutation endpoints.

## Shared headers and conventions

Authenticated GET headers:

```http
Authorization: Bearer <accessToken>
X-Account-Type: user
Accept: application/json
```

Authenticated mutation headers:

```http
Authorization: Bearer <accessToken>
X-Account-Type: user
Content-Type: application/json
Accept: application/json
Idempotency-Key: admin-operation-001
```

The endpoint entries below name these sets as **Read headers** and **Write headers**. Public login/challenge/mobile reads have their own stated headers. X-Account-Type must match the session: user for a user-context administrator, rider if the administrator actually signed in with rider context. Never use admin/super as the account type. Administrative subtype is server-owned membership.

The management API key is not needed by any dashboard endpoint in this reference. Never place the private ADMIN_MANAGEMENT_API_KEY in browser or mobile code.

All successful examples include the complete envelope:

```json
{"data": {}, "requestId": "example-request-id"}
```

Dashboard endpoints return HTTP 200 on success, including creation/requeue. CSV exports return file bodies instead of JSON. The Google challenge returns 201; analytics backfill intake returns 202. JSON field names are camelCase. Response headers include Content-Type application/json, Cache-Control no-store, X-Request-ID and X-Content-Type-Options nosniff. Request IDs correlate failures; tokens/codes in examples are placeholders.

### Roles

| Subtype | New dashboard permissions |
|---|---|
| super | Releases/editor, roles, coupons, funding, support, directory/exports, rides/configuration reads, audit and coverage/backfill |
| regular | Coupons, support, directory/exports, rides and shipping/geography/fee reads |
| customercare | Support |
| verifier | No access to these dashboard modules; session can still report subtype |

The backend checks current authority for each request and again inside privileged transactions. This table concerns this update, not every existing endpoint.

### Idempotency and version checks

- Every dashboard write needs exactly one Idempotency-Key, 8–128 ASCII letters, digits, periods, underscores, colons or hyphens. Use a fresh key per logical action and preserve key/body on uncertain retries.
- Dashboard keys are scoped to the administrator across these routes. Do not reuse a key for another route/body; it conflicts with 409.
- JSON mutation bodies are objects, at most 32 KiB; unknown fields, extra JSON values and query parameters are rejected.
- Read current version before a versioned write. Supply it as expectedVersion, not version. A stale version returns 409; reload and decide whether to submit a new command/key.
- Version 0 is appropriate only for an absent configuration or legacy record actually reporting version 0. Role writes require expectedVersion at least 1.
- Replay can return an old successful snapshot. GET again for current state. Writes commit owning data, audit/idempotency receipts and operational outbox together.

### Pagination

Paged dashboard reads use limit (default 25, range 1–100) and opaque cursor, except account/rider exports which allow up to 2000 records per page. Export default remains 25. Configuration/detail/editor reads have no paging. Responses contain data.items, data.nextCursor and data.hasMore. Keep filters unchanged and pass nextCursor as cursor; stop when hasMore is false and nextCursor is null. No page numbers or offset.

Cursors expire after one hour and bind actor/account context, route, filter and sort. Campaign/job/ride/fee pages sort ID ascending; SQL directory/configuration/audit reads sort their documented key ascending; support tickets sort updatedAt descending then ID descending; messages sort timestamp descending then ID descending. Admin ride lists are ID-ordered, not creation-time-ordered. Invalid/expired cursors return 400. Unknown/repeated/empty query values are rejected. GET requests have no body. Single-resource/configuration reads and writes have no pagination.

## Authentication and current admin

### `POST /v2/auth/login`

Existing password login, included here to establish the API-session flow.

**Access:** Public; successful credentials do not by themselves prove administrator membership. **Headers:** Content-Type: application/json; Accept: application/json.

**Request body:**

```json
{
  "accountType": "user",
  "email": "admin@example.com",
  "password": "<password>",
  "deviceId": "admin-browser-001",
  "deviceName": "Admin dashboard"
}
```

**Success: HTTP 200.**

```json
{
  "data": {
    "uid": "admin-uid",
    "accountType": "user",
    "sessionId": "example-session-id",
    "tokenType": "Bearer",
    "accessToken": "pnd_a2_<opaque-token>",
    "expiresIn": 900,
    "refreshToken": "pnd_r2_<opaque-token>",
    "refreshExpiresAt": "2026-12-02T21:30:00Z",
    "authTime": "2026-11-02T21:30:00Z",
    "isNewAccount": false,
    "provisioningStatus": "ready"
  },
  "requestId": "example-request-id"
}
```

No bearer or idempotency key required. Device ID/name are required; retain deviceId for refresh. This response omits subtype: call the session endpoint next. Native /v1/auth/login returns 410 auth_client_upgrade_required. Login body limit is 8 KiB; no query parameters.

### `GET /v2/auth/session`

Updated response identifies the currently signed-in administrator without a private operator key.

**Access:** Any valid API session. **Headers:** Read headers.

**Request:** No body or query parameters.

**Success: HTTP 200.**

```json
{
  "data": {
    "uid": "admin-uid",
    "accountType": "user",
    "sessionId": "example-session-id",
    "emailVerified": true,
    "accountStatus": "active",
    "provisioningStatus": "ready",
    "permissions": [
      "profile:read",
      "profile:update",
      "wallet:read"
    ],
    "tokenExpiresAt": "2026-11-02T21:45:00Z",
    "authTime": "2026-11-02T21:30:00Z",
    "isAdmin": true,
    "adminType": "super"
  },
  "requestId": "example-request-id"
}
```

isAdmin and adminType are now always present. Non-admin response has isAdmin false and adminType null. Subtypes: super, regular, customercare, verifier. Permissions do not enumerate all administrative rights. Role changes invalidate old sessions; 401 requires reauthentication rather than assuming the account is non-admin.

### `POST /v2/auth/social/challenges`

Start Google administrator sign-in by creating a device-bound nonce challenge.

**Access:** Public. **Headers:** Content-Type: application/json; Accept: application/json.

**Request body:**

```json
{
  "provider": "google",
  "deviceId": "admin-browser-001"
}
```

**Success: HTTP 201.**

```json
{
  "data": {
    "challengeId": "example-challenge-id",
    "nonce": "example-nonce",
    "expiresAt": "2026-11-02T21:35:00Z"
  },
  "requestId": "example-request-id"
}
```

Pass the returned nonce to Google sign-in and obtain a Google ID token. The dashboard OAuth audience must be configured in GOOGLE_CLIENT_IDS. No admin membership is granted by creating a challenge.

### `POST /v2/auth/admin/google`

New Google login dedicated to existing native administrator identities.

**Access:** Public intake; existing Google-linked, active, verified administrator required. **Headers:** Content-Type: application/json; Accept: application/json; Idempotency-Key: admin-google-login-001.

**Request body:**

```json
{
  "challengeId": "example-challenge-id",
  "idToken": "<google-id-token>",
  "deviceId": "admin-browser-001",
  "deviceName": "Admin dashboard"
}
```

**Success: HTTP 200.**

```json
{
  "data": {
    "uid": "admin-uid",
    "accountType": "user",
    "sessionId": "example-session-id",
    "tokenType": "Bearer",
    "accessToken": "pnd_a2_<opaque-token>",
    "expiresIn": 900,
    "refreshToken": "pnd_r2_<opaque-token>",
    "refreshExpiresAt": "2026-12-02T21:30:00Z",
    "authTime": "2026-11-02T21:30:00Z",
    "isNewAccount": false,
    "provisioningStatus": "ready",
    "isAdmin": true,
    "adminType": "super"
  },
  "requestId": "example-request-id"
}
```

No bearer or private management key. Checks token signature/audience, nonce, challenge expiry, device binding and current role. accountType is user; isNewAccount false. Non-admin 403; invalid/unknown link or disabled identity 401. Matching email alone never auto-links an account. Reuse exact challenge/body/key on uncertain retry; new login attempts need a fresh challenge/key. Usual refresh/logout endpoints apply.

### `POST /v2/auth/refresh`

Rotate access and refresh credentials for the same installation.

**Access:** Valid refresh credential. **Headers:** Content-Type: application/json; Accept: application/json; Idempotency-Key: admin-refresh-001.

**Request body:**

```json
{
  "refreshToken": "pnd_r2_<opaque-token>",
  "deviceId": "admin-browser-001"
}
```

**Success: HTTP 200.**

```json
{
  "data": {
    "uid": "admin-uid",
    "accountType": "user",
    "sessionId": "example-session-id",
    "tokenType": "Bearer",
    "accessToken": "pnd_a2_<opaque-token>",
    "expiresIn": 900,
    "refreshToken": "pnd_r2_<opaque-token>",
    "refreshExpiresAt": "2026-12-02T21:30:00Z",
    "authTime": "2026-11-02T21:30:00Z",
    "isNewAccount": false,
    "provisioningStatus": "ready"
  },
  "requestId": "example-request-id"
}
```

No bearer required. Save the returned token pair. Refresh has replay/token-reuse protections; keep the original device ID. Read session again to display current membership.

### `POST /v2/auth/logout`

Revoke this API session or all sessions.

**Access:** Authenticated API session. **Headers:** Write headers.

**Request body:**

```json
{
  "revokeAllSessions": false
}
```

**Success: HTTP 200.**

```json
{
  "data": {
    "signedOut": true,
    "sessionsRevoked": true
  },
  "requestId": "example-request-id"
}
```

Send true for revokeAllSessions to revoke all sessions. A revoked access token must no longer authorize protected requests.

## Mobile releases

### `GET /v1/admin/config/mobile/{app}/{platform}`

New super-only editor read. Use Read headers, no body/query/key. app is user or rider; platform android or ios. Example: GET /v1/admin/config/mobile/rider/ios. This is independent of the public endpoint's requirement for a fully valid published configuration.

**HTTP 200 when missing:**

```json
{
  "data": {
    "app": "rider",
    "platform": "ios",
    "configured": false,
    "version": 0,
    "configuration": null,
    "reason": "missing"
  },
  "requestId": "example-request-id"
}
```

An existing invalid record returns configured false, its actual version, configuration null and reason invalid. A valid record returns configured true, its version, reason null and configuration containing the complete public Mobile release object shown below. Use this returned version for the existing PUT expectedVersion; create/repair using reviewed release values. A missing record returns 200 here, while the public GET can still return 503. No default store IDs/releases are seeded.


### `GET /v1/config/mobile`

Updated public release read now accepts rider as well as user, for Android and iOS.

**Access:** Public. **Headers:** Accept: application/json.

**Request:** Required app=user|rider and platform=android|ios; no body.

**Success: HTTP 200.**

```json
{
  "data": {
    "app": "rider",
    "platform": "android",
    "latestVersion": "1.4.6",
    "minimumSupportedVersion": "1.4.5",
    "forceUpdate": false,
    "storeUrl": "https://play.google.com/store/apps/details?id=com.example.rider",
    "maintenance": {
      "enabled": false,
      "message": null
    },
    "features": {
      "rides": true,
      "courier": true,
      "food": false,
      "ecommerce": false,
      "internationalShipping": true,
      "localShipping": true,
      "customsClearance": true,
      "game": false
    },
    "version": 2,
    "updatedAt": "2026-11-02T21:30:00Z"
  },
  "requestId": "example-request-id"
}
```

Example URL: /v1/config/mobile?app=rider&platform=android. Returns version for the next write. Missing/invalid release configuration fails closed; no fabricated store URL or version fallback. iOS storeUrl must identify an apps.apple.com app; Android uses play.google.com/store/apps/details with app id.

### `PUT /v1/admin/config/mobile/{app}/{platform}`

Create or replace one app/platform release configuration.

**Access:** super. **Headers:** Write headers.

**Request body:**

```json
{
  "app": "rider",
  "platform": "android",
  "latestVersion": "1.4.6",
  "minimumSupportedVersion": "1.4.5",
  "forceUpdate": false,
  "storeUrl": "https://play.google.com/store/apps/details?id=com.example.rider",
  "maintenance": {
    "enabled": false,
    "message": null
  },
  "features": {
    "rides": true,
    "courier": true,
    "food": false,
    "ecommerce": false,
    "internationalShipping": true,
    "localShipping": true,
    "customsClearance": true,
    "game": false
  },
  "expectedVersion": 1
}
```

**Success: HTTP 200.**

```json
{
  "data": {
    "app": "rider",
    "platform": "android",
    "latestVersion": "1.4.6",
    "minimumSupportedVersion": "1.4.5",
    "forceUpdate": false,
    "storeUrl": "https://play.google.com/store/apps/details?id=com.example.rider",
    "maintenance": {
      "enabled": false,
      "message": null
    },
    "features": {
      "rides": true,
      "courier": true,
      "food": false,
      "ecommerce": false,
      "internationalShipping": true,
      "localShipping": true,
      "customsClearance": true,
      "game": false
    },
    "version": 2,
    "updatedAt": "2026-11-02T21:30:00Z"
  },
  "requestId": "example-request-id"
}
```

Path app=user|rider, platform=android|ios; example /v1/admin/config/mobile/rider/android. Body app/platform may be omitted on this path; if supplied they must match. Required expectedVersion, forceUpdate, maintenance and all eight features. Strict numeric major.minor.patch, minimum ≤ latest; enabled maintenance requires a nonblank message. Features advertise policy, not proof the associated service is implemented. Response is the shared public release model with incremented version; no snake_case/app_name/support_email fields. This stores release policy, not an app binary.

### `PUT /v1/admin/config/mobile`

Alternative route for the same release write, with target in JSON.

**Access:** super. **Headers:** Write headers.

**Request body:**

```json
{
  "app": "rider",
  "platform": "android",
  "latestVersion": "1.4.6",
  "minimumSupportedVersion": "1.4.5",
  "forceUpdate": false,
  "storeUrl": "https://play.google.com/store/apps/details?id=com.example.rider",
  "maintenance": {
    "enabled": false,
    "message": null
  },
  "features": {
    "rides": true,
    "courier": true,
    "food": false,
    "ecommerce": false,
    "internationalShipping": true,
    "localShipping": true,
    "customsClearance": true,
    "game": false
  },
  "expectedVersion": 1
}
```

**Success: HTTP 200.**

```json
{
  "data": {
    "app": "rider",
    "platform": "android",
    "latestVersion": "1.4.6",
    "minimumSupportedVersion": "1.4.5",
    "forceUpdate": false,
    "storeUrl": "https://play.google.com/store/apps/details?id=com.example.rider",
    "maintenance": {
      "enabled": false,
      "message": null
    },
    "features": {
      "rides": true,
      "courier": true,
      "food": false,
      "ecommerce": false,
      "internationalShipping": true,
      "localShipping": true,
      "customsClearance": true,
      "game": false
    },
    "version": 2,
    "updatedAt": "2026-11-02T21:30:00Z"
  },
  "requestId": "example-request-id"
}
```

app and platform are required in this body. Same validation, versioning and result as the path-targeted route. These two endpoints update the same native record, not separate global/target settings.

## Admin role management

### `GET /v1/admin/users/{id}/role`

Read the target native identity membership and credential version.

**Access:** super. **Headers:** Read headers.

**Request:** No body or query parameters.

**Success: HTTP 200.**

```json
{
  "data": {
    "uid": "target-uid",
    "email": "person@example.com",
    "isAdmin": true,
    "adminType": "regular",
    "version": 4
  },
  "requestId": "example-request-id"
}
```

id is native UID, not an internal wallet/SQL actor ID. A non-admin returns isAdmin false, adminType null. Target not found returns 404. For your own subtype, use /v2/auth/session, accessible without super membership.

### `POST /v1/admin/users/{id}/role`

Grant/change any supported admin subtype or remove membership.

**Access:** super. **Headers:** Write headers.

**Request body:**

```json
{
  "adminType": "regular",
  "expectedVersion": 3,
  "reason": "Assign operational dashboard responsibility"
}
```

**Success: HTTP 200.**

```json
{
  "data": {
    "uid": "target-uid",
    "email": "person@example.com",
    "isAdmin": true,
    "adminType": "regular",
    "version": 4
  },
  "requestId": "example-request-id"
}
```

adminType must be explicitly supplied as super, regular, customercare, verifier, or null. reason must be nonblank, at most 500 characters under database validation. Promotion requires existing enabled verified identity; does not create an account. Actual role changes increment credential version, update mirror and invalidate target sessions. GET the target first. To remove access send adminType null with current expectedVersion and a new key. This browser contract does not use the private management API key.

## Coupons and signup processing

### `POST /v1/admin/coupons/campaigns`

Create a native coupon template used for grants or signup rewards.

**Access:** super or regular. **Headers:** Write headers.

**Request body:**

```json
{
  "title": "Welcome discount",
  "percentageDiscount": 10,
  "validForHours": 24,
  "eligibleServices": [
    "courier",
    "local"
  ],
  "enabled": true
}
```

**Success: HTTP 200.**

```json
{
  "data": {
    "id": "campaign-001",
    "title": "Welcome discount",
    "percentageDiscount": 10,
    "validForHours": 24,
    "eligibleServices": [
      "courier",
      "local"
    ],
    "enabled": true,
    "version": 1
  },
  "requestId": "example-request-id"
}
```

Nonblank title ≤200 bytes; integer percentageDiscount 1–100, validForHours 24 or 48; enabled explicit boolean. Services are courier, express, local, ridehailing. Food/ecommerce are rejected. This native template contract does not accept the old standalone name/basis_points/budget_minor fields. Creation returns HTTP 200, not 201.

### `GET /v1/admin/coupons/campaigns`

List existing native coupon templates.

**Access:** super or regular. **Headers:** Read headers.

**Request:** Optional limit=25 and cursor=<opaque>; no body.

**Success: HTTP 200.**

```json
{
  "data": {
    "items": [
      {
        "id": "campaign-001",
        "title": "Welcome discount",
        "percentageDiscount": 10,
        "validForHours": 24,
        "eligibleServices": [
          "courier",
          "local"
        ],
        "enabled": true,
        "version": 1
      }
    ],
    "nextCursor": null,
    "hasMore": false
  },
  "requestId": "example-request-id"
}
```

ID-ascending pagination; includes template enabled state and version for status updates.

### `POST /v1/admin/coupons/campaigns/{id}/status`

Enable/disable future issuance from one template.

**Access:** super or regular. **Headers:** Write headers.

**Request body:**

```json
{
  "enabled": false,
  "expectedVersion": 1
}
```

**Success: HTTP 200.**

```json
{
  "data": {
    "id": "campaign-001",
    "title": "Welcome discount",
    "percentageDiscount": 10,
    "validForHours": 24,
    "eligibleServices": [
      "courier",
      "local"
    ],
    "enabled": false,
    "version": 2
  },
  "requestId": "example-request-id"
}
```

Changes future issuance; does not revoke existing issued coupons. Send enabled, not active. Stale version conflicts.

### `POST /v1/admin/coupons/grants`

Issue one coupon to an active customer using an enabled campaign.

**Access:** super or regular. **Headers:** Write headers.

**Request body:**

```json
{
  "uid": "customer-uid",
  "campaignId": "campaign-001"
}
```

**Success: HTTP 200.**

```json
{
  "data": {
    "id": "admin-example-coupon-id",
    "uid": "customer-uid",
    "code": "A1B2C3D4E5F60718293A4B5C",
    "expiresAt": "2026-11-03T21:30:00Z",
    "campaignId": "campaign-001"
  },
  "requestId": "example-request-id"
}
```

Response code is the redeemable code; id is the issued coupon ID. Terms snapshot at issuance. Customer reads use mounted /v1/coupons and /v1/coupons/by-code/{code}. Grant does not promise push delivery. Retrying the original key does not generate a second coupon. Send uid/campaignId, not user_id/campaign_id.

### `GET /v1/admin/coupons/signup/settings`

Read automatic signup issuance selection and version.

**Access:** super or regular. **Headers:** Read headers.

**Request:** No body or query parameters.

**Success: HTTP 200.**

```json
{
  "data": {
    "enabled": true,
    "campaignIds": [
      "campaign-001"
    ],
    "selection": "selected",
    "version": 2
  },
  "requestId": "example-request-id"
}
```

Legacy settings may return selection all_eligible with campaignIds []; after configuring this API, selection is selected. These are signup coupon settings, separate from wallet bonuses and game rewards.

### `PUT /v1/admin/coupons/signup/settings`

Configure automatic signup reward templates.

**Access:** super or regular. **Headers:** Write headers.

**Request body:**

```json
{
  "enabled": true,
  "campaignIds": [
    "campaign-001"
  ],
  "expectedVersion": 1
}
```

**Success: HTTP 200.**

```json
{
  "data": {
    "enabled": true,
    "campaignIds": [
      "campaign-001"
    ],
    "selection": "selected",
    "version": 2
  },
  "requestId": "example-request-id"
}
```

Explicit enabled and campaignIds array required. At most 100 distinct valid IDs; enabling requires at least one. IDs must reference expiring 24/48-hour templates. Worker ignores disabled templates. Preserves original-registration eligibility and one-time signup issuance; historical imports are not new signup eligibility.

### `GET /v1/admin/coupons/signup/jobs`

Inspect native issuance and signup-notification processing.

**Access:** super or regular. **Headers:** Read headers.

**Request:** Optional status=pending|processing|retry_wait|done|dead, limit, cursor; no body.

**Success: HTTP 200.**

```json
{
  "data": {
    "items": [
      {
        "id": "signup-job-001",
        "uid": "customer-uid",
        "jobType": "user.signup-coupon.issue",
        "status": "dead",
        "generation": 1,
        "attemptCount": 5,
        "availableAt": "2026-11-02T21:30:00Z",
        "updatedAt": "2026-11-02T21:30:00Z",
        "lastError": "operation_failed"
      }
    ],
    "nextCursor": null,
    "hasMore": false
  },
  "requestId": "example-request-id"
}
```

ID-ascending paging. jobType is user.signup-coupon.issue or notification.signup-coupon.send. lastError is sanitized and may be null. Use returned id/generation to replay. This list does not establish that every archived legacy queue was migrated.

### `POST /v1/admin/coupons/signup/jobs/{user_id}/requeue`

Replay a specific dead signup issuance/notification job for the selected customer.

**Access:** super or regular. **Headers:** Write headers.

**Request body:**

```json
{
  "jobId": "signup-job-001",
  "expectedGeneration": 1,
  "reason": "Underlying provider issue has been resolved"
}
```

**Success: HTTP 200.**

```json
{
  "data": {
    "attemptCount": 5,
    "id": "signup-job-001",
    "status": "pending",
    "generation": 2,
    "replayCount": 1,
    "maxAttempts": 5,
    "replayedAt": "2026-11-02T21:30:00Z"
  },
  "requestId": "example-request-id"
}
```

Example replay counters are illustrative; use returned values. expectedGeneration ≥1; reason 5–500 bytes. The job must belong to this UID and an allowed signup jobType and be dead. Retains job ID, provenance, effect markers and attempt history; no new entitlement or live-lease replay. Native request uses jobId/generation, not the old queue selector. Result is HTTP 200.

## Signup wallet bonus and funding

### `GET /v1/admin/config/signup-bonus`

Read bonus configuration, total allowance, spending and remaining allowance.

**Access:** super. **Headers:** Read headers.

**Request:** No body or query parameters.

**Success: HTTP 200.**

```json
{
  "data": {
    "enabled": true,
    "amountMinor": 10000,
    "budgetMinor": 10000000,
    "spentMinor": 20000,
    "remainingMinor": 9980000,
    "currency": "NGN",
    "version": 2
  },
  "requestId": "example-request-id"
}
```

NGN integer kobo: amountMinor 10000 is ₦100; budgetMinor 10000000 is ₦100,000. Native admin read replaces the old assumption that GET /v1/config supplies this contract. Budget is promotional allowance, not evidence of money held at a bank.

### `PUT /v1/admin/config/signup-bonus`

Set full future-signup configuration and funding allowance.

**Access:** super. **Headers:** Write headers.

**Request body:**

```json
{
  "enabled": true,
  "amountMinor": 10000,
  "budgetMinor": 10000000,
  "expectedVersion": 1
}
```

**Success: HTTP 200.**

```json
{
  "data": {
    "enabled": true,
    "amountMinor": 10000,
    "budgetMinor": 10000000,
    "spentMinor": 20000,
    "remainingMinor": 9980000,
    "currency": "NGN",
    "version": 2
  },
  "requestId": "example-request-id"
}
```

All four fields required. amountMinor 0–100000000000; budgetMinor 0–100000000000000; cannot reduce budget below spentMinor. budgetMinor is a total, not an increment. remainingMinor is budget minus spent. Write increments configuration version.

### `PUT /v1/admin/config/signup_bonus_minor`

Update only the bonus amount, preserving enabled state and funding budget.

**Access:** super. **Headers:** Write headers.

**Request body:**

```json
{
  "value": 15000,
  "expectedVersion": 2
}
```

**Success: HTTP 200.**

```json
{
  "data": {
    "enabled": true,
    "amountMinor": 15000,
    "budgetMinor": 10000000,
    "spentMinor": 20000,
    "remainingMinor": 9980000,
    "currency": "NGN",
    "version": 3
  },
  "requestId": "example-request-id"
}
```

Body is an object with value and expectedVersion, not a bare integer. Read latest funding before update. This changes future configuration, not existing wallet balances or frozen pending signup amounts.

### `PUT /v1/admin/config/signup_bonus_budget_minor`

Update only the total promotional allowance.

**Access:** super. **Headers:** Write headers.

**Request body:**

```json
{
  "value": 20000000,
  "expectedVersion": 2
}
```

**Success: HTTP 200.**

```json
{
  "data": {
    "enabled": true,
    "amountMinor": 10000,
    "budgetMinor": 20000000,
    "spentMinor": 20000,
    "remainingMinor": 19980000,
    "currency": "NGN",
    "version": 3
  },
  "requestId": "example-request-id"
}
```

Body is an object, not a bare integer. Example is an independent update from version 2, not the next step after the preceding version-3 example. Cannot reduce below spent. Insufficient allowance leaves positive pending bonuses waiting with signup_budget_exhausted without consuming failure attempts; workers retry after funding is increased, within an hour.

The worker reserves funding, posts the balanced wallet ledger journal, stores the account-level effect and financial readiness in one SQL transaction. Concurrent signups cannot overspend the allowance and retries cannot credit or charge it twice. Frozen pending signup amounts still need allowance even after future configuration is disabled/changed. Historical captured accounts do not receive fresh bonuses. Migration 000098 initializes budget equal to historical spent, deliberately leaving zero allowance for new positive bonuses until a super admin funds it.

## Support dashboard

### `GET /v1/admin/support/tickets`

List customer tickets across accounts for authorized support staff.

**Access:** super, regular or customercare. **Headers:** Read headers.

**Request:** Optional status=open|closed, limit, cursor; no body.

**Success: HTTP 200.**

```json
{
  "data": {
    "items": [
      {
        "id": "ticket-001",
        "status": "open",
        "createdAt": "2026-11-02T21:30:00Z",
        "updatedAt": "2026-11-02T21:30:00Z",
        "lastMessage": "Please help with my delivery.",
        "lastSender": "user",
        "unreadCount": 1,
        "customerUid": "customer-uid",
        "version": 1,
        "assignedSupportUid": null
      }
    ],
    "nextCursor": null,
    "hasMore": false
  },
  "requestId": "example-request-id"
}
```

Newest updatedAt then ID descending. lastSender may be null; customerUid is the customer actor, not the operator. Verifier is forbidden. Ordinary customer ticket endpoints retain owner-only access.

### `GET /v1/admin/support/tickets/{id}`

Read full dashboard ticket metadata and current version.

**Access:** super, regular or customercare. **Headers:** Read headers.

**Request:** No body or query parameters.

**Success: HTTP 200.**

```json
{
  "data": {
    "id": "ticket-001",
    "status": "open",
    "createdAt": "2026-11-02T21:30:00Z",
    "updatedAt": "2026-11-02T21:30:00Z",
    "lastMessage": "Please help with my delivery.",
    "lastSender": "user",
    "unreadCount": 1,
    "customerUid": "customer-uid",
    "version": 1,
    "assignedSupportUid": null
  },
  "requestId": "example-request-id"
}
```

assignedSupportUid may be null. Read version before status/claim. A reply also increments ticket version, so reload after intervening messages.

### `GET /v1/admin/support/tickets/{id}/messages`

Read a customer ticket conversation as authorized support staff.

**Access:** super, regular or customercare. **Headers:** Read headers.

**Request:** Optional limit and cursor; no body.

**Success: HTTP 200.**

```json
{
  "data": {
    "items": [
      {
        "id": "message-001",
        "ticketId": "ticket-001",
        "senderRole": "support",
        "senderId": "admin-uid",
        "message": "We are reviewing your delivery.",
        "attachment": null,
        "createdAt": "2026-11-02T21:30:00Z",
        "clientMessageId": "reply-001"
      }
    ],
    "nextCursor": null,
    "hasMore": false
  },
  "requestId": "example-request-id"
}
```

Newest timestamp then ID descending. Attachment can be null or an object with assetId, contentType, downloadUrl, expiresAt. Claim the ticket before resolving historical/customer private attachment assets; generic admin status alone does not grant arbitrary attachment access.

### `POST /v1/admin/support/tickets/{id}/messages`

Post a support-authored text reply.

**Access:** super, regular or customercare. **Headers:** Write headers.

**Request body:**

```json
{
  "message": "We are reviewing your delivery.",
  "clientMessageId": "reply-001"
}
```

**Success: HTTP 200.**

```json
{
  "data": {
    "id": "message-001",
    "ticketId": "ticket-001",
    "senderRole": "support",
    "senderId": "admin-uid",
    "message": "We are reviewing your delivery.",
    "attachment": null,
    "createdAt": "2026-11-02T21:30:00Z",
    "clientMessageId": "reply-001"
  },
  "requestId": "example-request-id"
}
```

Nonblank valid UTF-8 message 1–4000 characters, no NUL. clientMessageId is a stable valid ID ≤128 bytes. Server sets senderRole/support and senderId; do not supply them. Idempotency key plus clientMessageId deduplicate replies. Closed tickets reject new replies. Updates ticket preview/version and enqueues durable SupportInbox refresh. Does not accept reply attachment uploads.

### `PUT /v1/admin/support/tickets/{id}/status`

Close or reopen a ticket.

**Access:** super, regular or customercare. **Headers:** Write headers.

**Request body:**

```json
{
  "status": "closed",
  "expectedVersion": 1
}
```

**Success: HTTP 200.**

```json
{
  "data": {
    "id": "ticket-001",
    "status": "closed",
    "version": 2
  },
  "requestId": "example-request-id"
}
```

status must be open or closed. Use PUT, not the old standalone POST status route. Reload latest ticket version before writing. No new replies while closed.

### `POST /v1/admin/support/tickets/{id}/claim`

Assign the ticket to the authenticated support operator for scoped attachment access.

**Access:** super, regular or customercare. **Headers:** Write headers.

**Request body:**

```json
{
  "expectedVersion": 1
}
```

**Success: HTTP 200.**

```json
{
  "data": {
    "id": "ticket-001",
    "assignedSupportUid": "admin-uid",
    "version": 2
  },
  "requestId": "example-request-id"
}
```

No operator UID in the request; server derives it from session. Claiming updates version and membership; reassignment removes the previous operator’s ticket-specific media access. Resolve the message attachment.assetId through existing protected native media API. This does not grant unrelated bank/document/asset access.


### Updated historical attachment response

GET /v1/admin/support/tickets/{id}/messages now preserves a historical message whose only attachment reference is an unavailable legacy image URL. The message has attachment null and attachmentUnavailable true, rather than making the entire conversation fail:

```json
{
  "data": {
    "items": [{
      "id": "legacy-message-001",
      "ticketId": "ticket-001",
      "senderRole": "user",
      "senderId": "customer-uid",
      "message": "Please review this image.",
      "attachment": null,
      "attachmentUnavailable": true,
      "createdAt": "2026-11-02T21:30:00Z",
      "clientMessageId": "legacy-message-001"
    }],
    "nextCursor": null,
    "hasMore": false
  },
  "requestId": "example-request-id"
}
```

attachmentUnavailable is omitted when false. Show an unavailable-attachment placeholder; no archived/permanent URL is exposed and no media permissions are bypassed. Invalid sender/time or corrupt native asset metadata can still fail validation. Existing attachment claiming/resolution rules remain in force.


## Account directory and exports

### `GET /v1/admin/users`

New paginated native account directory.

**Access:** super or regular. **Headers:** Read headers (bearer token, matching X-Account-Type, Accept application/json). No body or Idempotency-Key.

**Request:** Optional type=users|riders (default users), limit=25 (1–100), cursor=<opaque>.

**Success: HTTP 200.**

```json
{
  "data": {
    "items": [
      {
        "id": "customer-001",
        "uid": "customer-001",
        "accountType": "user",
        "username": "Example Customer",
        "email": "customer@example.com",
        "phoneNumber": "+2348000000000",
        "identityExists": true,
        "emailVerified": true,
        "disabled": false,
        "deleted": false,
        "verificationStatus": null,
        "createdAt": "2026-11-03T07:00:00Z"
      }
    ],
    "nextCursor": null,
    "hasMore": false
  },
  "requestId": "example-request-id"
}
```

Send type=riders explicitly for the rider directory; accountType then reports rider. type=vendors/merchants is invalid. No standalone role/status/search/after filters are supported by this route. Sort is native document ID ascending. This route does not expose adminType: use the role reader for a selected identity.

### `GET /v1/admin/users/{id}`

Read one user/rider profile summary using its native UID.

**Access:** super or regular. **Headers:** Read headers (bearer token, matching X-Account-Type, Accept application/json). No body or Idempotency-Key.

**Request:** Optional type=users|riders, default users.

**Success: HTTP 200.**

```json
{
  "data": {
    "id": "customer-001",
    "uid": "customer-001",
    "accountType": "user",
    "username": "Example Customer",
    "email": "customer@example.com",
    "phoneNumber": "+2348000000000",
    "identityExists": true,
    "emailVerified": true,
    "disabled": false,
    "deleted": false,
    "verificationStatus": null,
    "createdAt": "2026-11-03T07:00:00Z"
  },
  "requestId": "example-request-id"
}
```

No limit/cursor on detail. A missing selected profile returns 404. Identity fields email/emailVerified/disabled may be null when a profile has no native identity, with identityExists false; do not invent credentials. username, phoneNumber, verificationStatus and createdAt may be null for missing or differently typed historical fields. deleted reports whether a joined identity has a deletion timestamp. No password/PIN hashes, bank fields, delivery codes or raw source documents are returned.

### `GET /v1/admin/reports/accounts`

Export one bounded directory page as JSON or CSV.

**Access:** super or regular. **Headers:** Read headers (bearer token, matching X-Account-Type, Accept application/json). No body or Idempotency-Key.

**Request:** Optional type=users|riders (default users), format=json|csv (default JSON), limit=25 (1–2000), cursor=<opaque>.

**Success: HTTP 200.**

```json
{
  "data": {
    "items": [
      {
        "id": "customer-001",
        "uid": "customer-001",
        "accountType": "user",
        "username": "Example Customer",
        "email": "customer@example.com",
        "phoneNumber": "+2348000000000",
        "identityExists": true,
        "emailVerified": true,
        "disabled": false,
        "deleted": false,
        "verificationStatus": null,
        "createdAt": "2026-11-03T07:00:00Z"
      }
    ],
    "nextCursor": null,
    "hasMore": false
  },
  "requestId": "example-request-id"
}
```

Uses the same allowlisted account fields and ID ordering as the directory. It is not the old standalone date-window/service-count report; no from/to filters. JSON exports use data.nextCursor. CSV behavior is documented below.

### `GET /v1/admin/reports/riders`

Export native rider profile summaries.

**Access:** super or regular. **Headers:** Read headers (bearer token, matching X-Account-Type, Accept application/json). No body or Idempotency-Key.

**Request:** Optional format=json|csv (default JSON), limit=25 (1–2000), cursor=<opaque>.

**Success: HTTP 200.**

```json
{
  "data": {
    "items": [
      {
        "id": "rider-001",
        "uid": "rider-001",
        "accountType": "rider",
        "username": "Example Rider",
        "email": "customer@example.com",
        "phoneNumber": "+2348000000000",
        "identityExists": true,
        "emailVerified": true,
        "disabled": false,
        "deleted": false,
        "verificationStatus": 1,
        "createdAt": "2026-11-03T07:00:00Z"
      }
    ],
    "nextCursor": null,
    "hasMore": false
  },
  "requestId": "example-request-id"
}
```

Selects Riders automatically; type is not an accepted query parameter here. No PDF/XLSX, vehicle/approval/presence filters or standalone wallet/vehicle export columns. Uses native rider records, not a new registration or approval workflow.

### CSV export request and response

Use the same Read headers; Accept text/csv is appropriate. Select the format explicitly:

```http
GET /v1/admin/reports/riders?format=csv&limit=2000
Authorization: Bearer <accessToken>
X-Account-Type: user
Accept: text/csv
```

HTTP 200 response headers:

```http
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="accounts.csv"
X-Next-Cursor: <opaque-next-page-token-if-more>
Cache-Control: no-store
X-Request-ID: <request-id>
```

The current implementation uses filename accounts.csv for both export routes. Body example:

```csv
uid,accountType,username,email,phoneNumber,identityExists,emailVerified,disabled,deleted
rider-001,rider,Example Rider,rider@example.com,'+2348000000000,true,true,false,false
```

Cells whose contents could be spreadsheet formulas are prefixed with an apostrophe, including the leading plus in the phone example above. Null fields become empty cells. Do not JSON-unwrap a file response. Follow X-Next-Cursor as cursor with the same route/format/filters. Absence of that header ends CSV pagination. There is no X-Report-Rows or X-Report-Truncated header in this native exporter. A 2000-row page is not necessarily the entire dataset; pages are separate snapshots.

The backend CORS middleware currently exposes X-Request-ID, Retry-After and X-Device-Generation, not X-Next-Cursor. A cross-origin browser must use a proxy that exposes/preserves the CSV cursor or another explicitly configured access path; same-origin/server clients can read the header normally. JSON pagination does not have this header limitation.

## Admin rides and fee reads

### `GET /v1/admin/rides`

New cross-account ride/courier collection read.

**Access:** super or regular. **Headers:** Read headers (bearer token, matching X-Account-Type, Accept application/json). No body or Idempotency-Key.

**Request:** Optional status=requested|accepted|onroute|completed|cancelled|expired|riderarrived, limit=25 (1–100), cursor=<opaque>.

**Success: HTTP 200.**

```json
{
  "data": {
    "items": [
      {
        "estimatedDistanceMeters": 4000,
        "estimatedDurationSeconds": 600,
        "vehicleType": "car",
        "ratingPromptShown": false,
        "canCancel": false,
        "cancellationReason": null,
        "completedAt": null,
        "cancelledAt": null,
        "tip": null,
        "id": "ride-001",
        "service": "ridehailing",
        "rideType": "standard",
        "status": "requested",
        "version": 1,
        "customerId": "customer-001",
        "assignedRider": null,
        "pickup": {
          "address": "Example pickup",
          "latitude": 6.5,
          "longitude": 3.3
        },
        "dropoff": {
          "address": "Example destination",
          "latitude": 6.6,
          "longitude": 3.4
        },
        "pricing": {
          "grossAmountMinor": 250000,
          "discountAmountMinor": 0,
          "totalAmountMinor": 250000,
          "currency": "NGN"
        },
        "payment": {
          "method": "wallet",
          "status": "paid",
          "transactionId": "transaction-001"
        },
        "trackingId": null,
        "createdAt": "2026-11-03T07:00:00Z"
      }
    ],
    "nextCursor": null,
    "hasMore": false
  },
  "requestId": "example-request-id"
}
```

ID ascending, including native courier history. /v1/rides/trips is not this collection: the native customer router can treat trips as a ride ID. /v1/rides remains scoped to its authenticated customer/rider. No type/search/offset filter on this admin list.

### `GET /v1/admin/rides/{id}`

Read the native administrative ride DTO, including route, pricing, payment and assignment.

**Access:** super or regular. **Headers:** Read headers (bearer token, matching X-Account-Type, Accept application/json). No body or Idempotency-Key.

**Request:** No query parameters.

**Success: HTTP 200.**

```json
{
  "data": {
    "estimatedDistanceMeters": 4000,
    "estimatedDurationSeconds": 600,
    "vehicleType": "car",
    "ratingPromptShown": false,
    "canCancel": false,
    "cancellationReason": null,
    "completedAt": null,
    "cancelledAt": null,
    "tip": null,
    "id": "ride-001",
    "service": "ridehailing",
    "rideType": "standard",
    "status": "requested",
    "version": 1,
    "customerId": "customer-001",
    "assignedRider": null,
    "pickup": {
      "address": "Example pickup",
      "latitude": 6.5,
      "longitude": 3.3
    },
    "dropoff": {
      "address": "Example destination",
      "latitude": 6.6,
      "longitude": 3.4
    },
    "pricing": {
      "grossAmountMinor": 250000,
      "discountAmountMinor": 0,
      "totalAmountMinor": 250000,
      "currency": "NGN"
    },
    "payment": {
      "method": "wallet",
      "status": "paid",
      "transactionId": "transaction-001"
    },
    "trackingId": null,
    "createdAt": "2026-11-03T07:00:00Z"
  },
  "requestId": "example-request-id"
}
```

The response explicitly sets canCancel false: this read grants no customer cancel capability and adds no admin ride writes. Imported snapshots can include readOnly true and sourceVersion; version does not transfer financial ownership. Optional receiver contains name/phone for applicable courier data. assignedRider, when present, contains id/name, nullable phone/avatarUrl/vehicle; vehicle has type and nullable make/model/color/plateNumber. Monetary pricing/tips use integer minor units. Private OTPs are not returned. Full DTO: internal/ridecommands/read.go and the native dashboard OpenAPI.

### `GET /v1/admin/shipping/settings`

Read allowlisted native Fees rows for the shipping settings view.

**Access:** super or regular. **Headers:** Read headers (bearer token, matching X-Account-Type, Accept application/json). No body or Idempotency-Key.

**Request:** Optional limit=25 (1–100), cursor=<opaque>.

**Success: HTTP 200.**

```json
{
  "data": {
    "items": [
      {
        "id": "pickup-fee",
        "name": "Example pickup fee",
        "currency": "NGN",
        "moneyUnit": "major",
        "feeType": 4,
        "value": 25.5,
        "perKm": null,
        "perMin": null,
        "perWeight": null,
        "minFare": null,
        "bookingFee": null,
        "surgeMultiplier": null,
        "addedSurge": null,
        "invalidFields": []
      }
    ],
    "nextCursor": null,
    "hasMore": false
  },
  "requestId": "example-request-id"
}
```

Both routes expose the same native Fees allowlist, ID ascending; the view selects relevant fee types. This is a page of fee records, not the old single shipping max_batch_size object or standalone Fare array. moneyUnit major means monetary components are NGN naira. Percentages/multipliers remain dimensionless; interpret value by feeType rather than multiplying every numeric field by 100. Missing numeric fields are null; invalidFields lists wrong-type/nonfinite fields. Read does not enable pricing writes or change quote calculation.

### `GET /v1/admin/rides/fares`

Read allowlisted native Fees rows for the ride fares view.

**Access:** super or regular. **Headers:** Read headers (bearer token, matching X-Account-Type, Accept application/json). No body or Idempotency-Key.

**Request:** Optional limit=25 (1–100), cursor=<opaque>.

**Success: HTTP 200.**

```json
{
  "data": {
    "items": [
      {
        "id": "pickup-fee",
        "name": "Example pickup fee",
        "currency": "NGN",
        "moneyUnit": "major",
        "feeType": 4,
        "value": 25.5,
        "perKm": null,
        "perMin": null,
        "perWeight": null,
        "minFare": null,
        "bookingFee": null,
        "surgeMultiplier": null,
        "addedSurge": null,
        "invalidFields": []
      }
    ],
    "nextCursor": null,
    "hasMore": false
  },
  "requestId": "example-request-id"
}
```

Both routes expose the same native Fees allowlist, ID ascending; the view selects relevant fee types. This is a page of fee records, not the old single shipping max_batch_size object or standalone Fare array. moneyUnit major means monetary components are NGN naira. Percentages/multipliers remain dimensionless; interpret value by feeType rather than multiplying every numeric field by 100. Missing numeric fields are null; invalidFields lists wrong-type/nonfinite fields. Read does not enable pricing writes or change quote calculation.

## Shipping and geography configuration reads

These endpoints are super/regular reads of current native configuration. Lists use cursor/limit, not after/offset. includeInactive is camelCase and accepts true/false; omit it to select active records. Detail reads include inactive records and accept no query parameters. None of these GET additions mounts the corresponding standalone PUT/publish operations.

### `GET /v1/admin/shipping/offices`

List shipping offices.

**Access:** super or regular. **Headers:** Read headers (bearer token, matching X-Account-Type, Accept application/json). No body or Idempotency-Key.

**Request:** Optional includeInactive=true|false, limit=25 (1–100), cursor=<opaque>.

**Success: HTTP 200.**

```json
{
  "data": {
    "items": [
      {
        "id": "lagos-office",
        "name": "Example Lagos office",
        "address": "Example office address",
        "latitude": 6.5,
        "longitude": 3.3,
        "basePickupMinor": 100000,
        "perKmMinor": 20000,
        "currency": "NGN",
        "active": true
      }
    ],
    "nextCursor": null,
    "hasMore": false
  },
  "requestId": "example-request-id"
}
```

Office coordinates are decimal degrees; basePickupMinor/perKmMinor are integer kobo.

### `GET /v1/admin/shipping/offices/{id}`

Read one shipping offices record.

**Access:** super or regular. **Headers:** Read headers (bearer token, matching X-Account-Type, Accept application/json). No body or Idempotency-Key.

**Request:** No query parameters.

**Success: HTTP 200.**

```json
{
  "data": {
    "id": "lagos-office",
    "name": "Example Lagos office",
    "address": "Example office address",
    "latitude": 6.5,
    "longitude": 3.3,
    "basePickupMinor": 100000,
    "perKmMinor": 20000,
    "currency": "NGN",
    "active": true
  },
  "requestId": "example-request-id"
}
```

Returns the same single row shape as above in data, not an items wrapper. Missing record returns 404.

### `GET /v1/admin/shipping/countries`

List shipping countries.

**Access:** super or regular. **Headers:** Read headers (bearer token, matching X-Account-Type, Accept application/json). No body or Idempotency-Key.

**Request:** Optional includeInactive=true|false, limit=25 (1–100), cursor=<opaque>.

**Success: HTTP 200.**

```json
{
  "data": {
    "items": [
      {
        "id": "NG",
        "code": "NG",
        "name": "Nigeria",
        "active": true,
        "postalCodeRequired": null
      }
    ],
    "nextCursor": null,
    "hasMore": false
  },
  "requestId": "example-request-id"
}
```

Unknown postalCodeRequired remains null; do not infer false.

### `GET /v1/admin/shipping/countries/{id}`

Read one shipping countries record.

**Access:** super or regular. **Headers:** Read headers (bearer token, matching X-Account-Type, Accept application/json). No body or Idempotency-Key.

**Request:** No query parameters.

**Success: HTTP 200.**

```json
{
  "data": {
    "id": "NG",
    "code": "NG",
    "name": "Nigeria",
    "active": true,
    "postalCodeRequired": null
  },
  "requestId": "example-request-id"
}
```

For countries the id path value is the country code, for example /v1/admin/shipping/countries/NG. Returns the same single row shape as above in data, not an items wrapper. Missing record returns 404.

### `GET /v1/admin/shipping/tariffs`

List international shipping tariff versions.

**Access:** super or regular. **Headers:** Read headers (bearer token, matching X-Account-Type, Accept application/json). No body or Idempotency-Key.

**Request:** Optional includeInactive=true|false, limit=25 (1–100), cursor=<opaque>.

**Success: HTTP 200.**

```json
{
  "data": {
    "items": [
      {
        "id": "international-001",
        "name": "Example tariff",
        "carrier": "example-carrier",
        "direction": "export",
        "cargo": "non_document",
        "status": "active",
        "historical": false,
        "volumetricDivisor": 5000,
        "createdAt": "2026-11-03T07:00:00Z"
      }
    ],
    "nextCursor": null,
    "hasMore": false
  },
  "requestId": "example-request-id"
}
```

Summary only; fetch rates and country-zone mapping with the child endpoints below.

### `GET /v1/admin/shipping/tariffs/{id}`

Read one international shipping tariff versions record.

**Access:** super or regular. **Headers:** Read headers (bearer token, matching X-Account-Type, Accept application/json). No body or Idempotency-Key.

**Request:** No query parameters.

**Success: HTTP 200.**

```json
{
  "data": {
    "id": "international-001",
    "name": "Example tariff",
    "carrier": "example-carrier",
    "direction": "export",
    "cargo": "non_document",
    "status": "active",
    "historical": false,
    "volumetricDivisor": 5000,
    "createdAt": "2026-11-03T07:00:00Z"
  },
  "requestId": "example-request-id"
}
```

Returns the same single row shape as above in data, not an items wrapper. Missing record returns 404.

### `GET /v1/admin/geography/tariffs`

List local shipping tariff versions.

**Access:** super or regular. **Headers:** Read headers (bearer token, matching X-Account-Type, Accept application/json). No body or Idempotency-Key.

**Request:** Optional includeInactive=true|false, limit=25 (1–100), cursor=<opaque>.

**Success: HTTP 200.**

```json
{
  "data": {
    "items": [
      {
        "id": "local-001",
        "localType": "example-local-type",
        "zone": 1,
        "status": "active",
        "volumetricDivisor": 5000,
        "createdAt": "2026-11-03T07:00:00Z"
      }
    ],
    "nextCursor": null,
    "hasMore": false
  },
  "requestId": "example-request-id"
}
```

These local records come from shipping_local_tariffs, not dormant standalone geography LGA rates.

### `GET /v1/admin/geography/tariffs/{id}`

Read one local shipping tariff versions record.

**Access:** super or regular. **Headers:** Read headers (bearer token, matching X-Account-Type, Accept application/json). No body or Idempotency-Key.

**Request:** No query parameters.

**Success: HTTP 200.**

```json
{
  "data": {
    "id": "local-001",
    "localType": "example-local-type",
    "zone": 1,
    "status": "active",
    "volumetricDivisor": 5000,
    "createdAt": "2026-11-03T07:00:00Z"
  },
  "requestId": "example-request-id"
}
```

Returns the same single row shape as above in data, not an items wrapper. Missing record returns 404.

### `GET /v1/admin/shipping/tariffs/{id}/rates`

Read international tariff weight bands and prices.

**Access:** super or regular. **Headers:** Read headers (bearer token, matching X-Account-Type, Accept application/json). No body or Idempotency-Key.

**Request:** Optional limit=25 (1–100), cursor=<opaque>.

**Success: HTTP 200.**

```json
{
  "data": {
    "items": [
      {
        "tariffId": "international-001",
        "zone": 1,
        "weightGrams": 500,
        "amountMinor": 1000000,
        "currency": "NGN"
      }
    ],
    "nextCursor": null,
    "hasMore": false
  },
  "requestId": "example-request-id"
}
```

Sorted by zero-padded zone and weight key ascending. Weight is grams; amountMinor is NGN kobo. Existing tariff with no rates returns an empty page; missing parent tariff returns 404.

### `GET /v1/admin/shipping/tariffs/{id}/countries`

Read the tariff country-to-zone mapping.

**Access:** super or regular. **Headers:** Read headers (bearer token, matching X-Account-Type, Accept application/json). No body or Idempotency-Key.

**Request:** Optional limit=25 (1–100), cursor=<opaque>.

**Success: HTTP 200.**

```json
{
  "data": {
    "items": [
      {
        "code": "NG",
        "zone": 1,
        "name": "Nigeria",
        "active": true
      }
    ],
    "nextCursor": null,
    "hasMore": false
  },
  "requestId": "example-request-id"
}
```

Country code ascending. Missing parent tariff returns 404. This read can include inactive mapped countries; it is not the filtered customer bookable-country list.

### `GET /v1/admin/geography/tariffs/{id}/rates`

Read local tariff weight bands and prices.

**Access:** super or regular. **Headers:** Read headers (bearer token, matching X-Account-Type, Accept application/json). No body or Idempotency-Key.

**Request:** Optional limit=25 (1–100), cursor=<opaque>.

**Success: HTTP 200.**

```json
{
  "data": {
    "items": [
      {
        "tariffId": "local-001",
        "weightGrams": 500,
        "amountMinor": 150000,
        "currency": "NGN"
      }
    ],
    "nextCursor": null,
    "hasMore": false
  },
  "requestId": "example-request-id"
}
```

Sorted by zero-padded weight key ascending; grams and integer kobo. Missing local tariff returns 404. No standalone lga_id/fee_minor schema.

### `GET /v1/admin/geography/states`

Read native state IDs and local shipping zones.

**Access:** super or regular. **Headers:** Read headers (bearer token, matching X-Account-Type, Accept application/json). No body or Idempotency-Key.

**Request:** Optional limit=25 (1–100), cursor=<opaque>.

**Success: HTTP 200.**

```json
{
  "data": {
    "items": [
      {
        "id": "state-001",
        "name": "Example State",
        "localZone": "1"
      }
    ],
    "nextCursor": null,
    "hasMore": false
  },
  "requestId": "example-request-id"
}
```

ID ascending. localZone may be null. The existing customer state list is /v1/locations/states, not /v1/geography/states. No admin state-write route is added by this read.

## Audit feed

### `GET /v1/admin/audit`

Read approved native dashboard/role audit metadata.

**Access:** super only. **Headers:** Read headers (bearer token, matching X-Account-Type, Accept application/json). No body or Idempotency-Key.

**Request:** Optional limit=25 (1–100), cursor=<opaque>.

**Success: HTTP 200.**

```json
{
  "data": {
    "items": [
      {
        "id": "dashboard:admin-uid:admin-operation-001",
        "source": "dashboard",
        "actorUid": "admin-uid",
        "action": "mobile.update",
        "createdAt": "2026-11-03T07:00:00Z"
      }
    ],
    "nextCursor": null,
    "hasMore": false
  },
  "requestId": "example-request-id"
}
```

Sorts combined source key ascending, not newest timestamp. Dashboard entries contain id/source/actorUid/action/createdAt. Role entries contain id/source=roles/actor/targetUid/adminType/createdAt; actor is operator metadata, not necessarily a UID, and there is no action/actorUid requirement for these rows. This covers native dashboard and admin-role operations, not a unified history of every subsystem. Does not expose private request hashes/results, credentials or operator evidence. Migration 000099 supplies the narrow audit read view; do not grant runtime raw audit/archive table access.

Role audit row example (inside data.items):

```json
{
  "id": "roles:example-operation",
  "source": "roles",
  "actor": "dashboard:admin-uid",
  "targetUid": "target-uid",
  "adminType": "regular",
  "createdAt": "2026-11-03T07:00:00Z"
}
```

## Analytics coverage and integration corrections

### `GET /v1/admin/analytics/coverage`

Inspect report coverage and latest backfill progress before relying on totals.

**Access:** super only. **Headers:** Read headers (bearer token, matching X-Account-Type, Accept application/json). No body or Idempotency-Key.

**Request:** Required report=account_summary|order_summary|referral_summary|user_activation|order_facts|coupon_reporting.

**Success: HTTP 200.**

```json
{
  "data": {
    "report": "account_summary",
    "coverage": {
      "basis": "active_postgres_records",
      "complete": false,
      "updatedAt": null,
      "timezone": "Africa/Lagos"
    },
    "lastBackfill": null
  },
  "requestId": "example-request-id"
}
```

No pagination. lastBackfill is null if none exists, otherwise {status,processed,completedAt}, with completedAt nullable. coverage.complete depends on a successful captured report backfill and agreement of active PostgreSQL source/capture/projection versions, including deletion handling. It is not legacy source-seal or archive activation certification. The endpoint itself can return HTTP 200 with complete false.

Latest-backfill example (inside data):

```json
{
  "report": "account_summary",
  "coverage": {
    "basis": "active_postgres_records",
    "complete": true,
    "updatedAt": "2026-11-03T07:00:00Z",
    "timezone": "Africa/Lagos"
  },
  "lastBackfill": {
    "status": "succeeded",
    "processed": 125,
    "completedAt": "2026-11-03T07:00:00Z"
  }
}
```

Existing super-only rebuild endpoint: POST /v1/admin/analytics/backfills, with Write headers and body:

```json
{"report": "account_summary"}
```

HTTP 202 example:

```json
{
  "data": {
    "jobId": "example-backfill-job",
    "jobType": "analytics.backfill",
    "status": "pending",
    "statusUrl": "/v1/operations/example-backfill-job",
    "report": "account_summary"
  },
  "requestId": "example-request-id"
}
```

Queue the six report rebuilds after deployment, preserving operation keys for uncertain retries. Inspect coverage and worker progress afterward; 202 is queue acceptance, not report readiness. Existing account/order/referral summaries now return HTTP 503 with code analytics_not_ready when coverage is incomplete. Do not bypass the check or fill missing business totals with zeros.

Use these native query/response shapes in existing frontend integrations:

| Endpoint | Correct integration |
|---|---|
| GET /v1/admin/analytics/rider-weekly-deliveries | Read data.items, riderId and weeks; not a riders array or snake_case fields. |
| GET /v1/admin/analytics/time-to-first-order | Use limit=1 for a small summary fetch; read data.summary and data.items. summary_only=true is an unsupported standalone parameter. User rows use userId, createdAt, firstOrderAt, timeToFirstOrderDays, status. |
| GET /v1/admin/analytics/coupon-redemptions | Send startDate, endDate and optional asOfDate; do not use snake_case dates. |
| GET /v1/admin/analytics/account-summary | Keep existing path; type=users or riders. |
| GET /v1/admin/analytics/order-summary | Keep existing path; supported in-scope types include shipment and ride-courier. Food/ecommerce are excluded from this rollout. |
| GET /v1/admin/referrals, /summary, /export.csv | Existing list/summary/export; coverage preparation still matters. Do not recreate them as missing. |
| GET /v1/shipments/{id}/tracking | Live location is exposed only in active pickup states (native status codes 1 and 6). Tracking 404 can mean live location unavailable; preserve successful shipment detail/timeline instead of treating shipment as missing or retrying forever. |

Unwrap the JSON envelope once. If the HTTP client returns a response object, response.data is the body and response.data.data is the payload. If your helper already unwraps it, read that result directly. Keep coverage.complete visible: an exploratory 200 does not make incomplete values complete business totals.

PostgreSQL report completeness concerns activated operational records, not all archived historical data. Historical referral activation requires a separate reviewed migration; never replay historical signup work to populate reports.

After upgrading through migration 000099 and runtime grants, operators can inspect/queue/recheck the existing report contracts with scripts/prepare-native-admin-reports.py. This helper is operational tooling, not a new browser endpoint. It requires an existing super-admin session and does not import archives or grant rewards. The provided follow-up audit does not prove deployed writes, private-media access or provider acceptance.

## Errors and deployment

Dashboard error example:

```json
{
  "error": {
    "code": "conflict",
    "message": "State changed or the idempotency key was reused; reload before retrying",
    "details": {}
  },
  "requestId": "example-request-id"
}
```

| Status | Meaning |
|---|---|
| 400 | Malformed/unknown fields, missing headers/key/version, invalid query/cursor or values |
| 401 | Missing/invalid/revoked session; reauthenticate |
| 403 | Current membership cannot perform the operation |
| 404 | Missing target/resource |
| 409 | Stale version, changed idempotency input, ineligible state or insufficient configuration conditions |
| 429 | Admission limit; respect Retry-After |
| 503 | Dependency unavailable, invalid configuration, or analytics_not_ready for incomplete native reports |

Login/provider errors use their identity error codes; do not match message strings or assume a 401 means non-admin. GET session is the ordinary membership check. Never infer privileges from browser storage, a decoded opaque token or a guessed account type.

Deployment requires migrations through 000099_native_admin_audit_read.sql, reapplication of deploy/runtime-role.sql and restart of both API and worker through the existing guarded deployment workflow. The native dashboard is mounted only when PostgreSQL operational persistence is selected. Session subtype fields and Google admin login also require their updated API implementation; code present locally does not prove the live server was upgraded. Configure actual mobile versions/store IDs and positive signup allowance explicitly.

Source references:

- [Native dashboard overview](native-dashboard-api.md)
- [Native dashboard OpenAPI](../api/native-dashboard.yaml)
- [Admin Google/session details](admin-management-api.md)
- [Dashboard HTTP, authorization and envelopes](../internal/dashboard/service.go)
- [Mobile handlers](../internal/dashboard/mobile.go)
- [Role handlers](../internal/dashboard/roles.go)
- [Coupon handlers](../internal/dashboard/coupons.go)
- [Funding handlers](../internal/dashboard/funding.go)
- [Support handlers](../internal/dashboard/support.go)
- [Read models and exports](../internal/dashboard/read_models.go)
- [Operational ride/fee reads](../internal/dashboard/operational_reads.go)
- [Live audit follow-up and contract corrections](admin-webapp-audit-2026-11-02.md)
- [Analytics OpenAPI](../api/nativeanalytics.yaml)

Existing shipment, jobs, analytics and referral routes retain their own contracts, subject to the coverage and frontend parsing corrections documented above. This update does not add arbitrary shipment assignment, document reassignment, reply attachments or certify all historical standalone screens. Refer to the native dashboard overview for residual scope.

Documentation verification: request/response examples checked against source handlers/models; this file does not claim deployed authentication testing, production capacity or new runtime test results. The privately executed scripts/check-deployed-native-auth.py user --admin helper is available for a provisioned password admin. Google-only admins need their real Google challenge/login flow.

# Live admin endpoint error audit — 3 November 2026

## Result

**11 distinct GET endpoint paths failed persistently across 16 valid query variants.** Every listed variant was rechecked and returned the same HTTP status/error code. This includes dashboard page requests plus explicitly identified diagnostic reads. There were 200 captured proxy request attempts across the main and follow-up runs, including authentication, duplicate page reads and rechecks; this is not 200 distinct endpoints.

The audit used the supplied administrator account, whose live session confirmed `isAdmin: true` and `adminType: "super"`. Requests went through an isolated local production build of the Next.js proxy to the configured `BASE_URL`. The backend origin, credentials, cookies and tokens are omitted. No live business writes, price changes, shipment transitions, payments, backfills or role changes were performed. Only login/logout and the application’s automatic authentication refresh requests were allowed.

Runs completed at **16:32:47 and 16:34:45 WAT** (15:32:47 and 15:34:45 UTC). Results describe this configured deployment at that time; the earlier November 2 audit is not being reused as current evidence.

## Failing endpoints

| # | Method / endpoint | HTTP | Error code | Screen or scope |
| --- | --- | --- | --- | --- |
| 1 | `GET /v1/admin/analytics/account-summary` | 503 | `analytics_not_ready` | Overview and account reports |
| 2 | `GET /v1/admin/analytics/order-summary` | 503 | `analytics_not_ready` | Overview and order reports |
| 3 | `GET /v1/admin/rides` | 503 | `unavailable` | Ride hailing |
| 4 | `GET /v1/marketplace/orders` | 404 | `not_found` | Marketplace/product orders and restaurant-orders alias |
| 5 | `GET /v1/admin/referrals/summary` | 503 | `analytics_not_ready` | Referrals totals |
| 6 | `GET /v1/admin/referrals` | 503 | `analytics_not_ready` | Referrals list |
| 7 | `GET /v1/marketplace/items` | 404 | `not_found` | Catalogue |
| 8 | `GET /v1/marketplace/categories` | 404 | `not_found` | Catalogue categories |
| 9 | `GET /v1/admin/reports/withdrawals` | 404 | `not_found` | Additional diagnostic export probe; not an automatically loaded page request |
| 10 | `GET /v1/admin/referrals/export.csv` | 503 | `analytics_not_ready` | Referral export; valid date-range request |
| 11 | `GET /v1/config/mobile` | 503 | `reference_unavailable` | Public app release reads; additional diagnostic checks for both apps/platforms |

## Requests and responses

All GETs below have **no request body**. The browser calls `/api/proxy` followed by the listed path and query, using its HttpOnly session cookie. The Next server adds `Authorization: Bearer [REDACTED]` and `X-Account-Type: user` for authenticated upstream requests. Public `/v1/config/mobile` reads do not require authentication. Application reads request JSON; the diagnostic CSV export returns a JSON error before a CSV download can start. Response bodies below are captured error responses, not invented examples.

### 1. `GET /v1/admin/analytics/account-summary`

Backend reports its capture/projection is incomplete. Inspect analytics coverage and worker/backfill progress for both user and rider accounts. Do not replace unavailable totals with zero.

Request:

```http
GET /api/proxy/v1/admin/analytics/account-summary?type=users
Cookie: [REDACTED]
```

Body: none. Response: **HTTP 503**. Error message: **Report capture or projection is incomplete. Run the report backfill and check worker progress.**

```json
{
  "error": {
    "code": "analytics_not_ready",
    "details": {},
    "message": "Report capture or projection is incomplete. Run the report backfill and check worker progress."
  },
  "requestId": "df33a085f83250998f2b8a19f2b5fe82"
}
```

Recheck: **HTTP 503**, `analytics_not_ready`; request ID `2296e7ab154582fa4162fff32df0ff51`.

Request:

```http
GET /api/proxy/v1/admin/analytics/account-summary?type=riders
Cookie: [REDACTED]
```

Body: none. Response: **HTTP 503**. Error message: **Report capture or projection is incomplete. Run the report backfill and check worker progress.**

```json
{
  "error": {
    "code": "analytics_not_ready",
    "details": {},
    "message": "Report capture or projection is incomplete. Run the report backfill and check worker progress."
  },
  "requestId": "007a1e23763a0ec0207a72dc5d1cab26"
}
```

Recheck: **HTTP 503**, `analytics_not_ready`; request ID `318343d4632cb24b9e2e6c960e6d7666`.

### 2. `GET /v1/admin/analytics/order-summary`

Backend reports incomplete capture/projection for shipment and ride/courier summaries. Investigate report readiness; the route exists.

Request:

```http
GET /api/proxy/v1/admin/analytics/order-summary?type=shipment
Cookie: [REDACTED]
```

Body: none. Response: **HTTP 503**. Error message: **Report capture or projection is incomplete. Run the report backfill and check worker progress.**

```json
{
  "error": {
    "code": "analytics_not_ready",
    "details": {},
    "message": "Report capture or projection is incomplete. Run the report backfill and check worker progress."
  },
  "requestId": "31eb3f8776d097b74232da51aeb6876c"
}
```

Recheck: **HTTP 503**, `analytics_not_ready`; request ID `8c7642560d9d93443474f387b3c4a454`.

Request:

```http
GET /api/proxy/v1/admin/analytics/order-summary?type=ride-courier
Cookie: [REDACTED]
```

Body: none. Response: **HTTP 503**. Error message: **Report capture or projection is incomplete. Run the report backfill and check worker progress.**

```json
{
  "error": {
    "code": "analytics_not_ready",
    "details": {},
    "message": "Report capture or projection is incomplete. Run the report backfill and check worker progress."
  },
  "requestId": "0e1e7d96fd97e5c0c1b81e52e3722fa5"
}
```

Recheck: **HTTP 503**, `analytics_not_ready`; request ID `f098d8b81dc079fb67cbf999eb7dbf16`.

### 3. `GET /v1/admin/rides`

The endpoint exists in the source but the live list fails. Use the request IDs to inspect backend logs and read-model/data projection errors. The response does not identify the internal cause.

Request:

```http
GET /api/proxy/v1/admin/rides?limit=25
Cookie: [REDACTED]
```

Body: none. Response: **HTTP 503**. Error message: **Administration is temporarily unavailable**

```json
{
  "error": {
    "code": "unavailable",
    "details": {},
    "message": "Administration is temporarily unavailable"
  },
  "requestId": "0b3d500cdfe3ae070915519bbb6a0c71"
}
```

Recheck: **HTTP 503**, `unavailable`; request ID `f53ba3429ff34df1f8db3bcf6f881d85`.

### 4. `GET /v1/marketplace/orders`

The configured backend returns Route not found. Confirm a mounted native admin marketplace-order listing contract or keep this screen unavailable until one exists. Do not assume a customer-scoped route grants admin access.

Request:

```http
GET /api/proxy/v1/marketplace/orders?limit=25
Cookie: [REDACTED]
```

Body: none. Response: **HTTP 404**. Error message: **Route not found**

```json
{
  "error": {
    "code": "not_found",
    "details": {},
    "message": "Route not found"
  },
  "requestId": "08492219a4e78e5eb89955be5bb5a56d"
}
```

Recheck: **HTTP 404**, `not_found`; request ID `4ff072d371137521ce0507896fb6cbd5`.

### 5. `GET /v1/admin/referrals/summary`

Inspect analytics capture/projection readiness and the worker/backfill state.

Request:

```http
GET /api/proxy/v1/admin/referrals/summary
Cookie: [REDACTED]
```

Body: none. Response: **HTTP 503**. Error message: **Report capture or projection is incomplete. Run the report backfill and check worker progress.**

```json
{
  "error": {
    "code": "analytics_not_ready",
    "details": {},
    "message": "Report capture or projection is incomplete. Run the report backfill and check worker progress."
  },
  "requestId": "0f191e2808bdb5321efe046351f7cde0"
}
```

Recheck: **HTTP 503**, `analytics_not_ready`; request ID `ca1d0c797d03cdd40e6d32abd7176a96`.

### 6. `GET /v1/admin/referrals`

Inspect analytics capture/projection readiness. The dashboard sends its supported limit of 10.

Request:

```http
GET /api/proxy/v1/admin/referrals?limit=10
Cookie: [REDACTED]
```

Body: none. Response: **HTTP 503**. Error message: **Report capture or projection is incomplete. Run the report backfill and check worker progress.**

```json
{
  "error": {
    "code": "analytics_not_ready",
    "details": {},
    "message": "Report capture or projection is incomplete. Run the report backfill and check worker progress."
  },
  "requestId": "5f09078c4ef56380a2a6e537fe22200b"
}
```

Recheck: **HTTP 503**, `analytics_not_ready`; request ID `bc460e9245ceb0b0dfa0c2bd60411e9d`.

### 7. `GET /v1/marketplace/items`

No mounted live route at the current path. Supply a native admin catalogue read contract or remove the unsupported call.

Request:

```http
GET /api/proxy/v1/marketplace/items?limit=25
Cookie: [REDACTED]
```

Body: none. Response: **HTTP 404**. Error message: **Route not found**

```json
{
  "error": {
    "code": "not_found",
    "details": {},
    "message": "Route not found"
  },
  "requestId": "9a5ecbc657438afda5f985a9da0744eb"
}
```

Recheck: **HTTP 404**, `not_found`; request ID `bdf14db73c7b5245b85b7d9f36cd6a75`.

### 8. `GET /v1/marketplace/categories`

No mounted live route at the current path. Supply a supported category listing contract.

Request:

```http
GET /api/proxy/v1/marketplace/categories
Cookie: [REDACTED]
```

Body: none. Response: **HTTP 404**. Error message: **Route not found**

```json
{
  "error": {
    "code": "not_found",
    "details": {},
    "message": "Route not found"
  },
  "requestId": "34c94676de47ab2e9b6c7420b9d7a745"
}
```

Recheck: **HTTP 404**, `not_found`; request ID `cd23858b056c43976af0eb490bc6695a`.

### 9. `GET /v1/admin/reports/withdrawals`

The historical withdrawal export path returns Route not found. The native withdrawal list succeeds independently. Publish a supported export contract before enabling that export workflow.

Request:

```http
GET /api/proxy/v1/admin/reports/withdrawals?format=json&limit=1
Cookie: [REDACTED]
```

Body: none. Response: **HTTP 404**. Error message: **Route not found**

```json
{
  "error": {
    "code": "not_found",
    "details": {},
    "message": "Route not found"
  },
  "requestId": "0c4e7afd47e01acb6df09ead505049ef"
}
```

Recheck: **HTTP 404**, `not_found`; request ID `283e55c9bfc267543e0a3daeb3abbb9c`.

### 10. `GET /v1/admin/referrals/export.csv`

The valid export query also reports analytics_not_ready. The separate limit-only probe below was invalid and is not evidence of a dashboard query bug.

Request:

```http
GET /api/proxy/v1/admin/referrals/export.csv?startDate=2026-10-26&endDate=2026-11-02
Cookie: [REDACTED]
```

Body: none. Response: **HTTP 503**. Error message: **Report capture or projection is incomplete. Run the report backfill and check worker progress.**

```json
{
  "error": {
    "code": "analytics_not_ready",
    "details": {},
    "message": "Report capture or projection is incomplete. Run the report backfill and check worker progress."
  },
  "requestId": "bbc6a09be716667a3e8b96d879500d49"
}
```

Recheck: **HTTP 503**, `analytics_not_ready`; request ID `c3cfe1671f7136c038ef36a735f195b5`.

### 11. `GET /v1/config/mobile`

All four public reads return reference_unavailable. All four admin editor reads succeeded. Investigate public configuration validity/read readiness using these request IDs. This observation does not establish that the settings are absent; the admin editor is intentionally able to read missing/invalid configuration.

Request:

```http
GET /api/proxy/v1/config/mobile?app=user&platform=android
Cookie: [REDACTED]
```

Body: none. Response: **HTTP 503**. Error message: **Customer reference data is temporarily unavailable.**

```json
{
  "error": {
    "code": "reference_unavailable",
    "details": {},
    "message": "Customer reference data is temporarily unavailable."
  },
  "requestId": "8248d594cd05baee168060fcc0a12682"
}
```

Recheck: **HTTP 503**, `reference_unavailable`; request ID `e8082868ec736683eb01be19824a76c3`.

Request:

```http
GET /api/proxy/v1/config/mobile?app=rider&platform=android
Cookie: [REDACTED]
```

Body: none. Response: **HTTP 503**. Error message: **Customer reference data is temporarily unavailable.**

```json
{
  "error": {
    "code": "reference_unavailable",
    "details": {},
    "message": "Customer reference data is temporarily unavailable."
  },
  "requestId": "497003a5a7b091dee0994199d07d0053"
}
```

Recheck: **HTTP 503**, `reference_unavailable`; request ID `0c740a7354964d2ac9e7add473840808`.

Request:

```http
GET /api/proxy/v1/config/mobile?app=user&platform=ios
Cookie: [REDACTED]
```

Body: none. Response: **HTTP 503**. Error message: **Customer reference data is temporarily unavailable.**

```json
{
  "error": {
    "code": "reference_unavailable",
    "details": {},
    "message": "Customer reference data is temporarily unavailable."
  },
  "requestId": "92c111b373ba03107362e0a6372a2211"
}
```

Recheck: **HTTP 503**, `reference_unavailable`; request ID `0924e6a8fb5cf47fad8110863ba1a80e`.

Request:

```http
GET /api/proxy/v1/config/mobile?app=rider&platform=ios
Cookie: [REDACTED]
```

Body: none. Response: **HTTP 503**. Error message: **Customer reference data is temporarily unavailable.**

```json
{
  "error": {
    "code": "reference_unavailable",
    "details": {},
    "message": "Customer reference data is temporarily unavailable."
  },
  "requestId": "064f78b218f54e94131d48fa5d73cef3"
}
```

Recheck: **HTTP 503**, `reference_unavailable`; request ID `f6b22bb7e2209ffb5933dfceff90739c`.

## Authentication and audit-only errors

1. **Sign-in startup:** `GET /v2/auth/session` and `POST /v2/auth/refresh` returned HTTP 401 during authentication bootstrap. The first session response was `{"error":{"code":"session_expired","message":"Your session has expired. Sign in again."}}`; its request had no body and no authenticated session. The refresh request body was `{}`; its response body could not be captured. Subsequent login, authenticated session reads and audit-session logout returned HTTP 200 in both runs. These startup responses are not counted as persistent business endpoint failures. A valid expired-session refresh/rotation cycle was not deliberately exercised, so that remains unverified.

2. **Invalid diagnostic referral query:** `GET /v1/admin/referrals/export.csv?limit=1` returned HTTP 400, `invalid_request`, “The analytics request is invalid.” This was an audit probe, not the application’s export request. The frontend supplies `startDate` and `endDate`; that valid request was tested separately and returned HTTP 503 as item 10 above. Do not treat the 400 as a frontend defect.

Captured invalid-probe response:

```json
{
  "error": {
    "code": "invalid_request",
    "details": {},
    "message": "The analytics request is invalid."
  },
  "requestId": "9cf22d5ba280e010e9fa7df860a4cbd7"
}
```

3. Two initial report-selection automation steps matched the section label instead of its select element. They were rerun with the actual combobox selectors; rider account and ride/courier order queries are included above. These automation errors are not backend failures. No browser JavaScript exceptions were recorded.

## Reads that succeeded

The following returned HTTP 200 in the audited sample. A successful read does not prove every record, cursor, filter or write contract works.

| Area | Confirmed reads |
| --- | --- |
| Identity | Login, authenticated session, current profile and audit-session logout |
| Users/riders | Both typed directories, one profile from each, user role reads, and bounded JSON account/rider exports |
| Shipments | First listing page; local, express and customs-clearance sample details |
| Support | Ticket listing, one ticket detail and its messages |
| Coupons | Campaigns, signup settings and processing jobs |
| Release/bonus administration | All four `/v1/admin/config/mobile/{app}/{platform}` reads; signup bonus configuration |
| Fees/shipping | Ride fee and shipping settings catalogues, offices and sample office, countries and NG detail, international/local tariffs and sampled rate lists, international country-zone mapping, state list |
| Reports | Weekly overview, weekly concentration, rider weekly deliveries, user activation, coupon redemption metrics, analytics coverage |
| Operations | Withdrawal listing, payment receipt listing, audit listing, job listing and one job detail |

## Coverage and limits

- Opened dashboard/report, directory, shipment, ride, marketplace, withdrawal, support, referral, office, tariff, fee, coupon, catalogue, payment, job, audit, release, notification, file and security sections. Also opened available detail links and switched coupon/release/report/fee views. Unavailable partner screens make no partner-directory request; their missing contracts remain separate gaps.

- Successful HTTP 200 report payloads still carry their own coverage/completeness information; this audit classifies HTTP/application failures, not the business accuracy of every total.

- The withdrawal first page had no available detail link in this sample. Ride and marketplace details could not be discovered from their failing lists. No arbitrary record IDs were fabricated to create false 404 findings. Historical private-file downloads, every page/cursor, Google OAuth and all business mutation endpoints were outside this read-only run.

- The audit recorded responses; it did not repair the backend or trigger backfills. For `analytics_not_ready`, inspect the coverage endpoint and job/worker evidence before deciding on an authorized rebuild. For generic 503s, correlate request IDs with backend logs instead of assuming a cause.

- Missing shipment edits are documented in [Shipment workflow contracts](shipment-workflow-contracts.md). Missing global pricing writes and proposed backend contracts are documented in [Pricing backend contracts](pricing-backend-contracts.md). Missing account workflows remain in [Account workflow contracts](account-workflow-contracts.md).

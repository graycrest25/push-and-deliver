# Head office backend configuration

This repository has no Firebase deployment configuration or existing security rules. The files here are integration additions for the backend owner; they have not been deployed.

- Merge `head-offices.rules` inside the deployed `/databases/{database}/documents` rules block. Do not replace the existing rules with this fragment. Ensure no broader wildcard rule also grants access to `HeadOfficeAddress`: Firestore combines matching allow rules with OR.
- Merge the index in `firestore.indexes.json` into the existing project's indexes, preserving all other indexes. Deploy the rules and indexes using the backend project's established process. Filtering shipments by office requires this composite index to finish building.
- The collection name is `HeadOfficeAddress`. Documents contain `active` (boolean), `address` and `location` (strings), and `geolocation` (Firestore GeoPoint).
- `ShippmentOrders.pndofficelocationID` is the exact head office document ID. Names, addresses, and coordinates are never used as join keys. All offices, including inactive offices, are available in the super admin shipment filter.
- Deleting an office does not alter shipment records. Historical references display their retained ID and an unavailable-office label. Prefer deactivation to preserve the location details.

Verify unauthenticated, regular, customer care, and verifier reads/writes are denied; only signed-in accounts with both `isAdmin: true` and `adminType: 'super'` claims may read, create, toggle availability, or delete office documents. These rules restrict head office reads for all clients; any customer/rider app currently reading this collection will also lose access under the requested policy.

## Super admin API permissions

The frontend gates weekly overview, user/rider ride counts, user activation reports, office management/filtering, and closed-ticket conversations to super admins. The deployed `getAdminWeeklyOverview`, `getAdminRideCounts`, `getAdminTimeToFirstOrder`, `getAdminRiderWeeklyDeliveries`, `getAdminWeeklyConcentration`, and `getAdminCouponRedemptionMetrics` functions must independently require both `isAdmin: true` and `adminType: 'super'`, validate Firebase ID tokens, and reject revoked tokens and disabled/demoted accounts. Those function implementations are outside this repository. In particular, update `getAdminTimeToFirstOrder` on the backend if it previously permitted other admin types.

Closed-ticket message reads also need an equivalent super-admin restriction in the deployed `SupportTickets/{ticketId}/Messages/{messageId}` rules, while preserving the application's existing open-ticket and requester permissions. The supplied head office rules do not change support-ticket rules or API function permissions.

## Rider weekly deliveries backend

Deploy `getAdminRiderWeeklyDeliveries` in the backend Firebase project before using Riders → Weekly deliveries. This frontend adds no direct order queries for the report. Any composite indexes for completed order status and rider ID must match the deployed function’s actual queries; its source is not in this repository. Query failures are shown as errors, with no partial counts displayed.

The frontend pins the server-returned Lagos end date while paging, sends the rider-document-ID cursor unchanged, and restarts pagination when filters change or Refresh is selected. Coverage describes completed history for the returned riders, while totals describe only the requested reporting period.

## Weekly concentration backend

Deploy `getAdminWeeklyConcentration` to enable Users → Weekly concentration. The frontend requests only this authenticated endpoint and performs no direct order/profile queries for the report. It preserves server ranks, service-key spelling, full Lagos calendar weeks, and percentages already expressed on a 0–100 scale. Shares are based on all eligible weekly orders; coverage identifies scanned orders excluded for invalid customer IDs or unsupported shipment types. Restaurant and product orders are not part of this report.

## Coupon redemption metrics backend

Deploy `getAdminCouponRedemptionMetrics` to enable the super-admin-only report at Coupons → Redemption metrics. It uses the existing authenticated Firebase endpoint configuration; the frontend does not read the reporting collection directly or add Firestore indexes/rules. Keep that collection restricted to administrative reporting. Backend token revocation, current claims, and disabled-account checks remain mandatory; no API-key bypass is used.

Issuance dates are required; omitting the cutoff delegates today's Africa/Lagos date to the server. All dates are inclusive. Returned percentages already use a 0–100 scale, and null rates indicate empty denominators. Known-not-redeemed counts are displayed independently: coupons with unknown redemption times can remain in issued totals without appearing in either redeemed or known-unredeemed counts. Reporting is eventually consistent with triggers/backfills and source redemption flags. Compare cohorts using consistent observation windows. Query errors show no partial metrics.

## Cached user activation report

`getAdminTimeToFirstOrder` now returns a global aggregate from the activation summary document and cached `UserActivation` rows, with no order queries in the GET path. Deploy the updated backend and initialize its backfill. The frontend uses `globalSummary` for overall rates and average, shows them as unavailable while `isComplete` is false, labels counts as partial during backfills, and shows the last aggregate change in Lagos time. Live metrics remain eventually consistent. Page statistics remain separate and page-local. Pagination is by user ID with no stable snapshot.

The client also supports `summaryOnly=true` through `getSummary()`, without pagination or user lookup parameters. Flat single-user responses retain the global summary; 404 and 409 errors are shown with the server's message. A 409 means the existing user's activation cache requires backfill or trigger processing. Endpoint URLs continue to use the configured Firebase environment.

## Independent account summary function

`functions/index.cjs` exports `getAdminAccountSummary`. Integrate this export and
`account-summary.cjs` into the existing Firebase backend, using its existing Admin
SDK initialization, region, and deployment configuration. The included
`functions/package.json` records the Node runtime and dependencies for a standalone
functions codebase; this repository still does not deploy the production backend.

Deploy the Riders `verificationStatus` + `vehicleType` and Referrals
`referrerUid` + `createdAt` composite indexes from
`firestore.indexes.json` alongside the function. Preserve existing indexes.
The endpoint must be available through the existing `FIREBASE_BASE_URL` convention
(`getAdminAccountSummary` + the Cloud Run hostname suffix).

Contract: authenticated `GET ?type=users|riders` with a Firebase ID token in the
Bearer header. The function verifies the token and checks admin role claims on
every request. Verifiers can access rider summaries only; super, regular, and
customer-care admins can access both. The frontend has separate loading, retry,
and error states for these summaries and does not substitute table-row counts
when the function is unavailable.

Counts use Firestore `count()` aggregations, including missing-createdAt accounts
in the overall total. Rider status and vehicle types use numeric schema values
(verification: pending=0, verified=1, blocked=2; vehicle: car=0, bicycle=1, bike=2).
Totals include accounts with unknown or missing status/vehicle fields even when
they do not appear in a breakdown. User growth uses Lagos midnight boundaries;
`newThisWeek` means since midnight seven days ago, and the comparison period is
the preceding seven days. Growth is null when the comparison period is empty.
Responses carry `calculatedAt`; a per-instance 30-second cache coalesces concurrent
requests and never crosses a Lagos date boundary. No account documents are loaded
for summary calculation. Separate count queries are not a transactional snapshot.

## Collection search

List searches now pass a term and field list to the shared Firestore pagination
layer. Matching happens over the complete authorized base query, before page
limits; head-office shipment scoping is preserved. Searches are debounced by
300ms and run in batches of 250 documents. Case-insensitive substring matching
is retained for names, IDs, and the fields advertised by each screen. Referrer
name search resolves related User documents once per unique referrer per search.
Transaction recipient pickers also search the full Users or Riders collection.
Admin accounts use the same full-collection matching semantics with their
existing cursor-token API. Head offices and DHL zones already load their full
source lists; user activation sends its account ID to its existing backend.

Firestore does not provide a native case-insensitive substring query. This
implementation reads the base query when a new term is submitted, and reuses
matches while paging that search. Cost is proportional to the searched collection;
large datasets should move to a maintained search index (for example an external
search provider). Search is an on-demand snapshot; ticket lists resume their
live Firestore subscription when search is cleared. Search caches live only in
the mounted list, and are invalidated on local rider, vendor, withdrawal, and ticket status changes. Other list
filters and lower-page charts still apply to the returned page; only Users and
Riders summary cards are global. No search index or data backfill is required.

Aggregation reference: https://firebase.google.com/docs/firestore/query-data/aggregation-queries

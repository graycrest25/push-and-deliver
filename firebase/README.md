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

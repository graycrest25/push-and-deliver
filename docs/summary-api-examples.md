# Admin summary API examples

This is the API contract expected by the web app. Backend implementations live
in the existing Firebase backend project; this repository contains no example
Cloud Functions deployment folder. These endpoint names and response shapes
must be implemented/deployed before the summary cards can load.

Use [summary-api.http](examples/summary-api.http) for copyable requests and
[summary-responses.json](examples/summary-responses.json) for complete example
responses for every supported type. All response numbers are illustrative.

## Requests

Both endpoints use `GET`, a Firebase ID token, and the existing
`FIREBASE_BASE_URL` Cloud Run suffix configuration. Example shell request:

```bash
curl --get "https://getAdminOrderSummary${FIREBASE_BASE_URL}" \
  --data-urlencode 'type=shipment' \
  --header "Authorization: Bearer ${FIREBASE_ID_TOKEN}"
```

| Endpoint | `type` | Firestore collection | Web app section |
| --- | --- | --- | --- |
| `getAdminAccountSummary` | `users` | `Users` | All Users |
| `getAdminAccountSummary` | `riders` | `Riders` | All Riders |
| `getAdminOrderSummary` | `shipment` | `ShippmentOrders` | Shipment Orders |
| `getAdminOrderSummary` | `ride-courier` | `RideHaulingOrders` | Ride Hailing Orders, including courier |
| `getAdminOrderSummary` | `food` | `RestaurantOrders` | Restaurant Orders |
| `getAdminOrderSummary` | `ecommerce` | `ProductOrders` | Product Orders |

`ShippmentOrders` and `RideHaulingOrders` are the exact stored collection names.
`ride-courier` includes every ride type in the shared collection, including
`rideType: 4` (courier); it must not count just courier or just passenger rides.

Only `type` is sent. Do not accept table search, cursor, page size, date range,
head office, payment filter, or status tab as summary filters. Summaries cover
all records in the selected collection, including records without `createdAt`.
The shipment summary remains global even when the table is scoped to one office.
Ecommerce totals cover paid and unpaid orders, matching the current table loader.

## Authorization and errors

Verify the Firebase ID token, check revocation/disabled-account status, and enforce
`isAdmin: true` plus these admin roles on the server before returning cached data:

| Summary | Allowed `adminType` values |
| --- | --- |
| Users | `super`, `regular`, `customercare` |
| Riders | `super`, `regular`, `customercare`, `verifier` |
| All order types | `super`, `regular`, `customercare` |

Return JSON `{ "error": "A useful message" }` with HTTP 400 for an unsupported or
missing type, 401 for an invalid session, 403 for a disallowed role, 405 for a
non-GET request, and 500 for a failed calculation. Handle CORS preflight separately.
The web app shows an independent summary error and retry control; table loading
continues. Never return successful zero counts when a calculation fails.

## Account responses

`users` returns `type`, `total`, `newToday`, `newThisWeek`, `newLastWeek`,
`growthRate`, and `calculatedAt`. Use Africa/Lagos midnight for today. This week's
count starts at midnight seven days ago; last week covers the seven days before
that boundary. `growthRate = (newThisWeek - newLastWeek) / newLastWeek * 100`,
rounded to one decimal. Return null when `newLastWeek` is zero. Overall totals
include users with missing creation dates; date-based counts do not.

`riders` returns `type`, `total`, `byVehicle`, `verified`, `pending`, `blocked`,
and `calculatedAt`. Each status group contains `total` and `byVehicle`.
Verification status uses numbers: pending=0, verified=1, blocked=2. Vehicle keys
are `"0"` (car), `"1"` (bicycle), and `"2"` (bike), each with a non-negative integer
count. Overall totals include records with unknown status/vehicle values, even
when these do not appear in a known breakdown.

## Order responses

Shipment example:

```json
{
  "type": "shipment",
  "total": 1000,
  "active": 180,
  "completed": 750,
  "cancelled": 70,
  "paid": 900,
  "unpaid": 90,
  "unknownPayment": 10,
  "totalRevenue": 45000000,
  "completedRevenue": 36000000,
  "calculatedAt": "2026-10-17T10:00:00.000Z"
}
```

All order responses include these fields:

| Field | Calculation |
| --- | --- |
| `total` | Count every document in the collection. |
| `paid` | Count `ispaid == true`. |
| `unpaid` | Count `ispaid == false`. |
| `unknownPayment` | `total - paid - unpaid`; includes missing/null/invalid payment flags. |
| `totalRevenue` | Sum the amount field over `ispaid == true` orders. |
| `calculatedAt` | ISO 8601 UTC timestamp for the calculation, retained when serving cached results. |

Shipment, ride/courier, and ecommerce responses also require `active`,
`completed`, `cancelled`, and `completedRevenue`, using these numeric values:

| Type | Status field | Active statuses | Completed status | Cancelled status | Amount field |
| --- | --- | --- | --- | --- | --- |
| `shipment` | `orderStatus` | 0, 1, 2, 3, 6 | 4 (delivered) | 5 | `totalAmount` |
| `ride-courier` | `orderStatus` | 0, 1, 2, 6 (includes rider arrived) | 3 | 4 | `totalAmount` |
| `ecommerce` | `orderstatus` | 0, 1, 2, 3 | 4 | 5 | `total` |
| `food` | No status breakdown required | — | — | — | `totalAmount` |

`completedRevenue` sums the amount field for orders that match both the completed
status and `ispaid == true`. Ride status 5 (expired), missing statuses, and unknown
statuses contribute to `total` but not to active/completed/cancelled counts.
Food cards show total, paid, unpaid, and total revenue, so the food response
requires no fulfilment status fields. Payment totals and fulfilment totals overlap;
they are independent breakdowns and must not be added together.

Amounts are numeric naira values, not kobo or formatted strings. They represent
recorded paid order totals, not platform profit, commissions, or rider earnings.
Return 0 for an empty sum, and ignore missing/null/non-numeric amount values in
sums without excluding those documents from count queries. All counts must be
non-negative safe integers; amounts must be finite numbers.

For a successful response, `paid + unpaid + unknownPayment == total` and
`active + completed + cancelled <= total`. Produce a consistent snapshot or
retry if concurrent writes make these invariants fail. Zero-record collections
return zero counts and sums, rather than omitting required fields.

## Efficient backend calculation

Use Firestore `count()` and `sum()` aggregations over the full collection and
filtered queries. Do not load account/order documents and reduce them in the
browser or backend request handler. Keep count queries separate from amount
sums so documents without amount fields remain included in counts. Firestore
supports these aggregation operations; see the
[official aggregation guidance](https://firebase.google.com/docs/firestore/query-data/aggregation-queries).

A short cache (up to 30 seconds) can reuse calculations and coalesce concurrent
requests. Key it by endpoint and type, enforce authorization for every request,
and expire account growth summaries at the next Lagos date boundary. Do not key
or invalidate summaries on table searches or pagination. Separate count queries
are not automatically a transactional snapshot: prefer a consistent materialized
aggregate if concurrent writes frequently violate response invariants.

For sustained high traffic, maintain aggregates on writes with idempotent event
processing and a reconciliation/backfill process. The HTTP contract stays the
same. Do not expose incomplete backfill values as complete global totals.

The backend owner should deploy indexes matching the queries they implement.
`firebase/firestore.indexes.json` already contains the rider status/vehicle and
referrer/date indexes. For order aggregation queries that filter by status and
payment and sum an amount, the fields to index together are:

| Collection | Fields (ascending) |
| --- | --- |
| `ShippmentOrders` | `orderStatus`, `ispaid`, `totalAmount` |
| `RideHaulingOrders` | `orderStatus`, `ispaid`, `totalAmount` |
| `ProductOrders` | `orderstatus`, `ispaid`, `total` |

Paid-only sums may also need `ispaid` + the amount field on these collections
and `RestaurantOrders`. Use the actual missing-index error to create the index
required by the chosen backend query plan; preserve existing indexes. These API
examples do not deploy functions, provision indexes, or change security rules.

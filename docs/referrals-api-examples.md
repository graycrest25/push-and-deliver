# Referral API function examples

[referrals-api.cjs](examples/referrals-api.cjs) contains executable Node/Firebase
Admin SDK handler examples for the three APIs, a summary write handler, and a
restartable backfill. This is source to integrate into your existing backend,
not a new deployment folder. The web app now calls these APIs.

[referrals-api.http](examples/referrals-api.http) contains example requests.

## List: `GET listAdminReferrals`

| Query parameter | Meaning |
| --- | --- |
| `limit` | Optional; defaults to 10. Allowed values: 10, 20, 30, 50. |
| `cursor` | Opaque `nextCursor` from the previous response. Omit for the first page. |
| `referredUid` | Optional exact, case-sensitive match on the referred user's ID. |
| `referreduserType` | Optional exact match, usually `user` or `rider`. |
| `referralCodeUsed` | Optional exact, case-sensitive match on the code used. |

All supplied filters combine with AND on `Referrals` before pagination. Blank
optional parameters should be omitted. Unsupported limits, malformed parameters,
and invalid cursors return HTTP 400. Search is by `referredUid`, not `referrerUid`.
The backend supports any non-empty type string; the current UI offers user/rider.

```json
{
  "items": [
    {
      "id": "referral-document-id",
      "referredUid": "referred-user-id",
      "referrerUid": "referrer-user-id",
      "referreduserType": "rider",
      "referralCodeUsed": "WELCOME123",
      "riderType": "bike",
      "createdAt": "2026-10-17T10:00:00.000Z"
    }
  ],
  "limit": 10,
  "hasMore": false,
  "nextCursor": null
}
```

One row represents one referral document. Nullable source fields return null;
`createdAt` is an ISO UTC timestamp or null. Listing is ordered by document ID
ascending, not creation date, so records without dates remain discoverable.
The query reads `limit + 1` documents to decide whether another page exists.
The cursor points after the last returned document, not the lookahead record.
Changing a filter or page size starts at page one; Previous reuses a saved cursor.
No offset or all-record download is used. Individual pages are current reads,
not one immutable snapshot of the collection across the whole browsing session.

Cursors are signed with HMAC-SHA256 and bound to the filters and limit. A deleted
cursor document does not break navigation because the cursor carries its ID.
Store `REFERRAL_CURSOR_SECRET` as a backend secret with at least 32 random
characters. Keep it stable across deployments; rotating it invalidates old cursors.
The client must treat tokens as opaque and URL-encode them.

## Summary: `GET getAdminReferralSummary`

No query filters or pagination are sent. Summary cards cover the whole collection.

```json
{
  "totalReferrals": 1200,
  "totalReferrers": 300,
  "userReferrals": 850,
  "riderReferrals": 320,
  "unknownTypeReferrals": 30,
  "avgReferralsPerReferrer": 4,
  "calculatedAt": "2026-10-17T10:00:00.000Z"
}
```

`totalReferrers` counts distinct non-empty `referrerUid` values, not Users documents
and not rows in the current page. `totalReferrals` counts all referral documents,
even with missing referrer IDs. User/rider counts match the exact type strings;
other or missing types contribute to `unknownTypeReferrals`. Average is total
referrals divided by distinct referrers, rounded to one decimal; zero referrers
returns zero. The UI keeps its original three cards, with the average now labeled
per referrer. The API also exposes the user/rider counts for additional cards.

The example serves this from `AdminSummaries/referrals` in one document read.
`syncReferralSummary` updates the aggregate transactionally on source writes,
using per-referral contributions and per-referrer counters. Duplicate events,
out-of-order events, type changes, referrer changes, and deletions are handled by
reading the current source and previous processed contribution in the transaction.
Repeated processing of an unchanged referral is a no-op. Counts may lag source
writes until their triggers finish; this is an eventual aggregate.

Deploy the write trigger, then run `backfillReferralSummary(db)` from a trusted
backend script to process existing referrals. The backfill uses bounded streaming
rather than a browser read and can be restarted without double-counting. It
marks the summary complete only after both passes finish. Do not reset counts or
delete contribution/counter collections when restarting a partial backfill.
A missing, incomplete, or invalid aggregate returns HTTP 503, never a misleading
zero summary. An empty collection still gets a complete zero aggregate.

The single aggregate document is suitable for moderate write volume. A busy
referral pipeline may need sharded counters while preserving this HTTP response.
Protect `AdminSummaries`, `_ReferralSummaryContributions`, and
`_ReferralReferrerCounts` from direct client writes. These helpers contain derived
reporting data and are maintained only by the Admin SDK.

## Export: `GET exportAdminReferralsCsv`

| Query parameter | Meaning |
| --- | --- |
| `startDate` | Required `YYYY-MM-DD`, inclusive Lagos calendar date. |
| `endDate` | Required `YYYY-MM-DD`, inclusive Lagos calendar date. |
| `referreduserType` | Optional exact type filter; omit to export all types. |

Export reads the referral's `createdAt`, not the referrer's account creation date.
For `2026-10-01` through `2026-10-17`, the backend queries `createdAt >=
2026-09-30T23:00:00Z` and `< 2026-10-17T23:00:00Z`. Using the next day's exclusive
boundary includes timestamp fractions on the last day. Missing/invalid creation
dates do not match a date export. Invalid or reversed dates return HTTP 400.

All matching records are exported, regardless of the current table page, user ID
search, or code filter. The table's user-type selection is also used for export.
Response headers are `Content-Type: text/csv; charset=utf-8` and an attachment
filename such as `referrals_2026-10-01_2026-10-17.csv`. Columns:

```csv
id,referredUid,referrerUid,referreduserType,referralCodeUsed,riderType,createdAt
```

The example pages by `createdAt` and document ID in batches of 500, streams CSV
with backpressure, escapes quotes and newlines, and neutralizes spreadsheet
formula prefixes. Empty exports contain a header row. This export is a live walk,
not a frozen database snapshot. For datasets that exceed the backend's request
lifetime, use a background export job and a private download URL instead of
truncating the CSV. Do not let summary or table errors disable a valid export.

## Firebase integration example

Use your existing initialized Admin app and configured deployment region. Install
`firebase-admin` and `firebase-functions` in the existing backend if needed. Copy
`referrals-api.cjs` alongside your backend entry point, then adapt this example:

```js
const { onRequest } = require("firebase-functions/v2/https");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldPath } = require("firebase-admin/firestore");
const { createReferralApi, syncReferralSummary } = require("./referrals-api.cjs");
const cursorSecret = defineSecret("REFERRAL_CURSOR_SECRET");
const api = () => createReferralApi({
  db: getFirestore(), FieldPath,
  verifyIdToken: (token, revoked) => getAuth().verifyIdToken(token, revoked),
  cursorSecret: process.env.REFERRAL_CURSOR_SECRET,
});

exports.listAdminReferrals = onRequest(
  { cors: true, secrets: [cursorSecret] },
  (req, res) => api().listAdminReferrals(req, res),
);
exports.getAdminReferralSummary = onRequest(
  { cors: true }, (req, res) => api().getAdminReferralSummary(req, res),
);
exports.exportAdminReferralsCsv = onRequest(
  { cors: true, timeoutSeconds: 540 },
  (req, res) => api().exportAdminReferralsCsv(req, res),
);
exports.syncAdminReferralSummary = onDocumentWritten(
  { document: "Referrals/{referralId}", retry: true },
  (event) => syncReferralSummary(getFirestore(), event.params.referralId),
);
```

The HTTP wrapper handles CORS/preflight; the handlers require GET and a Firebase
Bearer ID token. The example verifies revocation and permits only `isAdmin: true`
with `adminType: super` or `regular`, matching access to the Referrals screen.
Authorization runs before query/cursor/export work. Errors return JSON
`{ "error": "A useful message" }`: 400 invalid input/cursor, 401 invalid session,
403 disallowed role, 405 wrong method, 503 unavailable summary, or 500 backend
failure. If streaming has already begun, a failure closes the connection rather
than appending JSON to a CSV. Configure endpoint hosts through the existing
`FIREBASE_BASE_URL` convention. Nothing here deploys to production automatically.

## Indexes and verification

`firebase/firestore.indexes.json` includes all four combinations of two or three filters among
`referredUid`, `referreduserType`, and `referralCodeUsed`, each followed by
`__name__` ascending, plus `referreduserType` ascending + `createdAt` ascending
for export. Single-filter listing uses automatic single-field indexes, and unfiltered listing uses the automatic document-ID index; unfiltered
export uses the automatic `createdAt` ascending index, which also orders equal
values by document ID. Preserve existing indexes and deploy the added indexes
with the backend's usual process. Firebase may merge single-field indexes for
some equality queries; the explicit combinations keep the intended query shape
reviewable. If your backend changes ordering, deploy matching indexes too.

Tests cover off-page exact search, AND filters, all page sizes, cursor tampering,
changed-filter rejection, deleted cursor documents, duplicate/out-of-order
summary processing, missing-data summaries, export date boundaries/escaping,
authentication, client response validation, and cursor resets in the UI hook.
References: [Firestore cursor pagination](https://firebase.google.com/docs/firestore/query-data/query-cursors)
and [aggregation guidance](https://firebase.google.com/docs/firestore/solutions/aggregation).

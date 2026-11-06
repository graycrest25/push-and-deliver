# Latest native admin API integration — 3 November 2026

Integrated against [the supplied backend handoff](../../pnd-backend/docs/web-admin-latest-api-update-2026-11-03.md). Its examples are illustrative contracts. The document's historical documentation-only request and rollout checklist are source context; no deployment, price publication, cash receipt or production mutation was executed as part of this frontend integration.

## Rider application contract update — 4 November 2026

Admin calls use the administrator's bearer session and `X-Account-Type: user`; no server admin API key is needed. JSON mutations require a unique idempotency key. Retry the identical request with its existing key; GET requests need no key.

The queue defaults to `GET /v1/admin/riders/applications?status=pending&limit=25`. Read application details at `GET /v1/admin/riders/{uid}/application`, the full profile at `GET /v1/admin/users/{uid}?type=riders`, and review history at `GET /v1/admin/riders/{uid}/application/reviews?limit=25`.

Application details return exactly `vehicle_photo` and `plate_number` documents. Missing documents have `available: false`, `assetId: null`, and `contentType: null`. Review controls use the actual `allowedDecisions` and `approvalBlockers`; they do not reconstruct eligibility from profile fields or require license images.

Before each vehicle edit, document attachment, or review, reload the application and send its current `version` as `expectedVersion`. Vehicle metadata uses `PUT /v1/admin/riders/{uid}/vehicle` with `{expectedVersion, reason, changes}`. Reviews use `POST /v1/admin/riders/{uid}/application/review` with `{decision, reason, expectedVersion}`.

Document replacement:

1. Create `POST /v1/admin/riders/{uid}/application/upload-intents` with `{purpose, contentType, sizeBytes, checksumSha256}`. Only `vehicle_photo` and `plate_number` are accepted. The checksum is base64 SHA-256 of the file bytes.
2. Transfer bytes to the returned upload URL with its supplied method and headers, omitting backend credentials.
3. Send `{}` to `POST /v1/admin/riders/{uid}/application/assets/{assetId}/complete`. On HTTP 202, wait and recheck completion until HTTP 200 with `status: "ready"`. Each successful processing response ends that request; a subsequent check uses a new key, while an uncertain retry keeps the same key. No operation/job endpoint is required for this flow.
4. Reload the application, then attach with `PUT /v1/admin/riders/{uid}/application/documents/{kind}` and `{assetId, expectedVersion, reason}`.
5. Fetch attached photos through authenticated `GET /v1/media/{assetId}/content`; previews use local blob URLs.

Super, regular and verifier administrators can review and manage these documents. Only super and regular administrators edit vehicle metadata.

This repository contains the admin dashboard, with no rider signup multipart form. For rider signup or multipart vehicle updates in a rider client, the only vehicle image fields are `carPictureUrl` and `plateNumberPictureUrl`. Do not send `driverLicensePictureUrl` or `licensePictureUrl`; the backend rejects them with HTTP 400.

## Connected workflows

| Section | UI and contracts |
| --- | --- |
| User/rider profiles | Full `GET /v1/admin/users/{uid}?type=users|riders`; native profile and vehicle edits; changed fields only, optional null clearing, E.164 phone input, separate profile and membership versions. Email/phone session consequences are shown after save. |
| Account finances | Target wallet, cursor-paginated transactions, authoritative typed related-order links and super-only masked rider payout destination. Missing records show an error, never a zero balance. No arbitrary balance edit. |
| Admin accounts | Server-filtered all/admin/non-admin directories, subtype filters on the admin list, existing authoritative role read/write. No client-only filtering of a limited directory page. |
| Support conversations | Queue details retain their side panel. Claiming navigates to `/support-tickets/{id}`, with chronological message bubbles, a persistent reply composer, older-message pagination, 15-second refresh, assignment-scoped attachment access, safe reply retries and current-version claim/status commands. Closed tickets remain restricted to super administrators. |
| Rider applications | Separate queue/detail pages for super, regular and verifier; allowlisted applicant fields; current allowed decisions; immutable review history; unavailable historical evidence; delegated rider-owned image uploads, completion with `{}`, explicit linking and reviewed decisions. |
| Fee pricing | Open a catalogue row to load normalized `/v1/admin/fees/{id}`. Type-specific fields use minor units, PPM or multipliers; read-only fee types remain read-only. `addedSurgeMultiplier` is used, never `addedSurgeMinor`. |
| Office pricing | Current office version with PATCH pickup and per-kilometre charges. |
| Local tariffs | Real service IDs, versioned draft creation, metadata, full snapshots, bounded upsert/delete weight batches, publication, clone and archive. Draft publication checks the endpoint bands at 500 and 70,000 grams. |
| International tariffs | Versioned drafts, zone/weight rates and explicit country mapping batches, publication, clone and archive. Snapshot validation identifies unpriced mapped zones and missing rates/countries. Backend performs authoritative coverage and publication checks. |
| State/country policy | Versioned state-zone remapping and country active/postal policy. State lookup follows opaque pages instead of guessing a detail endpoint. |
| Pricing history | Pricing audit feed with before/after/effects and separate eventual revision watermark. |
| Shipment operations | Backend `allowedAdminActions`, `nativeWriteEligible` and pending commands control the existing stricter super-only UI. Existing progression/cancellation/assessment plus chosen-rider assignment, bounded dispatch correction, exact due-assessment cash receipt, customs intake changes, evidence-based clearance completion and direct local dispatch. |
| Shipment evidence/history | Ready generic assets with the command's native purpose; completion sends no body. Timeline is the supported admin endpoint. Clearance completion has a distinct label/date and is not presented as parcel delivery. No pickup OTP is displayed. |
| Withdrawal reports | JSON/CSV per-page downloads with identical format/status/limit across opaque continuation cursors. No bank details or money transfer actions in exports. |
| Ride reads | Retained incomplete records remain visible with data-quality/unavailable-field information. Unknown amount/version fields stay unavailable. |
| Report preparation | Current coverage, deliberate per-report rebuild with `resume:true`, stable keys and job progress. A 503 keeps totals unavailable; no automatic rebuild on page load. |
| Mobile policy | Editor diagnostics, all app/platform combinations, public-policy check after a reviewed save and on demand. Food/ecommerce flags stay false. |
| Marketplace | Unsupported catalogue/marketplace routes removed from navigation and proxy; old direct routes cannot issue those API requests. |

## Shared interaction and security

The existing design tokens, titled cards, expandable action forms, responsive table scrolling, section pagination, linked IDs, shimmer skeletons and refresh controls are reused. No Firebase client or public backend-origin environment variable is introduced.

All added mutations use the same-origin cookie proxy, exact allowlisted methods/paths and stable idempotency keys. DELETE rate/country operations retain their JSON bodies. On conflict, forms retain their draft, load the latest authoritative record and require an explicit reviewed resubmission with a new key. Validation errors retain their field details and request reference. The proxy independently enforces the dashboard's super-only shipment mutations and existing closed-ticket rules; the backend remains the authority for all resource/target permissions.

## Remaining scope and acceptance

1. The matching backend API/worker, migrations 100–102 (and predecessors) and runtime grants must be deployed for these contracts to work. Source availability does not establish deployment; the earlier error audit remains a dated observation.
2. Backend constraints still exclude marketplace administration, NIN/BVN, arbitrary wallet balance edits, new account block/delete commands, directory text search, exact page totals, arbitrary country/type/zone creation and unrestricted shipment status rewrites. Unsupported fee types remain read-only.
3. Available rider selection uses the native directory UID. There is no dedicated eligibility search; assignment eligibility/capacity is checked by the command. The UI does not infer eligibility from a row.
4. Backend acceptance must verify provider delivery, revoked sessions, private-media ownership/ACLs, scanning failure, financial ledger effects, quote price locks, active destination coverage and worker settlement against approved staging records. Local browser fixtures do not establish these live effects.
5. Generic asset uploads can be deleted while unattached. The delegated rider contract provides no delete operation; removing one from the form discards the local draft reference without deleting another account's asset.

## Validation

Validation results are recorded after the focused browser run and production build. No live business mutations are used by those tests.

## Rider approval conflicts

A 409 with “State changed or the idempotency key was reused; reload before retrying” is not proof of a stale version. It can also mean the approval prerequisites are missing. The application screen uses the returned `allowedDecisions` and `approvalBlockers` before offering approval and reloads both immediately before a new review attempt. The two document kinds are `vehicle_photo` and `plate_number`; profile-field heuristics and license images do not override server eligibility.

A failed approval preserves its reason and request reference. The conflict review reads the application again, displays current requirements, and blocks a fresh attempt while visible prerequisites are missing. Correct the account/evidence and refresh the application; a new reviewed attempt uses the current version and a fresh key. Transport retries of the same uncertain attempt retain their key and body. The example request reference `3fd558da3cb5d3402c7e591b0863fd3f` alone does not identify which prerequisite failed.

## Presentation follow-ups

Long identifiers and references retain readable shared table-column widths; wide records scroll inside their table rather than forcing one-character ID columns or page overflow. Tariff rate lists use the same table primitives as the rest of the app. Loading tables retain those column widths.

Enum labels are presented through field-specific mappings, including verification/vehicle/ride/fee ordinals and readable string statuses, roles, services, payment methods, tariff states and local zones. Original values remain in requests. Identifiers, versions, amounts and free text are not treated as enum ordinals; unknown enum values are shown as unknown instead of being guessed.

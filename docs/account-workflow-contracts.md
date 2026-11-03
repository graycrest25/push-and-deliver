# Account, rider and support workflow contracts

Updated 3 November 2026. This is a frontend integration specification, not a claim that proposed routes exist or have been deployed.

The UI follows the earlier Firebase account header, personal information, vehicle/documents, verification, wallet and transaction sections, using the current PushNDeliver components and tokens. Firebase is not reintroduced. NIN/BVN collection and verification remain removed.

## What works now

| Workflow | Existing endpoint | Request | Response used |
| --- | --- | --- | --- |
| Users and riders | `GET /v1/admin/users` | `?type=users` or `?type=riders`, optional `limit`, `cursor`; no body | `data.items`, `data.nextCursor`, `data.hasMore` |
| Profile summary | `GET /v1/admin/users/{uid}` | `?type=users` or `?type=riders`; no body | `data.uid`, `username`, `phoneNumber`, `email`, `identityExists`, `emailVerified`, `disabled`, `deleted`, `verificationStatus`, `createdAt` |
| Selected account's administrator membership | `GET /v1/admin/users/{uid}/role` | No query or body; super only | `data: {uid,email,isAdmin,adminType,version}` |
| Grant, change or remove admin membership | `POST /v1/admin/users/{uid}/role` | `{ "adminType": "regular", "expectedVersion": 3, "reason": "Assign operations responsibility" }`; super only | `data: {uid,email,isAdmin:true,adminType:"regular",version:4}` |
| Support queue | `GET /v1/admin/support/tickets` | `status=open|closed`, `limit`, `cursor` | `data.items`, `nextCursor`, `hasMore` |
| Ticket and conversation | `GET /v1/admin/support/tickets/{id}` and `GET .../{id}/messages` | Messages accept `limit`, `cursor` | Ticket `data.status`, `version`, `assignedSupportUid`; messages `data.items` |
| Close/reopen | `PUT /v1/admin/support/tickets/{id}/status` | `{ "status": "open", "expectedVersion": 2 }` | Updated ticket status/version |

Role changes accept `super`, `regular`, `customercare`, `verifier`, or explicit `null` to remove access. A fresh role GET supplies the expected version; mutations retain their idempotency key on retries. The existing backend revokes the target's sessions on actual membership changes. The UI never infers membership from directory rows.

These are documented in [the current backend reference](../../pnd-backend/docs/admin-api-update-reference.md#account-directory-and-exports) and its [role management](../../pnd-backend/docs/admin-api-update-reference.md#admin-role-management) and [support](../../pnd-backend/docs/admin-api-update-reference.md#support-dashboard) sections. The reference's latest enum section defines verification 0 = Unverified, 1 = Verified, 2 = Blocked, 3 = Deleted, including their numeric-string forms; missing/unrecognized values show Unknown.

Directory access currently remains super/regular according to the mounted contract. A verifier or customer-care account is not granted directory access merely because the old Firebase UI exposed it.

## Remaining backend work (proposed contracts)

All JSON examples below are proposed shapes. Reads have no body. Responses use `{ "data": ..., "requestId": "..." }`; paginated reads return `{items,nextCursor,hasMore}`. Native UIDs must be used, not internal wallet or SQL actor IDs. Amounts are integer minor units and carry a currency. Dates are RFC3339; birth dates are calendar `YYYY-MM-DD`.

All requests pass through the existing same-origin Next proxy. Only the server supplies `Authorization: Bearer ...` and `X-Account-Type: user`. Writes require `Idempotency-Key`, JSON, a reason when changing account/review state and an authoritative `expectedVersion`. Proposed routes are deliberately not added to the proxy allowlist before the backend publishes their contracts.

### 1. Full account and rider details

**Update** `GET /v1/admin/users/{uid}?type=users|riders` additively, or publish a separate versioned detail route. Current response only supplies a summary; it does not supply the old profile, vehicle, bank or application documents.

Proposed response:

```json
{
  "data": {
    "uid": "rider-uid", "accountType": "rider", "username": "Example Rider",
    "phoneNumber": "+2348000000000", "email": "rider@example.test",
    "identityExists": true, "emailVerified": true, "disabled": false,
    "deleted": false, "verificationStatus": 0, "version": 7,
    "createdAt": "2026-11-03T07:00:00Z",
    "profile": {
      "dateOfBirth": null, "homeAddress": null, "stateOfOrigin": null,
      "localGovernment": null, "photoAssetId": null,
      "nextOfKin": { "name": null, "phoneNumber": null, "address": null }
    },
    "vehicle": {
      "type": 2, "make": null, "model": null, "color": null,
      "plateNumber": null, "chassisNumber": null, "engineNumber": null,
      "condition": null
    }
  },
  "requestId": "example-request-id"
}
```

The backend must document nullable fields, the authoritative vehicle enum and account-context resolution. Do not return password/PIN hashes, device push tokens or raw historical documents. A rider UID is not assumed to be a customer UID with the same spelling. Non-rider records return `vehicle: null`.

UI now: grouped personal information and verification from supported fields; vehicle/document information explicitly unavailable.

### 2. Edit rider/user information and vehicle details

**Add** `PUT /v1/admin/users/{uid}/profile?type=users|riders` for super/regular. Use a nested `changes` object to distinguish omitted fields from explicit clearing.

```json
{
  "expectedVersion": 7,
  "reason": "Correct customer-confirmed contact details",
  "changes": {
    "username": "Corrected Name",
    "phoneNumber": "+2348000000001",
    "email": "corrected@example.test",
    "homeAddress": "Updated address",
    "nextOfKin": { "name": "Example Contact", "phoneNumber": "+2348000000002", "address": null }
  }
}
```

Success `200`: `{ "data": { "uid": "rider-uid", "version": 8, "changedFields": ["username","phoneNumber","email","homeAddress","nextOfKin"], "emailVerificationRequired": true }, "requestId": "..." }`.

**Add** `PUT /v1/admin/riders/{uid}/vehicle`:

```json
{
  "expectedVersion": 8,
  "reason": "Correct vehicle registration",
  "changes": { "color": "Blue", "plateNumber": "EXAMPLE123", "make": "Example", "model": "Example model" }
}
```

Success `200`: `{ "data": { "uid": "rider-uid", "version": 9, "vehicle": { "color": "Blue", "plateNumber": "EXAMPLE123", "make": "Example", "model": "Example model" } }, "requestId": "..." }`.

Backend must validate allowlisted fields, lengths and E.164 phones; enforce identity uniqueness; define email/phone reverification and session revocation; synchronize identity/profile atomically; audit actor and changed fields; reject stale writes with `409`. Reject empty updates and forbidden fields. Return field errors and preserve the draft after failure. Do not let this route modify balance, admin role or verification approval.

UI now: labelled name/phone/email editor preview with disabled save and an explicit unsaved notice. No request is sent to an invented endpoint. Other profile and vehicle edits remain blocked pending this contract.

### 3. Rider application review, evidence and review history

**Add** `GET /v1/admin/riders/{uid}/application` (super/regular/verifier). Proposed response:

```json
{
  "data": {
    "uid": "rider-uid", "applicationId": "application-1", "version": 4,
    "status": "pending", "verificationStatus": 0,
    "submittedAt": "2026-11-03T07:00:00Z",
    "documents": [
      { "kind": "driver_license", "assetId": "asset-1", "contentType": "image/jpeg", "available": true },
      { "kind": "vehicle_photo", "assetId": null, "contentType": null, "available": false }
    ],
    "allowedDecisions": ["approve", "reject"]
  }, "requestId": "..."
}
```

**Add** `POST /v1/admin/riders/{uid}/application/review`:

```json
{ "decision": "reject", "reason": "Licence image is unreadable", "expectedVersion": 4 }
```

Success `200`: `{ "data": { "uid": "rider-uid", "applicationId": "application-1", "status": "rejected", "verificationStatus": 0, "version": 5, "reviewedBy": "admin-uid", "reviewedAt": "2026-11-03T08:00:00Z" }, "requestId": "..." }`.

**Add** `GET /v1/admin/riders/{uid}/application/reviews?limit=25&cursor=...` returning `data: {items:[{id,decision,reason,reviewedBy,reviewedAt}],nextCursor:null,hasMore:false}`.

The backend must define allowed transitions, approval prerequisites and resulting verification states. Blocking/deleting an account must not be silently equated with rejecting an application. Implement a separately authorized account-status command if those controls are required.

Extend the existing asset intent/completion/media contracts with explicit rider-document purpose and target ownership; publish the exact allowed purpose, target UID and link-operation fields. Suggested link command: `PUT /v1/admin/riders/{uid}/application/documents/{kind}` with `{assetId,expectedVersion,reason}` and response `{uid,kind,assetId,version}`. Ready assets only, with server validation of ownership, content type, purpose and reviewer access. Downloads use existing `GET /v1/media/{assetId}/content` via the proxy. Unavailable historical media must not break the whole application. No NIN/BVN routes or fields.

For verifier workflow discovery, update directory/detail permissions and add a supported application filter or a distinct `GET /v1/admin/riders/applications?status=pending&limit=25&cursor=...` returning `{items:[{uid,username,applicationId,status,submittedAt}],nextCursor,hasMore}`. Current read-only directories do not authorize this workflow.

UI now: verification labels and unavailable application/documents state; approval/rejection disabled.

### 4. Target account wallet and transactions

**Add** `GET /v1/admin/users/{uid}/wallet?type=users|riders`, initially super/regular:

```json
{ "data": { "uid": "rider-uid", "accountType": "rider", "currency": "NGN", "availableMinor": 125000, "pendingMinor": 25000, "asOf": "2026-11-03T08:00:00Z" }, "requestId": "..." }
```

**Add** `GET /v1/admin/users/{uid}/transactions?type=users|riders&limit=25&cursor=...`:

```json
{
  "data": {
    "items": [{ "id": "txn-1", "direction": "credit", "amountMinor": 10000, "currency": "NGN", "status": "completed", "narration": "Delivery payment", "reference": "reference-1", "createdAt": "2026-11-03T07:00:00Z", "relatedOrder": { "id": "shipment-1", "type": "shipment" } }],
    "nextCursor": null, "hasMore": false
  }, "requestId": "..."
}
```

Require account ownership scope, stable ledger ordering, reversal semantics and explicit currency/status/type documentation. Customer self-service `GET /v1/wallet` or `/v1/wallet/transactions` must not be reused: that would read the signed-in administrator's wallet. No balance edits or arbitrary credits are introduced.

If restoring bank information, add `GET /v1/admin/users/{uid}/payout-destination?type=riders` returning `{bankName,accountName,accountNumberMasked,verified,updatedAt}` to explicitly authorized financial admins. Do not return full bank numbers in the general profile; current withdrawal claim-based bank access remains separate.

UI now: wallet and transaction sections say unavailable rather than displaying zero or an empty financial history.

### 5. Separate administrator and non-administrator lists

**Update** `GET /v1/admin/users` for super-only optional membership filters, or publish a dedicated equivalent. Suggested request:

`GET /v1/admin/users?type=users&membership=admins&adminType=regular&limit=25&cursor=...`

`membership=all|admins|non_admins`; `adminType=super|regular|customercare|verifier` only valid for `admins`. Optional supported search must be explicitly specified, scoped to these filters and cursor. Proposed response:

```json
{ "data": { "items": [{ "uid": "user-1", "username": "Example Admin", "email": "admin@example.test", "isAdmin": true, "adminType": "regular", "identityExists": true, "emailVerified": true, "disabled": false }], "nextCursor": null, "hasMore": false }, "requestId": "..." }
```

Do not filter a single page of all accounts on the frontend and call that a complete admin list. Bind cursors to filters. Preserve the existing unfiltered super/regular directory contract. Current membership GET/POST already works and should be reused, not recreated. Define self-demotion and last-super-admin safeguards on the server.

UI now: all-user directory selection and authoritative role editor; separate Administrators view explains the missing list. Ordinary user profile pages expose role management only to super admins.

### 6. Closed support tickets: super-admin only

**Update existing endpoints**, not new routes:

- `GET /v1/admin/support/tickets`: non-super admins can receive only open tickets. Reject explicit `status=closed` with `403`; omit closed metadata, message snippets and counts from all results. Preserve valid pagination over the authorized set.
- `GET /v1/admin/support/tickets/{id}` and `GET .../{id}/messages`: reject a closed ticket for every non-super admin, including the formerly assigned agent.
- `PUT .../{id}/status`: `closed -> open` requires current super membership; normal authorized agents can still close an open ticket. Use the existing `{status,expectedVersion}` body and increment the version.
- `POST .../{id}/claim`, `POST .../{id}/messages`, and ticket-scoped attachment downloads through `GET /v1/media/{assetId}/content`: enforce the same closed-ticket authorization, including previously issued media references.

Denied response:

```json
{ "error": { "code": "closed_ticket_restricted", "message": "Only a super administrator can view or reopen a closed ticket." }, "requestId": "..." }
```

Recheck current membership and ticket state inside the read/write authorization boundary; a ticket may close between a proxy preflight and a backend mutation. Define attachment access after closing and revoke or bound cached signed access. This is a backend security requirement, not something hiding a button can guarantee.

Implemented now: the Next proxy reads authoritative `/v2/auth/session` on support requests; forces non-super list requests to `status=open`; rejects closed filters; verifies ticket state before detail/messages/claim/status; strips unexpected closed rows; and blocks the obsolete customer-support route alias. The UI hides closed-ticket filters for non-super admins and refuses to render closed conversation content. These controls do not replace atomic native enforcement or recall content already viewed while open. Direct backend clients and the media authorization changes still require backend work.

### 7. Linked IDs and list navigation

No new endpoint is needed for known native user/rider/ride/shipment IDs: links use existing detail routes. Tables now link typed customer/user IDs, rider IDs, known order IDs, and primary IDs with an established detail route; links respect the current administrator's allowed destinations.

For ambiguous order references, **update the producing response** to include `relatedOrder: {id,type}` (or explicitly documented `orderId` plus `orderType`), where `type` identifies `shipment`, `food`, `ecommerce`, `ridehailing` or `courier`. Internal actor IDs must not be labelled as user UIDs. Referral responses also need the referrer's account type when they may point to riders. The frontend must not guess an ambiguous order's destination.

Support View opens `?ticket={id}` beside the queue, with a Close details button and a separate conversation dialog. On mobile, the panel follows the table. Closing restores focus to View; opening/closing does not reset the queue. Existing direct conversation URLs remain supported.

Pagination, applied filters, page size and table scroll are kept in memory for the active section. Visiting a detail and using Back preserves that state; switching section or signed-in identity clears it. Reloading the whole browser document starts fresh. Cursor APIs do not provide total pages, so the UI shows the current page and returned record count, not an invented “of 5”. If exact totals are required, add an authoritative `totalItems`/`totalPages` contract tied to the same filter and snapshot.

## Validation and rollout

Local browser tests cover profile unknown states and edit preview, valid verification labels, role selection, linked record destinations, return-to-page behavior and section reset, and server-side closed-ticket denial for regular/customer-care versus super reopening. Production/deployed acceptance and the proposed contracts above remain separate backend work. No live account, wallet, role or ticket mutations were performed for this implementation.

Verification completed: 46 unique browser cases passed across the full run and focused reruns after correcting test expectations/selectors and the conversation focus behavior. TypeScript, the production build and `git diff --check` passed. Desktop/mobile profile and support-panel screenshots were inspected in two bounded passes. Scanning 23 compiled browser bundles found zero occurrences of the configured backend address. These are local fixture checks, not deployed-backend verification.

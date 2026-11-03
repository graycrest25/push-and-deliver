# Shipment details and status changes

Updated 3 November 2026. Source audit of the current native checkout; not deployed-backend verification. The frontend keeps the existing PushNDeliver design and restores the former Firebase detail groups without reintroducing browser Firebase access.

## Implemented

The list uses the native `id` (clickable), shipment type, status, total amount and creation date. The list response does not include `shipmentNumber` or `customerId`, so those empty columns were removed. Filters send `shipmentType`, `status`, `limit` and `cursor` to `GET /v1/shipments`.

The status dropdown uses all seven native enum names:

| API value | Label |
| --- | --- |
| `placed` | Placed |
| `acceptedByRider` | Accepted by rider |
| `sentToHq` | Sent to HQ |
| `onrouteToDestination` | En route to destination |
| `deliveredToDestination` | Delivered to destination |
| `cancelled` | Cancelled |
| `onRouteToPndHQ` | En route to PND HQ |

The detail page restores status/payment/amount summaries, order information, customer and receiver, locations, package/documents, payment information, rider information, and dates. Customs clearance omits the receiver, route and package placeholders that the native response deliberately does not provide. Local orders include the local service, zone and state. Null amounts remain unavailable; cancelled shipments hide paid/unpaid controls. IDs link to authorized account details. Private files continue through the media proxy; raw storage URLs, OTPs and coordinates are not displayed.

Status changes are shown only to super admins in this dashboard, and the Next proxy independently checks `/v2/auth/session` before forwarding these commands. The native backend itself currently authorizes both super and regular shipping admins; change that backend policy as well if super-only must apply to every API client.

All writes use `Authorization: Bearer ...` and `X-Account-Type: user` supplied by the proxy, `Content-Type: application/json`, a stable `Idempotency-Key`, and the latest positive integer `expectedVersion`. `BASE_URL` remains server-only. The frontend reloads the detail after success; a conflict requires refresh before another action. This is not an unrestricted status overwrite.

| Action and precondition | Mounted endpoint | Request body | Success response |
| --- | --- | --- | --- |
| Accept at office: placed, no assigned rider | `POST /v1/shipments/{id}/accept` | `{ "expectedVersion": 3 }` | `200`, `data: {id,status:"sentToHq",version:4,updatedAt}` |
| Confirm arrival: en route to HQ | `POST /v1/shipments/{id}/transitions` | `{ "expectedVersion": 4, "targetStatus": "sentToHq" }` | `200`, `data: {id,status:"sentToHq",version:5,updatedAt}` |
| Dispatch: at HQ, paid, no outstanding assessment | `POST /v1/shipments/{id}/transitions` | `{ "expectedVersion": 5, "targetStatus": "onrouteToDestination" }` | `200`, `data: {id,status:"onrouteToDestination",version:6,updatedAt}` |
| Complete delivery: en route to destination, paid, no outstanding assessment | `POST /v1/shipments/{id}/transitions` | `{ "expectedVersion": 6, "targetStatus": "deliveredToDestination" }` | `200`, `data: {id,status:"deliveredToDestination",version:7,updatedAt,completedAt,settlementStatus:"pending"}` |
| Early cancellation: placed or accepted by rider | `POST /v1/shipments/{id}/cancel` | `{ "expectedVersion": 3, "reason": "Customer requested cancellation" }` | `200`, `data: {id,status:"cancelled",version:4,updatedAt,refund}`; paid cancellations may return a pending refund/job |

Responses use `{data,requestId}`. The backend requires native ownership, current version and no pending assignment/assessment command; it remains the authority for allowed transitions and financial effects. Cancellation reasons must be nonblank and at most 500 bytes. Office acceptance does not assign a selected rider. Pickup verification remains the assigned rider's operation and is not impersonated by an administrator. The `canCancel` field in the current detail DTO is customer-owner scoped; it is not an admin permission flag.

The native transition implementation currently applies the same state sequence to local, international/express and customs shipments. A clearance-only case is not treated as a delivered parcel simply to mark the work complete.

Evidence:

- [Mounted runtime](../../pnd-backend/internal/app/hybrid.go): `a.Shipping.RegisterRoutes` and the shipping-admin authorizer.
- [HTTP routes](../../pnd-backend/internal/shippingcommands/http.go): list/detail, accept, transitions, cancel and assessment.
- [Action request, transitions and financial guards](../../pnd-backend/internal/shippingcommands/actions.go).
- [Native list and detail projection](../../pnd-backend/internal/shippingcommands/queries.go).
- [Enum wire values](../../pnd-backend/internal/store/firestore/enums.go).

## Remaining gaps

1. **Free-form status correction, rollback or skipping stages.** There is no mounted administrator route equivalent to directly rewriting the old Firestore status. Existing transitions should be used for normal progression. If a correction workflow is required, propose `POST /v1/admin/shipments/{id}/status-corrections` with `{expectedVersion,targetStatus,reason,evidenceAssetIds}` and response `{data:{id,status,version,correctionId,updatedAt},requestId}`. Backend must specify allowed type-specific corrections, forbid settlement/refund duplication and audit the before/after states. Do not implement this as an unrestricted field update.

2. **Explicit assignment/reassignment to a chosen rider.** Admin `/accept` is office acceptance. A proposed `POST /v1/admin/shipments/{id}/assignment` would take `{expectedVersion,riderId,reason}` and return `{data:{id,status,version,assignedRider},requestId}`. The backend must validate eligibility, release/reassign dispatch capacity and retain pickup verification rules. No rider-ID entry pretending to call `/accept` was added.

3. **Cash payment confirmation and the old Paid switch.** A customer's `POST /v1/shipments/{id}/payments` is not an administrator cash-receipt API. Propose `POST /v1/admin/shipments/{id}/cash-receipts` with `{expectedVersion,assessmentId,amountMinor,currency,reference,receivedAt,evidenceAssetId,reason}`, returning `{data:{id,version,payment:{status,method,transactionId},receiptId},requestId}`. Require reconciliation against an actual assessed charge, deduplicated ledger posting and an audit trail. Do not expose a boolean Paid/Unpaid overwrite.

4. **Editing customs intake.** No mounted native equivalent of the older customs-update operation was found. Propose `PUT /v1/admin/shipments/{id}/customs` with `{expectedVersion,reason,changes:{clearanceType,description,documentAssetId,invoiceAssetId,packingListAssetId}}`, returning `{data:{id,version,clearanceType,assets,updatedAt},requestId}`. Backend must publish the exact allowed intake fields and enums, lifecycle restrictions and whether a change requires reassessment. These are proposed fields, not an existing contract.

5. **Complete a clearance-only job with evidence.** No distinct mounted command exists. Propose `POST /v1/admin/shipments/{id}/complete-clearance` with `{expectedVersion,reason,evidenceAssetIds,completedAt}`, returning `{data:{id,version,clearanceStatus:"completed",completedAt,evidenceAssetIds},requestId}`. Backend must define separate clearance completion semantics, validate ready assets/ownership/purpose and settled charges, and avoid creating pickup/delivery or rider settlement effects for clearance-only work.

6. **Complete admin status history and available-action metadata.** The mounted `GET /v1/shipments/{id}/timeline` checks customer ownership; it is not an admin-wide history replacement. Extend `GET /v1/shipments/{id}` with `allowedAdminActions`, native write eligibility and a separately authorized history, or add `GET /v1/admin/shipments/{id}/timeline?limit=25&cursor=...`, returning `{data:{items:[{id,status,occurredAt,actorUid,reason}],nextCursor,hasMore},requestId}`. This would also let the UI account for pending commands without guessing from undocumented fields. The page currently shows creation/update/completion/cancellation dates and explicitly marks complete history unavailable.

7. **Local delivery shortcuts.** If the former local workflow needs direct pickup-to-destination or delivery without passing the native HQ states, that is not an authorized bypass in the mounted transition handler. Publish a type-specific state machine and its commands before exposing such shortcuts. Current UI follows the mounted common lifecycle.

Existing but separate from status editing: `POST /v1/admin/shipments/{id}/assessment` is mounted. It takes `{expectedVersion,amountMinor,currency:"NGN",reason,assessmentType:"initial"|"additional_fee",newWeightKg?}` and returns a versioned assessment; it is not a missing endpoint and does not mark a charge paid. Fee editing/assessment remains a separate integration from this status-change request.

## Validation

Local fixture tests cover the documented filters, linked IDs, grouped fields, all three shipment types, status progression, cancellation, stale versions, unpaid dispatch blocking and non-super proxy denial. No live shipment, payment, refund or settlement mutations were performed. Live status-mutation acceptance remains unverified. The separate [3 November read-only audit](admin-endpoint-error-audit-2026-11-03.md) confirms successful shipment list and sampled local, express and customs detail reads.

# Fee, zone and tariff administration: backend work

Checked 3 November 2026 against `admin-api-update-reference.md` and the current native backend checkout. This is a source audit, not a live mutation test.

**The native dashboard has price reads, but no mounted administrator API for editing general fees, office pickup prices, local zone prices, international tariffs or their weight-to-amount entries.** The older standalone service defines some similarly named writes; its route declarations and the frontend proxy allowlist do not establish availability in the native runtime. Do not wire the editor to those routes without a supported native contract.

## Existing reads

| Dashboard section | Mounted GET endpoints | Units |
| --- | --- | --- |
| Fees & pricing | `/v1/admin/rides/fares`, `/v1/admin/shipping/settings` | Both expose the native fee records. `moneyUnit: "major"` means monetary components are NGN naira; percentages and multipliers are dimensionless. `value` depends on `feeType`. |
| Office pickup pricing | `/v1/admin/shipping/offices`, `/v1/admin/shipping/offices/{id}` | `basePickupMinor` and `perKmMinor` are integer kobo. |
| Local zone tariffs | `/v1/admin/geography/states`, `/v1/admin/geography/tariffs`, `/v1/admin/geography/tariffs/{id}`, `/v1/admin/geography/tariffs/{id}/rates` | State `localZone` mapping; tariff `localType`/`zone`; rates use integer `weightGrams` and `amountMinor`. |
| International tariffs | `/v1/admin/shipping/tariffs`, `/v1/admin/shipping/tariffs/{id}`, `/v1/admin/shipping/tariffs/{id}/rates`, `/v1/admin/shipping/tariffs/{id}/countries` | Rates keyed by tariff, zone and integer grams; amounts in integer kobo. Country mappings contain `code` and `zone`. |

The UI keeps these catalogues available for inspection. The following endpoints and payloads are **proposals for backend development**, not existing APIs or confirmed response models.

## Missing contracts, numbered for implementation

1. **Edit individual fees and ride pricing.** Propose `PATCH /v1/admin/fees/{id}` with `{expectedVersion,reason,changes:{perKmMinor,perMinMinor,perWeightMinor,minFareMinor,bookingFeeMinor,addedSurgeMinor,surgeMultiplier}}`. Only applicable fields may be sent. Response: `{data:{id,version,feeType,currency:"NGN",updatedAt,values},requestId}`. Publish a field allowlist and units for each `feeType`, including whether its `value` is currency, a percentage or a multiplier; do not apply one money conversion to every numeric field. Add a versioned read for the editor. If new fee records are supported, also define `POST /v1/admin/fees` with an explicit fee type/schema.

2. **Edit office pickup and distance charges.** Implement a native `PATCH /v1/admin/shipping/offices/{id}/pricing` with `{expectedVersion,basePickupMinor,perKmMinor,currency:"NGN",reason}`. Response: `{data:{id,version,basePickupMinor,perKmMinor,currency,updatedAt},requestId}`. State when the change affects newly created quotes, and preserve amounts already accepted by customers. The old standalone `PUT /v1/admin/shipping/offices/{id}` is not a mounted native replacement.

3. **Create/edit local zone tariff drafts and add weight-to-amount entries.** Propose `POST /v1/admin/geography/tariffs` with `{localType,zone,volumetricDivisor,reason}` returning `{data:{id,version,status:"draft",localType,zone,volumetricDivisor},requestId}`. Propose `PUT /v1/admin/geography/tariffs/{id}/rates` with `{expectedVersion,reason,rates:[{weightGrams:500,amountMinor:150000},{weightGrams:1000,amountMinor:250000}]}` returning `{data:{id,version,status:"draft",rateCount,updatedAt},requestId}`. Specify explicitly whether this replaces the entire set or upserts entries. Prefer a separate delete operation if the contract is upsert-based. Publish the weight-boundary/rounding rules and reject duplicate or invalid weights.

4. **Create/edit international tariff drafts, country zones and weight prices.** Propose `POST /v1/admin/shipping/tariffs` with `{name,carrier,direction,cargo,volumetricDivisor,reason}` returning a versioned draft. Propose `PUT /v1/admin/shipping/tariffs/{id}/rates` with `{expectedVersion,reason,rates:[{zone:1,weightGrams:500,amountMinor:1250000}]}` and `PUT /v1/admin/shipping/tariffs/{id}/countries` with `{expectedVersion,reason,countries:[{code:"GB",zone:1}]}`. Responses: `{data:{id,version,status:"draft",rateCount|countryCount,updatedAt},requestId}`; `rateCount|countryCount` denotes the field appropriate to that operation, not a literal JSON key. Define allowed carrier/direction/cargo values, uniqueness, missing-zone behavior, and replace-versus-upsert semantics. Weight bands must remain compatible with the quote calculator.

5. **Publish tariff changes and preserve historical prices.** Provide native `POST /v1/admin/geography/tariffs/{id}/publish` and `POST /v1/admin/shipping/tariffs/{id}/publish` with `{expectedVersion,reason}` returning `{data:{id,version,status:"active",publishedAt},requestId}`. Validate completeness atomically and define which prior tariff becomes inactive. Active/historical rates referenced by accepted quotes or shipments must not be silently rewritten. Define edit, archive and optional draft-clone operations. The same paths exist in the standalone code but are not registered by the current native runtime.

6. **Change local state/zone membership and maintain bookable countries.** If administrators need these operations, provide native `PATCH /v1/admin/geography/states/{id}` with `{expectedVersion,localZone,reason}` and `PATCH /v1/admin/shipping/countries/{code}` with `{expectedVersion,active,postalCodeRequired,reason}`. Return the updated versioned record. Validate zone references and prevent publishing configurations that leave a bookable destination without a price. Document any separate rules for adding new countries, local service types or zones; existing read-only IDs are not permission to create arbitrary values.

## Shared requirements

- All proposed writes require authoritative admin subtype checks. Specify whether each action allows `regular` and `super`, or only `super`; the frontend must follow the published policy.
- Use bearer authentication and `X-Account-Type: user` through the existing Next proxy, a stable `Idempotency-Key`, and optimistic concurrency via `expectedVersion`. Add authoritative versions to corresponding reads; do not reuse a timestamp or invent a version in the browser.
- Use exact integer minor units for new monetary write contracts, with documented conversion from existing major-unit fee reads. Reject negative/nonfinite values, excessive bounds and duplicate rate keys. Define permitted zero charges explicitly.
- Return structured `400` validation errors, `403` permission errors, `404` missing records, and `409` version/publication conflicts. Audit actor, reason, before/after values and publication effects. Specify cache invalidation and the quote/booking price-lock boundary.
- Current GET rate lists are cursor-paginated. An editor must not replace a tariff using only the visible page; provide a full draft snapshot or explicit bounded upsert/delete commands.

## Existing shipment-specific operation

`POST /v1/admin/shipments/{id}/assessment` is mounted and takes `{expectedVersion,amountMinor,currency:"NGN",reason,assessmentType:"initial"|"additional_fee",newWeightKg?}`. It assesses a charge on one shipment. It does **not** edit global fees, create tariff weight bands or confirm cash payment. Its presence does not close the catalogue-pricing gaps above.

## Source evidence

- [Admin API reference](../admin-api-update-reference.md): November update explicitly adds reads, not pricing/tariff mutations; fee and tariff sections document the units.
- [Native runtime entrypoint](../../pnd-backend/cmd/api/main.go) uses `OpenHybrid`.
- [Native route mounting](../../pnd-backend/internal/app/hybrid.go) and [dashboard registration](../../pnd-backend/internal/dashboard/service.go).
- [Fee read routes](../../pnd-backend/internal/dashboard/operational_reads.go), [office/zone/tariff/rate reads](../../pnd-backend/internal/dashboard/read_models.go).
- Historical standalone writes: [shipping](../../pnd-backend/internal/shipping/http.go), [shipping settings](../../pnd-backend/internal/shipping/batch.go), [geography](../../pnd-backend/internal/geography/http.go), [ride fares](../../pnd-backend/internal/rides/http.go). These are evidence of the old implementation, not native endpoint availability.

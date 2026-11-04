# Reporting summary and readiness UI

Updated 4 November 2026. This records the account-summary and report-coverage frontend work, using the existing native analytics contracts. The user cancelled the proposed backend readiness shell script. No remote readiness commands, backfill jobs or staging verification were executed as part of this work.

## Formatted account summaries

`AccountSummary` retains `GET /v1/admin/analytics/account-summary?type=users` or `type=riders`. Users see total users, new today, new this week and new last week in a compact metric grid. Riders see total, verified, pending and blocked counts plus a vehicle-by-status table. Vehicle values receive readable labels; returned additional vehicle categories are retained. The footer shows calculation time and, for users, signed week-over-week growth rounded to at most one decimal place.

Counts use locale formatting and tabular numerals. Only safe nonnegative integer counts display as numbers: absent, invalid or unavailable values remain **Unavailable**, while a real zero stays zero. Loading uses the existing skeleton, errors retain retry controls, and refresh reloads the same endpoint. Existing shared cards, colors, typography and responsive table behavior remain authoritative.

## Coverage and readiness gates

Super administrators open `/analytics-coverage`, optionally with `?report=order_summary`. Navigation/route policy and proxy authority checks restrict coverage reads and rebuild writes to active super administrators. The selector supports account summary, order summary, referral summary, user activation, order facts and coupon reporting, reading `GET /v1/admin/analytics/coverage?report=<report>` without pagination.

The screen separates Source readiness, Processing diagnostics and Latest backfill into information cards. Readable status labels, locale-formatted counts and shared timestamp formatting replace raw nested records. It shows authoritative/captured record counts, capture/projection pending counts, queue status, processed records, attempts and completion time. The returned coverage basis and timezone remain visible.

Source readiness depends on a successful captured report backfill, current authoritative-source capture and completed analytics projection. The UI exposes `diagnostics.successfulBackfill`, `capturePending` and `projectionPending` independently, while `coverage.complete === true` remains the authoritative completion gate. A 200 coverage response with `complete:false` does not establish usable business totals. Missing diagnostics stay Unknown/Unavailable, and incomplete summary reads such as `503 analytics_not_ready` remain unavailable instead of becoming zero.

## Explicit order rebuild

The maintenance disclosure is an operator action; visiting or refreshing coverage never queues a rebuild. For incomplete order coverage, **Rebuild order reports** sends one command for both shipment and ride/courier summaries:

```http
POST /v1/admin/analytics/backfills
Content-Type: application/json
Idempotency-Key: <command-key>
```

```json
{"report":"order_summary","resume":false}
```

This is one combined report rebuild, not a separate submission for each order type. `202` means job acceptance, not completion. The success receipt preserves the accepted job ID and starts readiness checks. Existing queued/running jobs suppress another rebuild control, and complete order coverage hides it. Other report rebuilds use the selected report and `resume:true`.

Shared `ActionForm` blocks duplicate submissions, persists a random idempotency key under a fingerprint of actor, method, path, exact body and optional `operationScope`, and retains the exact pending path/body/key in memory for uncertain retries. Report rebuilds set that scope to the latest backfill's completion timestamp, or `no-completed-backfill` when none is returned. The scope identifies a command generation: if an uncertain prior submission actually committed and is then observed through completion, a later intentional rebuild receives a new fingerprint and key rather than replaying the completed job. The same pending command still retries its exact body and original key.

The full command body is not stored across form unmounts. Rate limiting honors `Retry-After` when supplied; definitive rejection and conflict retain an error/review state instead of implying accepted work.

## Bounded checks and unavailable totals

After acceptance, or when the latest backfill is already queued/running, the UI polls coverage every 10 seconds for at most two minutes. Requests do not overlap. It stops when coverage completes, the worker fails or the deadline is reached; leaving the report aborts its outstanding read. Timeout offers **Continue checking readiness**, which starts another bounded interval without submitting a rebuild.

`queueStatus:"dead"` displays Failed, and either a dead queue job or failed backfill produces an alert asking the operator to investigate before another rebuild. Missing queue state, absent history and unavailable processed counts remain explicit. Timeout leaves the report unavailable; acceptance, processed counts or a completed-looking queue label cannot substitute for complete coverage.

Once order coverage is complete, the screen refreshes both existing summary reads independently:

| Type | Existing GET |
| --- | --- |
| Shipments | `/v1/admin/analytics/order-summary?type=shipment` |
| Rides and courier | `/v1/admin/analytics/order-summary?type=ride-courier` |

These paths and type values are unchanged. Each successful response supplies its own total; a failed or malformed counterpart stays Unavailable with an error when applicable. The overview also retains its existing reads and links to order coverage for readiness work. The UI does not infer unavailable totals from another category or extend reporting to unsupported food/ecommerce scopes.

## Verification limits

TypeScript and all seven focused mocked browser cases in `tests/native-overview.spec.ts` and `tests/native-coverage.spec.ts` passed across targeted runs. Independent design and source review returned **ship**. Mocked coverage states and accepted-job fixtures do not prove backend capture, worker health, real source completeness or live readiness. No staging success or completed remote rebuild is claimed.

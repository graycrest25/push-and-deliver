# Admin access

`GET /v2/auth/session` now supplies authoritative `isAdmin` and nullable `adminType`. The webapp accepts only `super`, `regular`, `customercare`, and `verifier`, after checking the active user-context session and matching profile UID. Missing or inconsistent membership remains blocked. Roles are never inferred from permissions, tokens, browser storage or endpoint failures.

| Subtype | New dashboard modules |
|---|---|
| Super | Releases/editor, roles, coupons, signup bonus funding, support, native directories/exports, rides/configuration reads, audit and coverage/rebuilds |
| Regular | Coupons, support, native directories/exports, rides and shipping/geography/fee reads |
| Customer care | Support; existing separately authorized order/withdrawal/report reads. The new directory endpoints require super/regular. |
| Verifier | Existing supported report view; the new directory, audit and management modules do not grant verifier access. |

Super admins manage access with `GET/POST /v1/admin/users/{id}/role`, using an existing UID, current version and reason. A null subtype removes admin access. Actual membership changes invalidate the target's sessions. The private operator-key endpoint is never used by the browser.

UI visibility is a convenience; the backend authorizes every request. Older screens still need native reconciliation independently of these roles. See [integration status and remaining gaps](docs/api-migration.md).

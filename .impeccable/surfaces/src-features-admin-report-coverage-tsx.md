---
version: 1
slug: "src-features-admin-report-coverage-tsx"
primary_target: "src/features/admin/report-coverage.tsx"
related_targets: ["src/features/admin/native-read-models.tsx"]
---

# Report coverage

Mode: Operate. Refine the existing report-coverage screen using the incumbent dashboard system.

## Direction contract

THESIS: Make source readiness and the reason for unavailable totals understandable before an operator requests a rebuild.

OWN-WORLD: Existing information cards, semantic colors, labels, badges, shared actions and restrained tables. Preserve both themes and the route's super-only authority.

STORY: Choose a report, read the authoritative completeness flag, inspect backfill/capture/projection checks and the latest job. For order summaries explicitly queue one rebuild for both order types, poll readiness, then read both totals.

FIRST VIEWPORT: Report selector and refresh share one toolbar. Source readiness and three labelled checks form a full-width section. Processing diagnostics and Latest backfill sit alongside on desktop and stack on mobile. Maintenance is a secondary action; errors, pending polling and timeout/failure states remain prominent.

FORM: Precisely requested local formatting and readiness-flow extension. Order rebuilds send report=order_summary and resume=false, never automatically on a 503. Pending/running jobs poll every ten seconds for at most two minutes; dead jobs surface investigation. Unavailable totals remain unavailable. No backend shell script is executed.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

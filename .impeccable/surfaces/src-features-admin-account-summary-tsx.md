---
version: 1
slug: "src-features-admin-account-summary-tsx"
primary_target: "src/features/admin/account-summary.tsx"
related_targets: ["src/features/admin/native-operations.tsx"]
---

# Account summary

Mode: Operate. Local refinement of Overview and Account reports in the existing dashboard.

## Direction contract

THESIS: Replace a tall raw nested account record with directly comparable totals and a labelled vehicle breakdown.

OWN-WORLD: Preserve existing semantic surfaces, type, controls, borders and both themes. Use one information card, a compact definition-list summary and a real data table.

STORY: Select users or riders, scan actual returned totals and verification counts, compare Car/Bicycle/Motorbike rows, and refresh with the calculation time visible.

FIRST VIEWPORT: Existing account selector above a compact Account totals card. Rider total, verified, pending and blocked counts form one summary strip. A vehicle-by-status table follows; the calculation timestamp is a quiet footer. Users show returned period counts and actual growth. Mobile keeps the summary readable and scrolls only the table if necessary.

FORM: Precisely requested local component correction from the user's screenshot. Do not invent counts, derive unavailable totals or replace API errors with zeros.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

---
version: 1
slug: "src-features-admin-pricing-tsx"
primary_target: "src/features/admin/pricing.tsx"
related_targets: ["src/features/admin/shared.tsx", "src/features/admin/international-tariff-prices.tsx", "src/features/admin/tariff-pdf-import.tsx", "src/features/admin/tariff-pdf-preview.tsx"]
---

# Tariff workflows

Mode: Operate. Simplify tariff creation and editing within the existing workspace identity.

## Direction

Open the primary task immediately. Use plain labels, named service choices and a visible price row. Separate publishing from saved draft edits; group metadata and maintenance as secondary tasks. Replace repeated boxed action panels with flat disclosures throughout the shared component. Keep brand, themes, focus, permission checks and native controls.

Creating or cloning leads to the editable draft. Domestic weight fields use kilograms; monetary entry stays in naira with integer-kobo payloads. International price edits retain their zone/gram keys and open outside narrow table cells. PDF imports retain preview, explicit publication, version validation and safe retry behavior; success leads to the replacement tariff.

## Verification

Use local API fixtures to check payloads, draft retention, version conflicts and retries. Inspect desktop and mobile, light and dark themes, plus another screen using the shared disclosures. Local evidence does not establish backend deployment or live publication.

Confirmed the simplified desktop/mobile flows in light and dark themes, the shared approval forms, PDF table, and international editor. Keyboard disclosure preserves fields; selected tabs stay visible on narrow screens. Creation uses complete service choices and supports refreshing them without losing entries. API fixture checks cover create, clone, partial updates, explicit deletes, version conflicts, uncertain retries and PDF publication. Final help dialogs show all relevant text with one Close control, preserve draft fields and return focus. TypeScript and the production build pass.

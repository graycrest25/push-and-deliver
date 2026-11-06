---
version: 1
slug: "src-features-admin-support-conversation-tsx"
primary_target: "src/features/admin/support-conversation.tsx"
related_targets: ["src/features/admin/native-dashboard.tsx"]
---

# Support conversation

Mode: Operate. Extend the existing support workflow and preserve the dashboard's visual system and API permissions.

## Direction contract

THESIS: A claimed ticket becomes a dedicated conversation with a chronological message thread and a persistent reply composer.

OWN-WORLD: Inherit PushNDeliver semantic blue, card and muted surfaces, typography, buttons and borders in both themes. Customer messages sit left, support replies right.

STORY: Open ticket details in the queue, claim and enter its conversation, read context, reply and resolve. Retain super-only access to closed tickets and assignment checks on attachments.

FIRST VIEWPORT: Back navigation and customer heading above one chat surface. A compact header holds status, refresh and close/reopen. Messages fill the center; the reply composer anchors its bottom. Ticket identifiers sit in a collapsible details section rather than above every message.

FORM: Existing chat conventions specified by the user; no new visual identity or direction selection. Claiming from the queue navigates to the conversation page. Mobile retains a readable thread and reachable composer without horizontal overflow.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

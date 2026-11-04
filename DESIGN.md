---
name: PushNDeliver
description: "Blue wayfinding for an administration workspace"
colors:
  background: "#f4f7fc"
  foreground: "#1c2947"
  card: "#ffffff"
  card-foreground: "#1c2947"
  popover: "#ffffff"
  popover-foreground: "#1c2947"
  primary: "#445caa"
  primary-foreground: "#ffffff"
  secondary: "#e9f2ff"
  secondary-foreground: "#334a89"
  muted: "#edf2f8"
  muted-foreground: "#596781"
  accent: "#e4effe"
  accent-foreground: "#334a89"
  destructive: "#bd343b"
  border: "#dde5f1"
  input: "#ccd7e7"
  ring: "#445caa"
  chart-1: "#445caa"
  chart-2: "#25846e"
  chart-3: "#b47a18"
  chart-4: "#7e91c9"
  chart-5: "#b4dafd"
  sidebar: "#ffffff"
  sidebar-foreground: "#30405d"
  sidebar-primary: "#445caa"
  sidebar-primary-foreground: "#ffffff"
  sidebar-accent: "#e7f1ff"
  sidebar-accent-foreground: "#334a89"
  sidebar-border: "#dde5f1"
  sidebar-ring: "#445caa"
  brand-soft: "#b4dafd"
  success: "#24745d"
  success-soft: "#e7f5ef"
  warning: "#8b5c10"
  warning-soft: "#fff5dc"
  dark-background: "#111a2d"
  dark-foreground: "#e8effc"
  dark-card: "#19243a"
  dark-card-foreground: "#e8effc"
  dark-popover: "#19243a"
  dark-popover-foreground: "#e8effc"
  dark-primary: "#b4dafd"
  dark-primary-foreground: "#182849"
  dark-secondary: "#263954"
  dark-secondary-foreground: "#d6e8ff"
  dark-muted: "#233148"
  dark-muted-foreground: "#a8b8d1"
  dark-accent: "#293c5e"
  dark-accent-foreground: "#dcecff"
  dark-destructive: "#f58c94"
  dark-border: "#34425a"
  dark-input: "#40516d"
  dark-ring: "#b4dafd"
  dark-chart-1: "#b4dafd"
  dark-chart-2: "#77d3b7"
  dark-chart-3: "#f3cd7b"
  dark-chart-4: "#99abe6"
  dark-chart-5: "#7dace6"
  dark-sidebar: "#152037"
  dark-sidebar-foreground: "#d8e3f5"
  dark-sidebar-primary: "#b4dafd"
  dark-sidebar-primary-foreground: "#182849"
  dark-sidebar-accent: "#293c5e"
  dark-sidebar-accent-foreground: "#dcecff"
  dark-sidebar-border: "#34425a"
  dark-sidebar-ring: "#b4dafd"
  dark-success: "#93dec4"
  dark-success-soft: "#213e3a"
  dark-warning: "#f3cd7b"
  dark-warning-soft: "#413722"
  navigation-hover: "#364e99"
  welcome-foreground: "#233d75"
  dark-welcome: "#263b66"
  dark-welcome-foreground: "#e5f1ff"
typography:
  auth-display:
    fontFamily: "\"Segoe UI\", -apple-system, BlinkMacSystemFont, Arial, sans-serif"
    fontSize: "3.5rem"
    fontWeight: 650
    lineHeight: 1.08
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "\"Segoe UI\", -apple-system, BlinkMacSystemFont, Arial, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  headline-mobile:
    fontFamily: "\"Segoe UI\", -apple-system, BlinkMacSystemFont, Arial, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  body:
    fontFamily: "\"Segoe UI\", -apple-system, BlinkMacSystemFont, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  table-body:
    fontFamily: "\"Segoe UI\", -apple-system, BlinkMacSystemFont, Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  navigation:
    fontFamily: "\"Segoe UI\", -apple-system, BlinkMacSystemFont, Arial, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "\"Segoe UI\", -apple-system, BlinkMacSystemFont, Arial, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "normal"
rounded:
  "sm": "0.5rem"
  "md": "0.625rem"
  "lg": "0.75rem"
  "xl": "1rem"
  "insights": "0.875rem"
  "pill": "9999px"
spacing:
  "2": "0.5rem"
  "3": "0.75rem"
  "4": "1rem"
  "5": "1.25rem"
  "6": "1.5rem"
  "7": "1.75rem"
  "8": "2rem"
  "12": "3rem"
components:
  "button-primary":
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
    height: "36px"
  "button-secondary":
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.secondary-foreground}"
    rounded: "{rounded.md}"
  "button-outline":
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
  "input":
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "0.25rem 0.75rem"
    height: "40px"
  "navigation-active":
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    height: "40px"
  "card":
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-foreground}"
    rounded: "{rounded.xl}"
    padding: "1.5rem"
  "chip-secondary":
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.secondary-foreground}"
    rounded: "{rounded.pill}"
    padding: "0.125rem 0.5rem"
  "page-insights":
    backgroundColor: "{colors.card}"
    rounded: "{rounded.insights}"
    padding: "1.25rem"
---

# Design System: PushNDeliver

## Overview

**Creative North Star: "Blue wayfinding"**

Blue wayfinding uses the approved brand blues to identify actions and destinations across the operations workspace. Cool surfaces, restrained borders, grouped destinations, and readable records establish hierarchy without adding production claims or data.

This record describes the completed code. The token authority remains src/index.css; light tokens use their semantic names, and dark tokens are recorded with the dark- prefix. The dark theme also retains fixed brand-blue selected navigation and a dedicated blue welcome surface.

**Key Characteristics:**
- Grouped, role-filtered destinations and a keyboard page finder.
- Cool layered surfaces with compact operational controls.
- Separate action, success, pending, error, and neutral roles.

## Colors

### Primary
Brand blue identifies actions, selected destinations, and the public authentication brand panel. Supporting blue supplies selection and welcome material. Dark mode promotes the supporting blue to the semantic primary. The fixed navigation selection remains brand blue in both modes; its hover uses navigation-hover.

### Secondary
Secondary surfaces and their paired foregrounds organize summaries and status panels. Accent surfaces distinguish hover, focus, and page-finder selection.

### Neutral
Background is the cool workspace ground; card and popover are work surfaces. Foreground supplies record text, muted-foreground supplies supporting text, border separates regions, and input distinguishes field strokes. Sidebar has its own paired tokens. All exact light and dark values are normative in the frontmatter.

Green success and its soft surface signal completed or clear work. Amber warning and its soft surface signal pending attention. Destructive marks errors, rejection, and destructive actions. Neutral marks blocked or inactive records; accompanying words retain the meaning. The chart-1 through chart-5 mappings provide the existing chart series vocabulary.

**The State Role Rule.** Status color describes the record state; primary blue identifies actions and destinations.

## Typography

One familiar sans stack is used throughout. The exact stack and observed reusable hierarchy are in the frontmatter. Workspace headings use headline, reducing to headline-mobile below 768px. Labels and table headings use the smaller label role; navigation uses its own compact size. Table records use table-body, and controls use medium weight. Tabular numerals align metrics, queues, table values, and pagination.

Authentication is an intentional exception to the compact workspace ramp: its desktop brand heading uses auth-display. The brand panel disappears below 1024px rather than forcing that heading onto small screens. Dashboard welcome titles use 24px/600 on desktop and 22px on mobile. No distinct display or mono font is shipped.

## Layout

The desktop sidebar is 264px wide. The workspace header is sticky, at least 76px high with 16px 32px padding. Main content is centered up to 1680px with 32px padding. Below 768px, header height becomes at least 64px, header padding becomes 12px 16px, and content padding becomes 20px 16px. Navigation moves into the existing mobile sheet.

Spacing uses the observed half-rem through three-rem steps in the frontmatter. Cards use 24px horizontal padding, reducing to 16px on mobile. Metric cards reduce to 14px horizontal padding and two columns on mobile. Tables scroll horizontally rather than squeezing record columns. Mobile toolbar searches take the full row; sibling controls wrap underneath.

Dashboard workflow shortcuts move from five columns to three below 1280px and one below 768px. Its main two-column sections stack below 1024px; verification sections stack below 768px. Authentication uses equal desktop columns, with a 420px form limit; below 1024px only the form surface remains. These are implemented component behaviors, not a required composition for every page.

## Elevation & Depth

Depth comes primarily from surface tone, borders, and spacing. Cards carry a very faint shadow; selected navigation has a slightly stronger shadow. Authentication forms remove card borders, shadows, and rounding. Focus rings indicate interaction independently of elevation. Exact shadow values and transition durations live in the sidecar.

## Shapes

The base radius is 12px: the shared radius scale resolves to 8px, 10px, 12px, and 16px. Controls and navigation generally use 10px, tables use 12px, cards and welcome panels use 16px, and optional insights use 14px. Badges use full rounding; this does not make every container a pill. The 42px brand symbol uses a 13px corner, and the welcome mark is circular. Borders remain thin and tonal.

## Components

### Buttons
Primary buttons use paired primary colors, secondary uses paired secondary colors, outline uses a bordered ground, and ghost uses accent on hover. Destructive variants retain their destructive treatments. Standard buttons are at least 36px high; larger controls can be 40px. Primary hover uses 90% primary opacity; secondary hover uses 80%. Disabled controls reduce opacity to 50% and disable pointer interaction. Focus uses the ring border and a 3px ring at 50% opacity.

### Inputs / Fields
Fields use card backgrounds, input strokes, and 10px corners. Shared inputs and select triggers are at least 40px high; authentication inputs are 46px high. Inputs use 16px text on mobile and 14px from 768px upward. Invalid fields use destructive borders and rings. Preserve labels and disabled states.

### Chips / Status
Badges provide compact 12px labels with pill corners. Role labels instead use an 8px rounded secondary surface. Semantic status panels use success, warning, destructive, or muted pairings; error panels retain a card background with a destructive border. Always retain the status text.

### Cards / Containers
Default cards have a border, 16px corners, 24px vertical padding, and the faint card shadow. Metrics and status panels use 20px vertical padding with tighter internal gaps. Optional page insights are native details disclosures; charts remain below their summary and can be expanded with keyboard or pointer input.

Shipment details use grouped definition lists for local, international, and customs clearance records, with additional fields collected automatically. Quote IDs, coordinates, and geohashes are hidden; addresses remain visible. Status and type labels omit numeric codes, and null displays as `---`. Nested lists and status history remain readable; timestamps use Africa/Lagos with a visible time zone. Zero, false, empty strings, and empty lists retain their distinct displays. Long identifiers and document URLs wrap, with one column on mobile, two from 768px, and three from 1280px. Cancelled shipments, cancelled rides, and expired rides hide paid/unpaid badges and payment status controls, and their list payment cells show a neutral dash.

### Navigation / Page Finder
Destinations are grouped as Workspace, Operations, People & partners, Finance, Growth, and Administration, then filtered by the existing access rules. Selection includes nested detail routes and aria-current. Mobile selection closes the sheet. Breadcrumbs return to the parent list from details.

The page finder searches only allowed destinations. Cmd/Ctrl K toggles its dialog, arrows select a result, Enter opens it, and Esc closes it. Small screens show its accessible icon control; the visible label appears from 640px and the key hint from 1024px. The skip link becomes visible on focus. Tabler outline icons use a consistent 1.7 stroke in navigation and the finder, alongside text labels; decorative directions do not replace labels. The brand mark uses the user-provided app_logo4.png, resized into public/logo.png for the sidebar and desktop/mobile authentication headers, public/favicon.png for browser tabs, and public/apple-touch-icon.png for saved home-screen shortcuts. The original artwork and colors are preserved.

### Tables / Pagination

API lists retain the existing table, toolbar, and semantic status treatments. Pagination shows the current page and returned row count; endpoint cursors and offsets replace database snapshots. Search appears only where the service supports it. Bounded catalogues disclose their limit. Exports follow all returned continuation headers and download a separate file per page.

Support ticket View links open a compact details panel beside the queue at desktop widths and below it on smaller screens. Close details preserves the queue filters, page size and cursor and returns focus to the opening link; the queue also retains its state when returning from a conversation. Claiming a ticket from the queue opens its dedicated conversation page, and Open conversation links support direct navigation. The chat uses existing card and muted surfaces, semantic primary colors, borders and shared controls, with customer messages on the left and support replies on the right in chronological order. A compact status and action header sits above the scrollable thread, with a labelled reply composer anchored below it and ticket details in a disclosure. Older messages load through cursor pagination while preserving the reading position; new messages refresh every 15 seconds while the page is visible, with manual refresh also available. Replies and attachment downloads require assignment to the current agent, and replies require an open ticket. Closed tickets are visible and reopenable only by super administrators. Responsive controls, explicit loading and error states, and retry feedback follow the existing workspace patterns.

API actions use expandable forms with visible field labels, inline errors, busy controls, and explicit success receipts. Shipping commands follow the current lifecycle; pricing uses draft review and publication. Unsupported legacy features have explanatory empty states rather than controls that cannot save. All existing brand, typography, theme, focus, sidebar and mobile-sheet tokens remain authoritative.

Headers are 46px high with 16px horizontal padding and 12px semibold muted text. Cells use 14px records, approximately 14.4px 16px padding, and tabular numerals. Clickable rows are keyboard reachable and activate with Enter or Space when focus is on the row itself; child controls keep their own interactions. Focus supplies an inset outline and accent background.

Pagination wraps responsively, exposes its status through role=status, and disables unavailable or busy actions. Loading and empty states are explicit. Lists show the returned row count without inventing a total. Reports and exports identify their full period or bounded catalogue scope.

### Motion / Keyboard
Shared button and navigation state transitions take 160ms. Sidebar width and sheet behavior use the existing 200ms transitions. The shipped system has no entrance choreography. Reduced-motion mode reduces transitions and animations to 0.01ms, limits animation iterations to one, and restores automatic scroll behavior. Global focus uses a 2px ring outline with 3px offset; controls add their own focus treatment and clickable table rows use a negative offset.

## Do's and Don'ts

### Do:
- **Do** use semantic colors and both theme mappings from src/index.css.
- **Do** keep server filters, page counts, summaries, and exports visibly scoped.
- **Do** preserve route access and action permissions.
- **Do** retain keyboard focus, mobile toolbar wrapping, and reduced-motion behavior.

### Don't:
- **Don't** replace semantic status roles with arbitrary brand-blue states.
- **Don't** present fixture counts or invented claims as production data.
- **Don't** hide records behind optional charts or create inaccessible click-only rows.

Account details preserve the earlier personal information, verification, vehicle/documents, wallet and transaction sections. Unknown data is explicit; unavailable financial data never becomes a zero balance. Profile and vehicle editors submit only changed fields with the current profile revision and an operator reason. Contact edits show session/verification consequences. Rider applications use their allowed decisions and ready evidence. Section navigation retains table state while viewing details and resets it on leaving the section.

Refresh and retry actions share the outlined secondary control with a Tabler refresh icon, compact sizing and busy/disabled states. Detail-card headers explicitly use a wrapping horizontal layout. Loading reads use semantic-colour shimmer placeholders matching definition lists, table columns/rows, profile sections, shipment groups and the authentication/workspace shell. Existing headings and filters stay visible; loading is announced once, decorative blocks are hidden from assistive technology, and reduced motion disables shimmer. Shipment filters display native status names through readable labels; the primary table reference is the clickable native shipment ID.

Report details reuse the shipment information-card pattern: descriptive section headings, compact label/value grids, related records and coverage in sibling cards. Report filters have their own titled card. Activation and rider summaries sit above the paginated table, and their skeletons preserve that arrangement. User activation/concentration and user profiles share the Users navigation state; rider delivery reports and rider profiles share Riders state. Leaving those sections clears pagination.

Pricing editors read normalized units and full tariff snapshots. Active/retired tariffs offer cloning; only drafts expose metadata, explicit rate/mapping batches, publication and archive. Publication identifies predecessor retirement. Shipment controls follow returned allowed actions and show pending commands; clearance-only completion retains its distinct meaning. Version conflicts preserve the draft and require review of the latest record before a new submission.

All API enum displays use readable, field-specific labels; wire values remain unchanged. Long IDs/references have minimum table-column widths and wrap within them; wide tables scroll horizontally. Ride details follow shipment-style Order information, Customer and receiver, Rider and vehicle, Locations, Payment information and Dates cards. Incomplete ride fields remain unavailable, and cancelled/expired records hide payment state. Rider approval includes an observable-requirements checklist; conflict recovery checks the current requirements before a new attempt.

Ten Seconds rules use the existing cards, semantic colors, labelled controls, badges and notices for super administrators. Versioned camelCase replacements include timing and UTC reward quotas; five attempts, a ten-second virtual target and a 24-hour cooldown remain fixed. Missing or invalid configuration requires explicit setup. Approximate elapsed timing explains scaled-microsecond judging and two-minute expiry without starting gameplay. Presets change only the draft; conflicts preserve it for review, and actor- and API-environment-scoped pending saves retain the exact body, version and key. The shared native campaign manager lists real campaigns and exposes versioned status and gameEligible controls for super and regular administrators.

Account summaries use compact metric grids, locale-formatted counts, readable rider vehicle/status tables and a quiet calculation-time/growth footer; missing values remain Unavailable. Report coverage separates source readiness, processing diagnostics and latest-backfill progress into existing information cards with readable statuses and timestamps. Explicit super-only order rebuilds cover both shipment and ride/courier summaries, with bounded readiness polling, clear accepted/failed/timed-out states and totals shown only after complete coverage and successful reads. Loading, error, refresh and mobile table behavior retain the workspace patterns.

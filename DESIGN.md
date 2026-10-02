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

### Navigation / Page Finder
Destinations are grouped as Workspace, Operations, People & partners, Finance, Growth, and Administration, then filtered by the existing access rules. Selection includes nested detail routes and aria-current. Mobile selection closes the sheet. Breadcrumbs return to the parent list from details.

The page finder searches only allowed destinations. Cmd/Ctrl K toggles its dialog, arrows select a result, Enter opens it, and Esc closes it. Small screens show its accessible icon control; the visible label appears from 640px and the key hint from 1024px. The skip link becomes visible on focus. Tabler outline icons use a consistent 1.7 stroke in navigation and the finder, alongside text labels; decorative directions do not replace labels. The brand mark uses the user-provided app_logo4.png, resized into public/logo.png for the sidebar and desktop/mobile authentication headers, public/favicon.png for browser tabs, and public/apple-touch-icon.png for saved home-screen shortcuts. The original artwork and colors are preserved.

### Tables / Pagination
Headers are 46px high with 16px horizontal padding and 12px semibold muted text. Cells use 14px records, approximately 14.4px 16px padding, and tabular numerals. Clickable rows are keyboard reachable and activate with Enter or Space when focus is on the row itself; child controls keep their own interactions. Focus supplies an inset outline and accent background.

Pagination wraps responsively, exposes its status through role=status, and disables unavailable or busy actions. Zero totals display “Loading records…” while busy and “No records” when settled, rather than an empty page fraction. Search, filters, summaries, and exports keep their current-page disclosure.

### Motion / Keyboard
Shared button and navigation state transitions take 160ms. Sidebar width and sheet behavior use the existing 200ms transitions. The shipped system has no entrance choreography. Reduced-motion mode reduces transitions and animations to 0.01ms, limits animation iterations to one, and restores automatic scroll behavior. Global focus uses a 2px ring outline with 3px offset; controls add their own focus treatment and clickable table rows use a negative offset.

## Do's and Don'ts

### Do:
- **Do** use semantic colors and both theme mappings from src/index.css.
- **Do** keep current-page filtering, summaries, and exports visibly scoped.
- **Do** preserve route access and action permissions.
- **Do** retain keyboard focus, mobile toolbar wrapping, and reduced-motion behavior.

### Don't:
- **Don't** replace semantic status roles with arbitrary brand-blue states.
- **Don't** present fixture counts or invented claims as production data.
- **Don't** hide records behind optional charts or create inaccessible click-only rows.

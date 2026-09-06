---
name: SociHR Design System
description: Precision HR social media compliance tracking & engagement audit workspace
colors:
  primary: "#4f46e5"
  primary-hover: "#4338ca"
  primary-soft: "#e0e7ff"
  primary-border: "#c7d2fe"
  surface: "#f1f5f9"
  surface-2: "#e2e8f0"
  white: "#ffffff"
  line: "#e2e8f0"
  line-strong: "#cbd5e1"
  text-primary: "#0f172a"
  text-secondary: "#334155"
  text-tertiary: "#64748b"
  text-muted: "#71717a"
  success: "#16a34a"
  success-soft: "#f0fdf4"
  success-line: "#bbf7d0"
  danger: "#b91c1c"
  danger-soft: "#fef2f2"
  danger-line: "#fecaca"
  warning: "#b45309"
  warning-soft: "#fffbeb"
  warning-line: "#fde68a"
  info: "#2563eb"
  info-soft: "#eff6ff"
  info-line: "#bfdbfe"
typography:
  display:
    fontFamily: "Geist, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "28px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.5px"
  headline:
    fontFamily: "Geist, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.3px"
  title:
    fontFamily: "Geist, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1.4
  body:
    fontFamily: "Geist, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Geist Mono, monospace"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "0.05em"
rounded:
  sm: "5px"
  md: "8px"
  lg: "12px"
  xl: "16px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.white}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.white}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
  card-container:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.lg}"
    padding: "20px 24px"
---

# Design System: SociHR

## Overview

**Creative North Star: "The Modern Compliance Ledger"**

SociHR fuses the rigor of an enterprise audit workstation with the clarity and fluid responsiveness of a modern data-dense desktop application. Every screen prioritizes clarity, immediate visual feedback, and trustworthy compliance reporting across Facebook, Instagram, and TikTok engagement sessions.

The design strictly avoids decorative AI tells (gradient headings, exaggerated 3D glows, colored side-border bars) in favor of calibrated slate surfaces, crisp 1px structural lines, semantic status pills, and high-contrast typography powered by self-hosted Geist.

**Key Characteristics:**
- High information density without visual crowding.
- Purpose-driven semantic coloring (Green = Met, Amber = Partial, Red = Missed).
- Multi-tier layouts guiding attention from high-level executive KPIs down to individual staff records.
- Deterministic keyboard accelerators (`1`-`7` timeframes, `S` snapshots) built for repetitive HR power users.

## Colors

The palette relies on a solid foundation of slate and zinc neutrals paired with a confident indigo primary accent and WCAG AA compliant semantic feedback tones.

### Primary
- **Aurora Indigo** (`#4f46e5`): The primary interaction accent used for primary CTAs, active tab selections, and key focus boundaries. Never applied as decorative gradient text.

### Neutral
- **Page Canvas** (`#f1f5f9`): Slate-100 neutral providing gentle contrast behind pure white card surfaces.
- **Card Surface** (`#ffffff`): Pure white high-clarity background for tables, KPI blocks, and chart wrappers.
- **Structural Line** (`#e2e8f0`): Slate-200 border dividers defining card borders and table row boundaries.
- **Deep Slate Heading** (`#0f172a`): Slate-900 primary heading color ensuring crisp typography.
- **Readable Body** (`#334155`): Slate-700 high-legibility text for content and table cells.
- **Secondary Caption** (`#64748b`): Slate-500 for contextual timestamps and metadata labels.

### Semantic Status
- **Compliance Success** (`#16a34a` / Soft: `#f0fdf4`): Indicating completed engagement ticks and high compliance (>75%).
- **Compliance Missed** (`#b91c1c` / Soft: `#fef2f2`): Indicating missed required actions and attention states (<50%).
- **Compliance Moderate** (`#b45309` / Soft: `#fffbeb`): Warning threshold for partial compliance (50%–75%).
- **Session Tracked** (`#2563eb` / Soft: `#eff6ff`): Metadata and platform tracking indicators.

### Named Rules
**The Rarity Rule.** The primary indigo accent is reserved strictly for active interactive controls and primary KPIs. It never covers more than 8% of the viewport area.

**The Functional Color Rule.** Green, red, and amber are reserved exclusively for compliance statuses, completion calculations, and destructive warnings.

## Typography

**Display & Body Font:** Geist (`Geist, -apple-system, BlinkMacSystemFont, sans-serif`)
**Code & Data Font:** Geist Mono (`Geist Mono, monospace`)

**Character:** Modern neo-grotesque sans-serif with high x-height, optimized for compact data display and ClearType subpixel rendering on Windows.

### Hierarchy
- **Display** (800, 28px, line-height 1.2): Main page headers (`Dashboard`, `Staff Directory`, `Monitoring`).
- **Headline** (700, 22px, line-height 1.3): Section headers and major modal titles.
- **Title** (700, 15px, line-height 1.4): Card labels, chart titles, and company leaderboard headings.
- **Body** (400, 14px, line-height 1.6): Table text, form labels, and modal explanations.
- **Label / Metric Data** (700, 11-12px, letter-spacing 0.05em): Uppercase table header columns, status badges, and keyboard shortcuts.

### Named Rules
**The Data-Over-Decor Rule.** Metric figures use tabular lining figures with crisp 800 weight, never decorative typography or drop shadows.

## Layout

SociHR uses a fixed sidebar navigation (240px) paired with a responsive, fluid main workspace container. 

- **Grid Model:** 12-column responsive flex/grid with 16px standard gutter between cards.
- **Responsive Breakpoints:** 
  - Desktop (>1024px): Multi-column split dashboards and side-by-side analytics.
  - Tablet (768px–1024px): 2-column stacking.
  - Mobile (<768px): Single-column vertical flow with horizontal scrollable tables.
- **Vertical Rhythm:** 24px bottom margins between major visual tiers; 12px within card sub-elements.

## Elevation & Depth

Surfaces are structural and flat at rest, utilizing 1px borders (`#e2e8f0`) to delineate hierarchy. Shadows are subtle and ambient.

### Shadow Vocabulary
- **Resting Ambient** (`box-shadow: 0 1px 2px rgba(17,17,24,0.04)`): Baseline shadow under KPI cards and tables.
- **Hover Lift** (`box-shadow: 0 4px 12px rgba(17,17,24,0.08)`): Applied on interactive cards, table rows, and primary buttons during mouseover.
- **Modal Overlay** (`box-shadow: 0 12px 36px rgba(15,23,42,0.18)`): Heavy elevation for confirmation dialogs and forms.

### Named Rules
**The Flat-at-Rest Rule.** All cards and panels sit flat on the slate canvas. Elevation exists solely as a response to user focus or hover state.

## Shapes

- **Base Radius:** 8px (`--r-md`) for buttons, form inputs, and status badges.
- **Container Radius:** 12px (`--r-lg`) for cards, modal dialogs, and chart containers.
- **Pill Radius:** 9999px for avatar chips and date filter controls.
- **Border Treatment:** 1px solid hairline (`#e2e8f0`); thick side-tabs or asymmetric borders are strictly forbidden.

## Components

### Buttons
- **Shape:** 8px radius with 8px 16px internal padding.
- **Primary:** `#4f46e5` background with white text, lifting 1px on hover.
- **Secondary:** White background with `#e2e8f0` border and `#0f172a` text.
- **Ghost:** Transparent background with `#64748b` text for secondary utility actions.
- **Danger:** Soft red `#fef2f2` with `#b91c1c` text for delete/deactivate confirmations.

### Cards & KPI Tiles
- **Corner Style:** 12px radius with 1px hairline border.
- **KPI Tiles:** Displaying title (11px uppercase), large metric (24-32px bold), and contextual subtext.

### Data Tables
- **Header:** Sticky uppercase labels (11px, `#64748b`, 500 weight).
- **Row:** 12px padding with `#f8faff` hover background and hairline border dividers.
- **Actions Column:** Right-aligned quick-action button group with clear icons.

### Inputs & Date Selectors
- **Style:** White background, 8px radius, `#cbd5e1` border.
- **Focus:** 2px glowing outline `#c7d2fe` with `#4f46e5` border transition.

## Do's and Don'ts

### Do:
- **Do** provide context text under every large KPI metric (e.g., "In selected period" or "Enrolled in system").
- **Do** use self-contained SVG icons for actions instead of raw emoji glyphs.
- **Do** preserve the 4-tier visual hierarchy on analytics surfaces.
- **Do** support keyboard accelerators (`1`-`7`, `S`, `Escape`) on core navigation and modal flows.

### Don't:
- **Don't** use gradient text on headers, titles, or metrics.
- **Don't** use thick colored borders on one side of a card (`borderLeft: 5px solid`).
- **Don't** leave empty states without actionable guidance when date filters return 0 records.
- **Don't** mix different font families outside Geist and Geist Mono.

---
timestamp: 2026-09-10T04-16-11Z
slug: socihr-frontend-src-pages-companypage-tsx
---
# Critique — CompanyPage.tsx (tab Company, 2026-09-09)

Method: dual-agent (A: design review · B: detector + live browser 1440px + 390px).

## Verdict
Pre-fix: category-interchangeable (Inter font, rainbow bars, hand-rolled SVGs, ad-hoc KPI boxes). Post-fix: same family as CompanyProfilePage.

## Priority issues (all FIXED)
- P1 Delete inside navigation row → kept in-row (ConfirmationDialog guard exists) + aria-label; keyboard Enter on row navigates, on delete stays (stopPropagation).
- P2 Weak row affordance → stronger chevron (text-2), role=link + keyboard + aria-label kept.
- P3 Metric strip vs profile KPI → rebuilt on .kpi/.kpi-label/.kpi-value/.kpi-sub + tabular-nums; "Completed Ticks" renamed "Completed Actions".
- P4 Chart hierarchy/tokens → secondary chart-wrap card, Geist, semantic bar colors (75/50), descending to match list (yAxis inverse).
- P5 Icons/empty/mobile → 8 hand SVGs + chevron + EngagementMetrics clock/calendar/emoji + profile/compare glyphs ALL replaced with lucide-react (installed 1.43.0); date pills scrollable on mobile (was overflowing at 390px).

## Detector (B)
detect.mjs --json: [] (exit 0). Live: desktop no overlap; mobile no page overflow after pills fix. ECharts containLabel console note only.

## Residual (known, out of scope)
- EngagementMetrics "Failed to fetch" console noise on fast dashboard-unmount navigation (pre-existing; abort-guard added, navigation-cancel case remains).
- Rank circle + row hover tint still decorative rainbow (kept intentionally as row identity).

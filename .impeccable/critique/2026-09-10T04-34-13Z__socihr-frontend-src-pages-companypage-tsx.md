---
timestamp: 2026-09-10T04-34-13Z
slug: socihr-frontend-src-pages-companypage-tsx
---
# Critique R2 — CompanyPage.tsx (Spotlight + Ledger redesign, 2026-09-09)

Method: dual-agent (A: redesign direction · B: detector + live browser 1440px + 390px).

## Verdict
R1 fixes were correct but flat: 4 equal .kpi tiles + side-by-side cards + sticky chart = no winner, no tension. R2 direction "Spotlight + Ledger": winner on top, distribution context, dense ledger.

## Implemented
- Header: h1 + Add Company only; pills + Export + Compare demoted to slim toolbar card (segmented, scrollable, aria-pressed).
- Spotlight banner for #1: initial-avatar (tinted), Trophy TOP PERFORMER, big name, mono stats, full-width semantic bar, giant tabular rate, meta line, View profile button.
- Full-width chart strip (~180px + per-row scale), Geist, semantic bars, descending = list order.
- Dense ledger table: mono #01 rank, avatar+name, Completed/Missed/Total tabular, inline Rate bar+%, Status badge (On track/Needs push/At risk), chevron + trash actions; keyboard rows; caption; footer-less (totals live in spotlight meta).
- Lucide-only confirmed (8 page icons + shared glyphs); Inter gone; empty states gained CTAs (Add first company / Show all time).
- a11y: role=link rows, aria-labels, scope/caption, aria-pressed segments.

## Verify (B + parent screenshots)
detect.mjs: []. Desktop: hierarchy reads winner → chart → ledger, no overlap. Mobile 390: stacks, page no overflow, table scrolls inside wrapper. Console: ECharts containLabel note only (+ pre-existing dashboard abort noise, out of scope).

## Residual
- Rank avatar tint reuses rainbow COMPANY_COLORS (intentional identity signal, documented).
- Dashboard EngagementMetrics abort-noise on fast unmount navigation (pre-existing).

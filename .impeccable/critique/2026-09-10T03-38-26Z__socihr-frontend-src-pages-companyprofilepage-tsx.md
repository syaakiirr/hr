---
timestamp: 2026-09-10T03-38-26Z
slug: socihr-frontend-src-pages-companyprofilepage-tsx
---
# Critique — CompanyProfilePage.tsx (pre-fix, 2026-09-09)

Method: dual-agent (A: design review · B: detector + live browser). Live render verified via Playwright (1440x900 + 390x844, 0 console errors on profile; dashboard abort-noise only).

## Heuristics (Nielsen, /40)
| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 1 | Text-only loading, no skeleton; filter refetch has no progress |
| 2 | Match System / Real World | 1 | Rate/Rate %/Compliance Rate/Actions used interchangeably |
| 3 | User Control and Freedom | 1 | Filter/view state in-memory, not URL-synced |
| 4 | Consistency and Standards | 0 | kpi-card class nonexistent; Inter vs Geist; dark vs light tooltip |
| 5 | Error Prevention | 1 | Dual-axis scale confusion; hidden filter options |
| 6 | Recognition Rather Than Recall | 1 | Session rows force recall; thresholds memorized |
| 7 | Flexibility and Efficiency | 0 | No sort/search/export; no deep-link |
| 8 | Aesthetic and Minimalist Design | 1 | 6 equal KPIs + 4-series chart, flat hierarchy; 260px cramped |
| 9 | Error Recovery | 1 | Raw err.message, no retry; dead-end empty states |
| 10 | Help and Documentation | 0 | No formula/threshold definitions |
| **Total** | | **7/40** | **Critical (pre-fix baseline)** |

## Specificity
Category-interchangeable pre-fix: slate text, 4 random series colors, Inter font, no SociHR ledger markers (Geist, #4f46e5, tabular-nums, semantic pills).

## Priority issues (all FIXED post-critique)
- P1 Unreadable 4-series dual-axis chart → default Completed+Rate, others legend-optional, height 320, single indigo voice
- P2 KPI strip (6, unstyled class) → 4 tiles on real .kpi system + subtext + tabular-nums
- P3 Token drift (Inter, dark tooltip, pastel pills) → Geist, light tooltip, segmented accent controls
- P4 Dead table/empty states → sortable Rate, caption/scope, text status labels, actionable empty copy
- P5 State not shareable → documented limitation; deep-link deferred

## Detector (B)
detect.mjs --json: [] (exit 0). Live browser: no overlap, no overflow mobile, canvas renders. ECharts containLabel console note only.

## Personas
Alex: no sort/search/export, full refetch per pill, no compare. Sam: pills lack aria-pressed, chart has no text alternative, Rate color-only, touch targets small. (aria-pressed, caption/scope, text labels, chart aria-label FIXED post-critique.)

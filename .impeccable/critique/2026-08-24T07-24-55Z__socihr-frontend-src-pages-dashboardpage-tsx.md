---
target: socihr-frontend/src/pages/DashboardPage.tsx
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
timestamp: 2026-08-24T07-24-55Z
slug: socihr-frontend-src-pages-dashboardpage-tsx
---
### Method
⚠️ DEGRADED: single-context (spawn_agent unavailable in this session)

### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Real-time metric indicators and date range pills provide good feedback; background sync status could be more explicit |
| 2 | Match System / Real World | 3 | Uses HR domain terms, but "Ticks" terminology is internal jargon rather than standard social engagement metrics |
| 3 | User Control and Freedom | 3 | Good timeframe presets and custom range support; lacks one-click filter reset |
| 4 | Consistency and Standards | 3 | Dark/light theme cohesive with ECharts; redundant company performance widgets appear in two separate sections |
| 5 | Error Prevention | 3 | Proactive fallback states for empty metrics; date range validator guards inverted bounds |
| 6 | Recognition Rather Than Recall | 3 | Visible time pills and color-coded heatmap cues; some formula derivations (Done vs Expected) require memory |
| 7 | Flexibility and Efficiency | 2 | No keyboard shortcuts for date presets or snapshot captures; no customizable dashboard layout |
| 8 | Aesthetic and Minimalist Design | 2 | High visual density with 6 KPI cards, 3 platform badges, 5 company badges, 3 charts, 2 ranking lists, and 2 sub-sections on one screen |
| 9 | Error Recovery | 3 | Toast alerts for failed endpoints with graceful fallback metrics |
| 10 | Help and Documentation | 2 | Basic tooltips on charts, but missing contextual calculation guides for new HR operators |
| **Total** | | **27/40** | **Acceptable** |

### Design Specificity Verdict

**LLM Assessment**: The dashboard is deeply functional and tailored to SociHR's core mechanism (cross-platform employee social engagement tracking). However, the page suffers from feature accumulation: multiple development iterations have added metric blocks that duplicate existing insights (e.g. Company Performance badges at the top AND a separate Company Performance tick card below). The visual density is high, making it harder for an HR director to extract an immediate 5-second pulse check.

**Deterministic Scan**: Found 0 direct rule violations on `DashboardPage.tsx`. Global scan noted shared design tokens (`Geist` font overuse, decorative linear grid lines in `index.css`, and CSS transition properties in `premium-ui.css`).

### Overall Impression
SociHR's Dashboard is a robust, data-rich operational center with excellent chart integration (ECharts) and responsive date-filtering, but it currently presents every piece of data with equal visual weight, creating unnecessary cognitive load.

### What's Working
1. **Interactive Date Scoping**: Seamless timeframe switching (Today, This Week, This Month, Custom Range) updating all metrics consistently.
2. **Platform & Company Breakdown Clarity**: Clean horizontal badge metrics displaying platform-by-platform success rates.
3. **Heatmap & Trend Visualizations**: The daily engagement heatmap and monthly/weekly trend charts provide strong historical context.

### Priority Issues
- **[P1] Metric Duplication & Information Overload**: Company performance cards are displayed twice in different visual formats.
  - *Why it matters*: Distracts users and dilutes focus on actionable underperforming units.
  - *Fix*: Unify company metrics into a single cohesive drill-down widget.
  - *Suggested command*: `$impeccable distill socihr-frontend/src/pages/DashboardPage.tsx`
- **[P1] Visual Hierarchy & Section Grouping**: The page displays 12+ widgets in a single vertical stream without collapsible executive vs operational tiers.
  - *Why it matters*: HR leadership needs high-level summary at the top, while coordinators need deep drilldowns.
  - *Fix*: Structure the dashboard into distinct visual tiers (Executive Summary -> Channel Breakdown -> Staff Deep Dive).
  - *Suggested command*: `$impeccable layout socihr-frontend/src/pages/DashboardPage.tsx`
- **[P2] Jargon & Metric Terminology Inconsistency**: "Ticks", "Engagements", "Total Done", and "Expected Ticks" are used interchangeably across different cards.
  - *Why it matters*: Causes confusion for new team members interpreting compliance rates.
  - *Fix*: Standardize copy across cards (e.g. "Expected Actions", "Completed Actions", "Compliance Rate").
  - *Suggested command*: `$impeccable clarify socihr-frontend/src/pages/DashboardPage.tsx`
- **[P2] Power User Shortcuts & Quick Filters**: Frequent operators cannot switch timeframes or search rankings via keyboard.
  - *Why it matters*: Slows down daily monitoring routines for active HR admins.
  - *Fix*: Introduce keyboard accelerators (e.g., `1-7` for timeframe pills, `/` for search).
  - *Suggested command*: `$impeccable adapt socihr-frontend/src/pages/DashboardPage.tsx`

### Persona Red Flags
- **Alex (Power User / HR Director)**: Wants a 5-second compliance overview before leadership meetings. Currently has to scroll past 6 cards and 4 charts to see staff needing attention.
- **Jordan (First-Time HR Coordinator)**: Stumbles on the difference between "Total Ticks (11,115)" vs "Total Done (5,801)" vs "Expected Ticks". Unclear whether "Missed" means an employee failed or if the post was optional.

### Minor Observations
- Top KPI cards could benefit from subtle trend indicators (+/- % change vs previous period).
- The "Save dashboard snapshot" and "Download PDF" action buttons in the header have different visual treatments.

### Questions to Consider
- What if the dashboard led with an executive summary card (Overall Compliance + Top Action Items), collapsing secondary metrics behind tabs?
- Could we unify the "Staff Ticks" standalone page and the Dashboard's lower metric widgets into a smoother master-detail flow?

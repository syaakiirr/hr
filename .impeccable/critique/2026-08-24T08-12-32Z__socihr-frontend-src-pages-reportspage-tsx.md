---
target: socihr-frontend/src/pages/ReportsPage.tsx
total_score: 34
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 0
timestamp: 2026-08-24T08-12-32Z
slug: socihr-frontend-src-pages-reportspage-tsx
---
### Method
⚠️ DEGRADED: single-context (spawn_agent unavailable in this session)

### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Button spinner triggers during download; lacks animated progress bar for large multi-page PDF generation |
| 2 | Match System / Real World | 4 | Standard reporting intervals (Daily, Weekly, Monthly, Yearly, Custom) and standard enterprise document formats |
| 3 | User Control and Freedom | 4 | Custom section checklist modal allows cherry-picking exact report chapters (KPI, Ranking, Staff Detail, Session Matrix) |
| 4 | Consistency and Standards | 3 | Left period selector uses ad-hoc gradient highlights (`rgba(214, 41, 118, 0.08)`) instead of standard `DESIGN.md` tokens |
| 5 | Error Prevention | 4 | Date validation blocks invalid inverted date ranges (Start > End) |
| 6 | Recognition Rather Than Recall | 4 | Explicit engine badges (*QuestPDF Engine*, *ClosedXML Engine*) and clear date bounds |
| 7 | Flexibility and Efficiency | 3 | Immediate 1-click download for standard presets |
| 8 | Aesthetic and Minimalist Design | 3 | Period buttons use semi-transparent inline backgrounds; export cards need unified vector icons |
| 9 | Error Recovery | 3 | Alert prompts for network issues; could use inline toast error feedback |
| 10 | Help and Documentation | 3 | Explanatory description below cards |
| **Total** | | **34/40** | **Good** |

---

### Design Specificity Verdict

**LLM Assessment**: Reports Center surface is an executive export hub combining automated QuestPDF layout compilation with granular ClosedXML data export.

**Deterministic Scan**: `0 Warnings, 0 Errors` from `detect.mjs`.

---

## Recommended Action Plan
- **[P1] Standardize Period Selector**: Refactor left period list to use `DESIGN.md` tokens (`var(--accent-soft)`, `var(--accent)`, `var(--white)`, `var(--line)`) instead of ad-hoc gradients.
- **[P2] Polish Export Cards**: Add clean vector filetype icons (PDF, Custom Gear, Excel Spreadsheet) and replace native `alert()` dialogs with toast feedback.

---
target: socihr-frontend/src/pages
total_score: 32
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 0
timestamp: 2026-08-24T07-50-36Z
slug: socihr-frontend-src-pages
---
### Method
⚠️ DEGRADED: single-context (spawn_agent unavailable in this session)

### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Real-time indicators on Dashboard and Monitoring are clear; long-running PDF/Excel export lacks prominent progress gauge |
| 2 | Match System / Real World | 3 | Uses natural HR organizational concepts (Departments, Companies, Staff); terminology between "Ticks" and "Actions" now unified |
| 3 | User Control and Freedom | 3 | Robust archive/restore and snapshot capture; date filters could benefit from a global "Reset to Current Month" button |
| 4 | Consistency and Standards | 4 | Unified 1px card borders, consistent badge colors, and standard font scale across all 11 pages |
| 5 | Error Prevention | 3 | Destructive delete operations have confirmation modals; date bounds validate properly |
| 6 | Recognition Rather Than Recall | 4 | Search bars, dropdown filters, avatar initials, and platform color tags reduce cognitive load across tables |
| 7 | Flexibility and Efficiency | 3 | Date shortcuts (1-7) and quick snapshot key (S) implemented; modal dismissals mapped to Escape key |
| 8 | Aesthetic and Minimalist Design | 3 | Clean white/surface palette, high data density without visual clutter, 0 AI-pattern tells (no side-tabs or gradient text) |
| 9 | Error Recovery | 3 | Contextual toast notifications for failed API requests with retry guidance |
| 10 | Help and Documentation | 3 | Explanatory subtext below page headers and zero-state instructions in place |
| **Total** | | **32/40** | **Good** |

---

### Design Specificity Verdict

**LLM Assessment**: SociHR demonstrates strong design specificity tailored directly to its core mission: organizational social media compliance tracking. Unlike generic admin templates, each surface directly serves HR workflows (session monitoring, staff engagement accountability, organization-level reporting).

**Deterministic Scan**: `0 Warnings, 0 Errors` across all 11 page files (`detect.mjs` clean).

---

## 1. Individual Page Reviews (All 11 Surfaces)

### 1. 📊 Dashboard (`/dashboard`)
- **Visual Hierarchy**: 4 distinct tiers (Executive KPIs &rarr; Channel/Company breakdown &rarr; Standings & Trends &rarr; Daily Heatmap Activity).
- **Spacing & Alignment**: Grid layouts responsive down to mobile viewports.
- **Typography & Readability**: Clear contrast between primary metrics (24-32px bold) and contextual helper copy (11px).
- **UX & Usability**: Instant date presets (1-7 keyboard keys) and snapshot shortcuts.
- **Key Opportunity**: Add subtle +/- % comparison tags against previous period on top KPI cards.

### 2. 👥 Staff Directory (`/staff`)
- **Visual Hierarchy**: Summary pills (Total, Active, Inactive) at top &rarr; search/filter toolbar &rarr; responsive data table.
- **Typography & Readability**: Two-letter avatar initials aid rapid visual scanning.
- **UX & Usability**: Immediate filter by department and status without page reloads.
- **Key Opportunity**: Group secondary table row actions into an overflow menu on narrow mobile screens.

### 3. 🏢 Department Management (`/departments`)
- **Visual Hierarchy**: Summary badges &rarr; interactive card grid with live staff counts.
- **Spacing & Alignment**: Consistent 14px gap with hover elevation.
- **UX & Usability**: Clicking any department card filters the staff directory directly to that unit.
- **Key Opportunity**: Add a quick search bar for organizations with 20+ departments.

### 4. 🏛️ Company Management (`/company`)
- **Visual Hierarchy**: Split 50/50 view — Company Leaderboard on the left, Overall Ranking Chart on the right.
- **Color & Contrast**: High-contrast completion badges with semantic SVG icons.
- **UX & Usability**: Contextual zero-state note explaining when no sessions exist in the selected period.
- **Key Opportunity**: Allow inline renaming of registered company entities.

### 5. 🎯 Staff Ticks & Engagement (`/staff-engagement`)
- **Visual Hierarchy**: Metric pills &rarr; Filter Tabs (All Staff / Top Performers / Needs Attention) &rarr; Leaderboard table.
- **Typography & Readability**: Visual percentage progress bars provide instant compliance assessment.
- **UX & Usability**: Direct CSV export capability for HR payroll/KPI audits.
- **Key Opportunity**: Add sorting by department in addition to completion rate.

### 6. 📅 Monitoring Sessions (`/monitoring`)
- **Visual Hierarchy**: Horizontal interactive session carousel at top &rarr; detailed post & engagement grid below.
- **Color & Contrast**: Platform-specific color pips (Facebook Blue, Instagram Pink, TikTok Dark).
- **UX & Usability**: Bulk selection checkbox bar for multi-session archive/delete.
- **Key Opportunity**: Add visual thumbnail preview for linked post URLs.

### 7. 📄 Reports Engine (`/reports`)
- **Visual Hierarchy**: Period selector &rarr; Document Export cards (PDF / Excel) &rarr; Section customizer modal.
- **Typography & Readability**: Clean card headers detailing QuestPDF & ClosedXML export capabilities.
- **UX & Usability**: One-click download with customizable modular report sections.
- **Key Opportunity**: Display file size estimate and page count estimate prior to PDF generation.

### 8. 🛡️ Audit Trail (`/audit`)
- **Visual Hierarchy**: Chronological timeline feed of employee engagement mutations.
- **Typography & Readability**: Tagged before &rarr; after state changes with operator timestamps.
- **UX & Usability**: Paginated log viewing with date scoping.
- **Key Opportunity**: Add filter by mutation type (Status Change vs Tick Correction vs Deletion).

### 9. 📸 Snapshots (`/snapshots`)
- **Visual Hierarchy**: Card grid of saved dashboard states with notes and date range tags.
- **UX & Usability**: One-click restore into active dashboard session.
- **Key Opportunity**: Add side-by-side snapshot comparison view.

### 10. 📦 Archive Management (`/archived`)
- **Visual Hierarchy**: Tabbed switch between Archived Staff and Archived Monitoring Sessions.
- **UX & Usability**: Safe restore actions with permanent purge confirmation modals.
- **Key Opportunity**: Bulk restore for multiple selected archived staff.

### 11. 🔐 Authentication & Login (`/login`)
- **Visual Hierarchy**: Split-screen design (Branded product mission on the left, secure login form on the right).
- **Color & Contrast**: Dark theme with high contrast inputs and active focus states.
- **UX & Usability**: Show/hide password toggle and automated error handling.
- **Key Opportunity**: Add "Remember Username" checkbox.

---

## 2. Cross-Page Design System Evaluation

- **Typography Consistency**: Unified to `Geist` and `Geist Mono` font tokens across all 11 pages.
- **Color Tokens**: Standardized CSS variables (`var(--accent)`, `var(--green)`, `var(--amber)`, `var(--red)`, `var(--surface-2)`, `var(--line)`).
- **Card & Surface Tokens**: Harmonious 1px border radius (`12-14px`) with soft elevation (`var(--shadow-xs)`), eliminating all legacy AI artifacts.
- **Interaction Models**: Common button styles (`btn-primary`, `btn-secondary`, `btn-ghost`, `btn-icon`) and unified modal overlays.
- **Responsive Behavior**: Consistent breakpoint collapses (tablet @ 768px, mobile @ 480px).

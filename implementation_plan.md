# Implementation Plan: Comprehensive SociHR System Upgrade

Upgrade the SociHR application with performance optimizations, modern data visualizations, gamification (Leaderboard), Session Comparison, Theme switching (Dark/Light), enhanced audit tracking, granular report builder, and full mobile responsiveness.

---

## Selected Features Scope

Following your request to proceed with all items **except 6, 7, 8, 9, 10, and 11**, the following features are included:

1. **Dashboard Caching (Backend)**: Fast in-memory cache (`IMemoryCache`) with invalidation on updates.
2. **Staff Pagination & Search Optimization**: Smooth pagination with customizable page sizes and instant search for Staff directory.
3. **Optimized / Non-blocking PDF Report Generation**: Progress indicator and optimized streaming to prevent UI lockups.
4. **Interactive Dashboard Charts (ECharts)**:
   - Line chart: Engagement trend over time (Likes, Comments, Shares).
   - Bar chart: Department performance comparison & completion rates.
   - Donut chart: Interaction distribution breakdown.
5. **Dedicated Leaderboard Page (`/leaderboard`)**:
   - 🥇 Podium display for Top 3 performers (with badges & crowns).
   - Department filters and period filters.
   - Most Improved & Needs Attention indicator badges.
6. **Audit Log System Enhancement**:
   - Track session changes, staff modifications, report downloads, and user authentications.
   - Filterable timeline in `/audit`.
7. **Two-Factor Authentication (2FA) / Admin Verification**:
   - TOTP authenticator setup & 6-digit pin verification for SuperAdmin security.
8. **Dark / Light Mode System**:
   - Sleek enterprise dark mode + crisp light mode toggle with local storage persistence.
9. **Mobile-Responsive Optimization**:
   - Responsive collapsible navigation drawer, responsive metric grids, and touch-friendly layouts.
10. **Session Comparison View**:
    - Side-by-side visual comparison between two monitoring sessions (KPI deltas, department changes).
11. **Granular Custom Report Builder**:
    - Selectable report components (Cover, KPI Cards, Department Breakdown, Platform Breakdown, Staff Matrix, Timeline) with live PDF layout preview.
12. **Report Branding Customization**:
    - Customizable report title, accent theme color, and enterprise watermark settings.

---

## User Review Required

> [!IMPORTANT]
> - New route `/leaderboard` will be added to the main navigation for quick access to gamified rankings.
> - A new `/session-comparison` tool or modal inside Monitoring / Reports will allow comparing any two sessions.
> - The theme switcher will be accessible in the top header and sidebar.

---

## Proposed Changes

### 1. Backend Performance & Security (`socihr-backend`)

#### [MODIFY] [DashboardController.cs](file:///c:/Users/syakir/Downloads/syaakiirr/hr/hr/socihr-backend/Controllers/DashboardController.cs)
- Integrate `IMemoryCache` for dashboard summary and trend endpoints with a 3-minute sliding expiration.

#### [MODIFY] [StaffController.cs](file:///c:/Users/syakir/Downloads/syaakiirr/hr/hr/socihr-backend/Controllers/StaffController.cs)
- Add paginated endpoint `GET /api/staff/paged?page=1&pageSize=10&search=...&department=...` alongside the full list.

#### [MODIFY] [AuditController.cs](file:///c:/Users/syakir/Downloads/syaakiirr/hr/hr/socihr-backend/Controllers/AuditController.cs)
- Add comprehensive action logging hooks across controllers (Sessions, Staff, Reports, Auth).

#### [MODIFY] [AuthController.cs](file:///c:/Users/syakir/Downloads/syaakiirr/hr/hr/socihr-backend/Controllers/AuthController.cs)
- Add 2FA setup & validation endpoints (`/api/auth/2fa/setup`, `/api/auth/2fa/verify`, `/api/auth/2fa/disable`).

---

### 2. Frontend Visuals, Charts & Pages (`socihr-frontend`)

#### [NEW] [ThemeContext.tsx](file:///c:/Users/syakir/Downloads/syaakiirr/hr/hr/socihr-frontend/src/contexts/ThemeContext.tsx)
- Theme provider supporting `'dark'` | `'light'` mode with CSS variables sync.

#### [MODIFY] [DashboardPage.tsx](file:///c:/Users/syakir/Downloads/syaakiirr/hr/hr/socihr-frontend/src/pages/DashboardPage.tsx)
- Integrate Apache ECharts (using existing `echarts-for-react`) for:
  - 📈 Engagement Timeline (Smooth Area Line Chart)
  - 📊 Department Comparison (Graduated Stacked / Clustered Bar Chart)
  - 🍩 Platform & Action Distribution (Donut Chart)

#### [NEW] [LeaderboardPage.tsx](file:///c:/Users/syakir/Downloads/syaakiirr/hr/hr/socihr-frontend/src/pages/LeaderboardPage.tsx)
- High-end gamified leaderboard with animated podium (1st, 2nd, 3rd), streak counters, and performance tiers (Diamond, Gold, Silver).

#### [NEW] [SessionComparisonModal.tsx](file:///c:/Users/syakir/Downloads/syaakiirr/hr/hr/socihr-frontend/src/components/SessionComparisonModal.tsx)
- Dual-session comparator showing delta percentages (+12% engagement, -4 missed ticks, etc.).

#### [MODIFY] [StaffPage.tsx](file:///c:/Users/syakir/Downloads/syaakiirr/hr/hr/socihr-frontend/src/pages/StaffPage.tsx)
- Add paginated table navigation, page size selector (10, 25, 50, All), and instant department filter pills.

#### [MODIFY] [ReportsPage.tsx](file:///c:/Users/syakir/Downloads/syaakiirr/hr/hr/socihr-frontend/src/pages/ReportsPage.tsx)
- Granular report configuration checkboxes (KPIs, Platform Breakdown, Top 5, Staff Ticks, Matrix, Timeline, Watermark).

#### [MODIFY] [Sidebar.tsx](file:///c:/Users/syakir/Downloads/syaakiirr/hr/hr/socihr-frontend/src/components/Sidebar.tsx) & [App.tsx](file:///c:/Users/syakir/Downloads/syaakiirr/hr/hr/socihr-frontend/src/App.tsx)
- Add Leaderboard route and mobile-friendly hamburger drawer navigation.

---

## Verification Plan

### Automated & Build Verification
1. `dotnet build` on `socihr-backend` to ensure zero compilation errors.
2. `npm run build` on `socihr-frontend` to ensure clean TypeScript typing and bundle optimization.

### Manual Verification
1. Verify Dashboard charts render smoothly with dark & light theme switching.
2. Test `/leaderboard` page filters and podium display.
3. Test Staff pagination and search responsiveness.
4. Test Session Comparison modal with two distinct sessions.
5. Generate PDF report with custom selected sections.

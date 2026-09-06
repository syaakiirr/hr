# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary user: the HR / People Operations team.** Their working situation is an organization whose employees are expected to represent the brand on social media (posting and engaging on Instagram, TikTok, and Facebook), and whose activity needs to be visible, monitored, and accounted for at the organizational level.

Their job: assemble a single, reliable, current view of every employee's social-media engagement across platforms, spot who is active and who is behind, and keep a governed, reportable record of that activity for their team and leadership.

## Product Purpose

SociHR is a social media engagement monitor for HR teams. It pulls employee engagement activity from multiple social platforms into one HR-facing application so a People Operations team can see, assess, and report on brand-relevant behavior across the whole organization — without maintaining consumer tools or a platform account per employee.

Success means the HR team can quickly answer "who is engaging on our social channels, how consistently, and across which platforms," and can produce a defensible record of that — through metrics, monitoring sessions, saved snapshots, and auditable status changes — over time.

## Positioning

SociHR's meaningful difference is **consolidation**: it unifies multiple social platforms (Instagram, TikTok, Facebook) into a single HR-facing view of each employee's engagement, so an HR team can monitor brand-relevant behavior without hopping between consumer social apps. A generic social-analytics or employee-monitoring tool could not truthfully claim HR-specific consolidation with engagement-task accountability out of one box.

## Operating Context

Administered in the organization's web browser (responsive — desktop and modest mobile). An HR admin signs in and works through a sidebar-led set of surfaces: an overview Dashboard, Staff, Departments, Companies, Staff Engagement ("Staff Ticks"), Monitoring sessions, Reports, an Audit Trail, Snapshots, and Archived records. Data and reporting are scoped through a shared date range so the whole workspace can be read over one window.

Key workflows are factual parts of use:

- Managing a staff directory (full name, department, position, status) with archive/restore for departures or deactivation.
- Grouping staff into Companies and Departments for organizational scoping.
- Running Monitoring Sessions — named, dated sessions of tracked posts with platform links and companies, used to attach engagement events.
- Reviewing each staff member's engagement stats: total posts, engaged, completed vs. missed, and completion rate.
- Reading audit-trail entries that record engagement status changes (previous -> new, who, when).
- Creating Reports as Excel or PDF, including a custom Excel made of toggled sections (summary cards, staff ranking, platform-by-company, daily trend, sessions, staff table).
- Saving the dashboard state as snapshots with notes, then listing, viewing, and deleting them later.

## Capabilities and Constraints

Confirmed functional capabilities (from the live API surface):

- Authentication with a login token and role; all inside routes are guarded.
- Staff directory: create, list with search/department/status filters, update, toggle status, delete, archive, restore.
- Department and Company directories (create, delete).
- Platform directory (Instagram, TikTok, Facebook and equivalents).
- Per-staff engagement stats: staff, department, position, status, total posts, engaged, completed, missed, completion rate.
- Monitoring-session logs: dated sessions with post links and company assignments, plus session archive/restore and archived list.
- Report generation: Excel, PDF, session PDF, and a composable custom Excel with section toggles (summary cards, staff ranking, platform-company, daily, monitoring sessions, staff table).
- Dashboard snapshots: create (name/notes/date range), list, load, delete.
- Audit-trail feed (paginated) of status-change events.
- An AI insights drawer on the dashboard (anomalies and recommendations) — surfaced, but not a core guaranteed-data module.

Technical constraints and facts:

- Web app: React 19 + TypeScript on Vite; heavy incumbent styling in one `index.css` with CSS variables.
- Backend: .NET 8 service (`socihr-backend/Controllers`) exposing a JSON API under `/api`.
- Self-hosted fonts (Geist, Geist Mono); deliberately no external font or asset requests.
- Charts: ECharts via `echarts-for-react`; motion: `framer-motion`; PDF: `jsPDF` + `html2canvas`; export CSS injected by a JS plugin.
- Tailwind is installed and wired into the Vite config, but the incumbent visual system is expressed through custom CSS-variable rules in `index.css`.

## Brand Commitments

- Product / name: SociHR.
- Working tagline: "Social Media Engagement Monitor for HR teams."
- Footer signature: "Crafted by @syaakiirr"; presents itself as an HR-facing social-app product.
- The login surface today presents Enterprise Security Standards claims (SOC 2 Compliance, ISO 27001, AES-256 SSL). These are currently rendered badges in the UI and reflect in-product voice — not independently verified credentials. Record these as present marketing claims, not confirmed facts.

## Evidence on Hand

- The live API contract at `socihr-frontend/src/services/api.ts` (staff, engagement stats, platform/company/department directories, monitoring sessions, reports with the custom Excel, snapshots, audit, archives).
- The route and surface map at `socihr-frontend/src/App.tsx`.
- Brand panel and icons at `socihr-frontend/index.html` and `socihr-frontend/public`.

Not available and must not be fabricated in future work: real staff counts, benchmark metrics, customer testimonials, or independent validation of the SOC 2 / ISO / SSL credential claims.

## Product Principles

1. **Consolidation is the point.** One HR view across platforms beats platform-by-platform juggling; fragmenting the view back into per-platform tools is a step backward.
2. **Monitor behavior, not just output.** What matters is who is visibly engaging on the channels — consistent vs. lagging, per staff — not just the raw number.
3. **Governed and observable.** Every meaningful status change is attributable (who, when, previous -> new), and dashboard state is kept, because trust flows from a defensible record.
4. **Reports and a shared range are primary.** HR works in Excel/PDF and by time window, so dependable export and scoping are basic obligations.
5. **Ship for the busy HR operator.** Fast search, clean status detail, and report output that reads without ceremony.
6. **Protect the current identity.** The dashboard should stay live and ordering-friendly; add surface area only after the primary read is safe.

## Accessibility & Inclusion

- Responsive breakpoints cover desktop and mobile (max 768px and 480px).
- Motion settings are conservative; text reads at 12–15px scales.
- Inputs carry 12px uppercase labels; keyboard and `:focus-visible` outline states are defined in the incumbent CSS.
# Bug Triage — SociHR (React + ASP.NET) — Discussion Only

> Status: **DISCUSSION / NO CODE CHANGE** — per god sign-off `2026-09-03T03-13-20-050Z-5cc50b` (constrain: steer 12× + 8× bash). Step 2 (branch `fix/draft-bug0*`) **HOLD** — tunggu human approve. Main `bf23b20` dirty, jangan tambah branch selagi audit Andy berjalan. Dokumen ini read-only, tiada edit codebase.

_Task asal:_ 1) unhandled exception / null-ref di controller 2) React warning / broken API / state 3) performance N+1 / re-render 4) manual flow login→tick→report→leaderboard — kesemua dari bacaan sedia ada tanpa re-read besar (codegraph + batch `Get-Content` 2026-09-03).

---

## Ringkasan Severity

| ID | Severity | Fail | Kategori | Kesan |
|----|----------|------|----------|-------|
| B1 | **CRITICAL** | `socihr-backend/Controllers/AuthController.cs:24` | Auth / Info Disclosure | Tanpa `[Authorize]` dedah `information_schema` public — enumerasi table/column untuk attacker |
| B2 | **HIGH** | 7 controller (`EngagementController.cs:18`, `MonitoringSessionController.cs:23`, `CompanyController.cs:18`, `DepartmentController.cs:18`, `StaffController.cs:31`, `UsersController.cs:19`, `DashboardController.cs:99`, `AuditController.cs:17`) | Unhandled exception / missing try-catch | DB fail → 500 unhandled, mungkin leak `ex.Message`/`StackTrace`, tiada uniform error envelope |
| B3 | **HIGH** | `EngagementController.cs:37-42`, `MonitoringSessionController.cs:60,103`, `StaffRankingHelper.cs:28`, `DashboardController.cs:523` | Null-deref `!` | `Staff`/`Post`/`Platform`/`Session` null → `NullReferenceException` bila FK cascade / platform dipadam / staff archived |
| B4 | **MEDIUM** | `DashboardController.cs:32`, `ReportsController.cs:32`, `StaffController.cs:25`, `AuthController.cs:32` (`GetDeptIdRestriction` / `GetDeptNameRestrictionAsync`) | Input validation | `Guid.Parse(claim)` tanpa `TryParse` — token tampered / claim rosak → `FormatException` → 500 bukan 401 |
| B5 | **MEDIUM** | `DashboardController.cs:19,104-610` (`CacheTtl=30s`, `IMemoryCache`) | Stale read / correctness | Tick `PATCH /api/engagement/{id}/action` tidak invalidate cache kpi/leaderboard/trend/weekly/monthly — user tick → leaderboard/KPI nampak lapuk 30s, ujian manual report→leaderboard gagal |
| B6 | **MEDIUM** | `socihr-frontend/src/services/api.ts:3-6,317-324`, `socihr-frontend/src/pages/DashboardPage.tsx` (Promise.all), `socihr-frontend/src/pages/LeaderboardPage.tsx` | Frontend broken API / state | `authHeaders()` → `Bearer null` bila token tiada, `addStaffToSession` key casing, `getDashboardTrend` tanpa `AbortSignal`, filter tanpa `useMemo` → re-render tak perlu + abort leak |

---

## B1 — CRITICAL — `GET /api/auth/schema` tanpa auth

- **Lokasi:** `socihr-backend/Controllers/AuthController.cs:24-43`
- **Bukti:** Controller ada `[ApiController][Route(\"api/[controller]\")]` tapi **tiada** `[Authorize]` pada class/method `GetSchema`. Method buka `GetDbConnection()` + query `SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema='public' ORDER BY...` dan `return Ok(list)`. Sebarang client tanpa token boleh `curl /api/auth/schema`.
- **Reproduksi:** `curl -i http://localhost:5094/api/auth/schema` tanpa `Authorization` → 200 + senarai semua table (`Staff`, `Users`, `Engagement` dll).
- **Risiko:** Reconnaissance, bantu SQLi / privilege escalation, bocor nama column `PasswordHash` dll. Langgar prinsip SEC-AUDIT-001.
- **Rekomendasi draft fix (tanpa code):** Tambah `[Authorize(Roles=\"SuperAdmin\")]` atau buang endpoint terus jika hanya debug. Jika perlu debug, guard dengan `Env.IsDevelopment()` dan `[Authorize]`. Tiada branch selagi belum approve.

## B2 — HIGH — Missing try-catch di banyak endpoint

- **Lokasi:** `EngagementController.cs:18-54` (GetBySession, UpdateStatus, UpdateAction, UpdateReason, BulkUpdate) — tiada try-catch langsung; `MonitoringSessionController.cs:23-53` GetAll/GetById/Create tiada; sama untuk `CompanyController.cs:18-33`, `DepartmentController.cs:18-33`, `StaffController.cs:31-381` (hanya Delete/Archive ada), `UsersController.cs:19-149`, `DashboardController.cs:99-238` (hanya snapshot ada), `AuditController.cs:17-71`.
- **Bukti:** Hanya `CompanyController.cs:60` Delete, `DepartmentController.cs:66` Delete, `MonitoringSessionController.cs:205,333` Update/Delete yang bungkus `try{...}catch(Exception ex){ StatusCode(500, ex.Message)}`. Lain-lain biar exception bubble ke middleware → 500 tanpa envelope konsisten, mungkin leak stack di `ReportsController`/`MonitoringSessionController` yang return `ex.StackTrace`.
- **Risiko:** Unhandled DB timeout / connection loss → 500 mentah, log tak seragam, sukar triage. Di `ReportsController` stacktrace dihantar ke client.
- **Rekomendasi:** Uniform `try/catch` + `ILogger` + return `{ message: \"...\" }` tanpa stack di prod, atau guna global `ExceptionHandler` middleware + `ProblemDetails`. Tangguh branch sehingga human pilih gaya.

## B3 — HIGH — Null-deref `!` (Staff/Post/Platform/Session)

- **Lokasi:** `EngagementController.cs:37-43` `e.Staff!.FullName`, `e.Post!.CompanyID`, `e.Post.Platform!.PlatformName`; `MonitoringSessionController.cs:60` `p.Platform!.PlatformName`; `StaffRankingHelper.cs:28-33` `!e.Staff!.IsArchived && !e.Session!.IsArchived` + `g.Key.FullName`; `DashboardController.cs:523` `e.Post!.Platform!`.
- **Reproduksi:** Padam `Platform` yang masih dirujuk `SessionPost` (FK `Restrict` tapi data lama), atau `Staff` di-archive → `Engagement.Staff` null via `Include` gagal → `NullReferenceException` pada `Select`.
- **Risiko:** Crash 500 sewaktu `GET /api/engagement?sessionId=...` / dashboard aggregation, walau data valid.
- **Rekomendasi:** Ganti `!` dengan null-conditional + fallback (`StaffName ?? \"[deleted staff]\"`, skip engagement tanpa `Post`/`Platform`), tambah guard di query `.Where(e => e.Staff != null && e.Post != null)`.

## B4 — MEDIUM — `Guid.Parse` claim tanpa TryParse

- **Lokasi:** `DashboardController.cs:28-32`, `ReportsController.cs:32`, `StaffController.cs:21-27`, `AuthController.cs:110` (`User.FindFirst(\"DepartmentID\")?.Value` → `Guid.Parse`).
- **Bukti:** `return claim != null ? Guid.Parse(claim) : null;` — tiada `TryParse` / try-catch FormatException.
- **Reproduksi:** Token JWT di-tamper (edit claim DepartmentID jadi \"not-a-guid\") atau claim hilang → request ke endpoint `kpi`/`staff-ranking` → 500 bukan 401/400.
- **Rekomendasi:** `Guid.TryParse(claim, out var id) ? id : null` + log warning + return `Unauthorized`/`BadRequest` jika DeptAdmin claim rosak.

## B5 — MEDIUM — Cache stale 30s selepas tick

- **Lokasi:** `DashboardController.cs:19` `CacheTtl = 30s`, `DashboardController.cs:104-112` `GetKpi` + `GetStaffRanking`, `GetTrend`, `GetWeekly`, `GetLeaderboard` semua `CacheKey(... )` + `_cache.TryGetValue` → `_cache.Set(key, r, CacheTtl)`. Tiada invalidation di `EngagementController.cs:86-138` `UpdateAction` / `BulkUpdate` / `MonitoringSessionController.cs` Create/Update.
- **Reproduksi manual flow:** login → `PATCH /api/engagement/{id}/action` `{Action:\"like\", Value:true}` → `GET /api/dashboard/kpi` atau `GET /api/dashboard/leaderboard` dalam 30s → nilai `completed`/`score` masih lama. Report (`GET /api/reports/excel`) guna ranking helper fresh (tiada cache) jadi report betul tapi leaderboard nampak salah — user lapor \"leaderboard tidak update\".
- **Rekomendasi:** Pada mutasi engagement/session/staff, panggil `_cache.Remove` / `Compact` atau guna `CancellationChangeToken` per session. Alternatif: `CacheTtl` lebih pendek untuk leaderboard (5s) atau tambah `Cache-Control: no-cache` untuk ranking. Perlu human pilih strategi.

## B6 — MEDIUM — Frontend broken API / re-render

- **Lokasi:**
  - `socihr-frontend/src/services/api.ts:3-8` `Authorization: Bearer ${localStorage.getItem(\"token\")}` → bila token null jadi `\"Bearer null\"` → backend 401 raw, tiada redirect ke `/login`.
  - `socihr-frontend/src/services/api.ts:317-324` `addStaffToSession` hantar `{ StaffIds: [...] }` (Pascal) — backend `AddStaffToSessionRequest` expect `StaffIds` betul tapi JSON serializer default `PropertyNameCaseInsensitive=true` jadi hidup, namun kontrak rapuh.
  - `socihr-frontend/src/pages/DashboardPage.tsx` `Promise.all([... getDashboardTrend(from,to) ])` — 8 call patut ada `signal` tapi `getDashboardTrend` dipanggil tanpa `signal` → abort tidak batalkan trend, leak request bila user tukar filter cepat.
  - `socihr-frontend/src/pages/LeaderboardPage.tsx` `filteredList = leaderboard.filter(...)` setiap render tanpa `useMemo` → re-render besar bila list panjang.
  - `socihr-frontend/src/pages/LoginPage.tsx:12-25` `statuses` array dibuat tiap render, `useEffect` depend `[statuses.length]` walau stabil, interval 4s tetap reset tiap render.
- **Risiko:** UX error samar, warning console, unnecessary re-render dashboard/leaderboard.
- **Rekomendasi:** Guard `authHeaders()` → jika `!token` return `{}` atau redirect; seragamkan DTO casing (`staffIds` camel); pass `signal` ke semua dashboard call + `useMemo` untuk `filteredList`. Tidak perlukan branch sekarang.

---

## Manual Flow Trace (code-only, appendix)

**Login → Tick → Report → Leaderboard** tanpa DB live:

1. **Login:** `LoginPage.tsx:27-41` `POST /api/auth/login` → simpan `token/username/role` di `localStorage`, dispatch `trigger-login-transition`. `AuthController.cs:45-134` verify BCrypt/hash, auto-heal role `Admin→SuperAdmin`, isu plain-text fallback masih ada tapi bukan fokus triage ini.
2. **Tick engagement:** `MonitoringPage.tsx:198-234` `handleAction` optimistic update `isLiked/isCommented/isShared` + `status = all3 ? Completed : Missed`, panggil `PATCH /api/engagement/{id}/action` (`api.ts:286-297`). Backend `EngagementController.cs:86-138` set 3 bool + `Status = all3 ? Completed : Missed`, tambah `AuditTrail` jika status berubah. Front back sudah konsisten (kiraan `ticked = liked+commented+shared`, `expected=3` di `TickHelper.cs:16`).
3. **Generate report:** `ReportsPage.tsx` → `buildReportUrl(\"excel\"/\"pdf\")` + `downloadCustomReportExcel` ke `POST /api/reports/custom-excel` / `GET /api/reports/pdf`. `ReportsController.cs:129+` guna `StaffRankingHelper.GetRankingMultiDept` + `GetPlatformStatsMultiDept` — fresh query tanpa cache, jadi laporan betul.
4. **Leaderboard:** `LeaderboardPage.tsx` → `GET /api/dashboard/leaderboard` (`DashboardController.cs:533-612`) guna `StaffRankingHelper.GetRanking` (Completed/Total*3) + `GroupBy StaffID` untuk `Likes/Comments/Shares` + `score = Completed*10 + Shares*3 + Comments*2 + Likes`. **Mismatch:** cache 30s (B5) buat leaderboard lapuk vs report fresh — ini punca utama aduan \"leaderboard tidak update\".

**Kesimpulan flow:** Logik tick/report/leaderboard konsisten di server, satu-satunya ketidakkonsistenan ialah cache layer, bukan formula rate.

---

## Cadangan Prioriti (untuk human approve sebelum branch)

1. B1 kritik — tutup `GET /api/auth/schema` serta-merta (1-line `[Authorize]`).
2. B4 `Guid.TryParse` — kecil, selamat.
3. B3 null guard — tambah fallback tanpa ubah schema.
4. B2 uniform error handling — perlukan keputusan middleware vs try-catch.
5. B5 cache invalidation — perlukan pilihan design (invalidate vs TTL pendek).
6. B6 frontend guard — boleh bundel sebagai `fix/frontend-api-consistency`.

Semua di atas **belum di-branch** — dokumen ini sahaja deliverable Step 1. Inform `god` bila sedia untuk Step 2 branch.

---
*Generated read-only 2026-09-03, evidence dari bacaan sedia ada (controller + `api.ts` + 3 pages), tanpa re-read besar tambahan per constraint.*

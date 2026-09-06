using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using socihr_backend.Data;
using socihr_backend.Helpers;
using socihr_backend.Models;
using System.Text.Json;

namespace socihr_backend.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class DashboardController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IMemoryCache _cache;
    private static readonly TimeSpan CacheTtl = TimeSpan.FromSeconds(30); // B5: TL 30s stale â€” draft fix suggests 5s for leaderboard or explicit invalidation on Engagement mutation

    public DashboardController(AppDbContext db, IMemoryCache cache) { _db = db; _cache = cache; }

    // Helper: get DepartmentID for DeptAdmin, null for SuperAdmin
    private Guid? GetDeptIdRestriction()
    {
        if (User.IsInRole("DeptAdmin"))
        {
            var claim = User.FindFirst("DepartmentID")?.Value;
            return claim != null ? Guid.Parse(claim) : null;
        }
        return null;
    }

    private async Task<string?> GetDeptNameRestrictionAsync()
    {
        var deptId = GetDeptIdRestriction();
        if (!deptId.HasValue) return null;
        return await _db.Departments
            .Where(d => d.DepartmentID == deptId)
            .Select(d => d.DepartmentName)
            .FirstOrDefaultAsync();
    }

    // ── Helpers ──────────────────────────────────────────

    private string CacheKey(string prefix, DateTime? from, DateTime? to) =>
        $"{prefix}|{from?.ToString("yyyyMMdd") ?? "na"}|{to?.ToString("yyyyMMdd") ?? "na"}";

    private IQueryable<Engagement> FilteredEngagements(DateTime? from, DateTime? to)
    {
        var q = _db.Engagements
            .AsNoTracking()
            .Where(e => !e.Session!.IsArchived);
        if (from.HasValue)
        {
            var fd = DateOnly.FromDateTime(from.Value);
            q = q.Where(e => e.Session!.SessionDate >= fd);
        }
        if (to.HasValue)
        {
            var td = DateOnly.FromDateTime(to.Value);
            q = q.Where(e => e.Session!.SessionDate <= td);
        }
        return q;
    }

    // ── Aggregation helpers that run entirely on the server ──

    private sealed record KpiTotals(int Staff, int Sessions, int Platforms, int Expected, int Completed, int Missed, double Rate);

    private async Task<KpiTotals> ComputeKpiAsync(DateTime? from, DateTime? to, string? deptName = null)
    {
        // Base staff/sessions counts — filtered by department if DeptAdmin
        var staffQ = _db.Staff.Where(s => s.Status == "Active" && !s.IsArchived);
        if (deptName != null) staffQ = staffQ.Where(s => s.Department == deptName);
        var totalStaff = await staffQ.CountAsync();

        var totalSessions = await _db.MonitoringSessions.CountAsync(s => !s.IsArchived);
        var totalPlatforms = await _db.Platforms.CountAsync();

        var engQ = FilteredEngagements(from, to);
        // DeptAdmin: filter engagements to only staff in their department
        if (deptName != null)
            engQ = engQ.Where(e => e.Staff!.Department == deptName);

        var count = await engQ.CountAsync();
        var liked = await engQ.CountAsync(e => e.IsLiked);
        var commented = await engQ.CountAsync(e => e.IsCommented);
        var shared = await engQ.CountAsync(e => e.IsShared);

        var totalExpected = count * 3;
        var totalCompleted = liked + commented + shared;
        var totalMissed = totalExpected - totalCompleted;
        var rate = totalExpected > 0 ? Math.Round((double)totalCompleted / totalExpected * 100, 1) : 0;

        return new KpiTotals(totalStaff, totalSessions, totalPlatforms, totalExpected, totalCompleted, totalMissed, rate);
    }

    // /api/dashboard/kpi
    [HttpGet("kpi")]
    public async Task<IActionResult> GetKpi([FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var deptName = await GetDeptNameRestrictionAsync();
        var key = CacheKey($"kpi|{deptName ?? "all"}", from, to);
        if (_cache.TryGetValue(key, out KpiTotals? cached) && cached != null)
            return Ok(new { totalStaff = cached.Staff, totalSessions = cached.Sessions, totalPlatforms = cached.Platforms, totalExpected = cached.Expected, totalCompleted = cached.Completed, totalMissed = cached.Missed, completionRate = cached.Rate });

        var r = await ComputeKpiAsync(from, to, deptName);
        _cache.Set(key, r, CacheTtl);

        return Ok(new { totalStaff = r.Staff, totalSessions = r.Sessions, totalPlatforms = r.Platforms, totalExpected = r.Expected, totalCompleted = r.Completed, totalMissed = r.Missed, completionRate = r.Rate });
    }

    // /api/dashboard/monthly
    [HttpGet("monthly")]
    public async Task<IActionResult> GetMonthly([FromQuery] int? year)
    {
        var y = year ?? DateTime.UtcNow.Year;
        var key = CacheKey("monthly", null, null) + $"|{y}";
        if (_cache.TryGetValue(key, out object? cached) && cached != null)
            return Ok(cached);

        var data = await _db.Engagements
            .AsNoTracking()
            .Where(e => e.Session!.SessionDate.Year == y && !e.Session.IsArchived)
            .GroupBy(e => e.Session!.SessionDate.Month)
            .Select(g => new
            {
                Month = g.Key,
                Completed = g.Sum(e => (e.IsLiked ? 1 : 0) + (e.IsCommented ? 1 : 0) + (e.IsShared ? 1 : 0)),
                Missed = g.Sum(e => 3 - ((e.IsLiked ? 1 : 0) + (e.IsCommented ? 1 : 0) + (e.IsShared ? 1 : 0))),
                Total = g.Count() * 3
            })
            .OrderBy(g => g.Month)
            .ToListAsync();

        _cache.Set(key, data, CacheTtl);
        return Ok(data);
    }

    // /api/dashboard/weekly
    [HttpGet("weekly")]
    public async Task<IActionResult> GetWeekly([FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var key = CacheKey("weekly", from, to);
        if (_cache.TryGetValue(key, out object? cached) && cached != null)
            return Ok(cached);

        var sessionsQuery = _db.MonitoringSessions.AsNoTracking()
            .Where(s => !s.IsArchived)
            .AsQueryable();

        if (from.HasValue || to.HasValue)
        {
            if (from.HasValue) { var fd = DateOnly.FromDateTime(from.Value); sessionsQuery = sessionsQuery.Where(s => s.SessionDate >= fd); }
            if (to.HasValue) { var td = DateOnly.FromDateTime(to.Value); sessionsQuery = sessionsQuery.Where(s => s.SessionDate <= td); }
        }
        else
        {
            var cutoff = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-84));
            sessionsQuery = sessionsQuery.Where(s => s.SessionDate >= cutoff);
        }

        var sessions = await sessionsQuery.OrderBy(s => s.SessionDate).ToListAsync();
        var sessionIds = sessions.Select(s => s.SessionID).ToList();
        if (sessionIds.Count == 0) { _cache.Set(key, new List<object>(), CacheTtl); return Ok(Array.Empty<object>()); }

        // Aggregate by session in one server-side pass
        var engAgg = await _db.Engagements
            .AsNoTracking()
            .Where(e => sessionIds.Contains(e.SessionID))
            .GroupBy(e => e.SessionID)
            .Select(g => new
            {
                SessionID = g.Key,
                Completed = g.Sum(e => (e.IsLiked ? 1 : 0) + (e.IsCommented ? 1 : 0) + (e.IsShared ? 1 : 0)),
                Total = g.Count() * 3
            })
            .ToListAsync();

        var lookup = engAgg.ToDictionary(a => a.SessionID);

        var grouped = sessions
            .GroupBy(s =>
            {
                var date = s.SessionDate.ToDateTime(TimeOnly.MinValue);
                var cal = System.Globalization.CultureInfo.InvariantCulture.Calendar;
                var week = cal.GetWeekOfYear(date, System.Globalization.CalendarWeekRule.FirstFourDayWeek, DayOfWeek.Monday);
                return $"{s.SessionDate.Year}-W{week:D2}";
            })
            .Select(g =>
            {
                var completed = g.Sum(s => lookup.TryGetValue(s.SessionID, out var a) ? a.Completed : 0);
                var total = g.Sum(s => lookup.TryGetValue(s.SessionID, out var a) ? a.Total : 0);
                return new { Week = g.Key, Completed = completed, Missed = total - completed, Total = total };
            })
            .OrderBy(g => g.Week)
            .ToList();

        _cache.Set(key, grouped, CacheTtl);
        return Ok(grouped);
    }

    // /api/dashboard/platform-comparison
    [HttpGet("platform-comparison")]
    public async Task<IActionResult> GetPlatformComparison([FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var key = CacheKey("platform", from, to);
        if (_cache.TryGetValue(key, out object? cached) && cached != null)
            return Ok(cached);

        var data = await FilteredEngagements(from, to)
            .GroupBy(e => e.Post!.Platform!.PlatformName)
            .Select(g => new
            {
                Platform = g.Key,
                Completed = g.Sum(e => (e.IsLiked ? 1 : 0) + (e.IsCommented ? 1 : 0) + (e.IsShared ? 1 : 0)),
                Missed = g.Sum(e => 3 - ((e.IsLiked ? 1 : 0) + (e.IsCommented ? 1 : 0) + (e.IsShared ? 1 : 0))),
                Total = g.Count() * 3
            })
            .ToListAsync();

        _cache.Set(key, data, CacheTtl);
        return Ok(data);
    }

    // /api/dashboard/staff-ranking
    [HttpGet("staff-ranking")]
    public async Task<IActionResult> GetStaffRanking([FromQuery] int limit = 13, [FromQuery] string order = "top", [FromQuery] DateTime? from = null, [FromQuery] DateTime? to = null)
    {
        var deptName = await GetDeptNameRestrictionAsync();
        var key = CacheKey($"ranking|{order}|{limit}|{deptName ?? "all"}", from, to);
        if (_cache.TryGetValue(key, out object? cached) && cached != null)
            return Ok(cached);

        var data = await StaffRankingHelper.GetRanking(_db, order, limit, from, to, deptName);
        _cache.Set(key, data, CacheTtl);
        return Ok(data.Select(d => new { d.StaffID, d.FullName, d.Department, d.Completed, d.Total, d.CompletionRate }).ToList());
    }

    // /api/dashboard/heatmap
    [HttpGet("heatmap")]
    public async Task<IActionResult> GetHeatmap([FromQuery] int? year)
    {
        var y = year ?? DateTime.UtcNow.Year;
        var key = CacheKey("heatmap", null, null) + $"|{y}";
        if (_cache.TryGetValue(key, out object? cached) && cached != null)
            return Ok(cached);

        var startDate = new DateOnly(y, 1, 1);
        var endDate = new DateOnly(y, 12, 31);

        var data = await _db.Engagements
            .AsNoTracking()
            .Where(e => e.Session!.SessionDate >= startDate && e.Session.SessionDate <= endDate && !e.Session.IsArchived)
            .GroupBy(e => e.Session!.SessionDate)
            .Select(g => new
            {
                Date = g.Key,
                Completed = g.Sum(e => (e.IsLiked ? 1 : 0) + (e.IsCommented ? 1 : 0) + (e.IsShared ? 1 : 0)),
                Total = g.Count() * 3
            })
            .OrderBy(g => g.Date)
            .ToListAsync();

        _cache.Set(key, data, CacheTtl);
        return Ok(data);
    }

    // /api/dashboard/company-performance
    [HttpGet("company-performance")]
    public async Task<IActionResult> GetCompanyPerformance([FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var key = CacheKey("company", from, to);
        if (_cache.TryGetValue(key, out object? cached) && cached != null)
            return Ok(cached);

        var companies = await _db.Companies.AsNoTracking().OrderBy(c => c.CompanyName).ToListAsync();

        // Aggregate engagement ticks per company in one server-side pass
        var engAggQuery = _db.Engagements
            .AsNoTracking()
            .Where(e => e.Post!.CompanyID != null && !e.Session!.IsArchived);
        if (from.HasValue)
        {
            var fd = DateOnly.FromDateTime(from.Value);
            engAggQuery = engAggQuery.Where(e => e.Session!.SessionDate >= fd);
        }
        if (to.HasValue)
        {
            var td = DateOnly.FromDateTime(to.Value);
            engAggQuery = engAggQuery.Where(e => e.Session!.SessionDate <= td);
        }
        var engAgg = await engAggQuery
            .GroupBy(e => e.Post!.CompanyID!.Value)
            .Select(g => new
            {
                CompanyID = g.Key,
                Completed = g.Sum(e => (e.IsLiked ? 1 : 0) + (e.IsCommented ? 1 : 0) + (e.IsShared ? 1 : 0)),
                Total = g.Count() * 3
            })
            .ToListAsync();

        var lookup = engAgg.ToDictionary(a => a.CompanyID);

        var result = companies.Select(c =>
        {
            var a = lookup.GetValueOrDefault(c.CompanyID);
            var completed = a?.Completed ?? 0;
            var total = a?.Total ?? 0;
            var missed = total - completed;
            var rate = total > 0 ? Math.Round((double)completed / total * 100, 1) : 0;
            return new { c.CompanyID, Company = c.CompanyName, Completed = completed, Missed = missed, Total = total, Rate = rate };
        }).ToList();

        _cache.Set(key, result, CacheTtl);
        return Ok(result);
    }

    // ═══════════════════════════════════════════════════════════════
    // SNAPSHOT ENDPOINTS
    // ═══════════════════════════════════════════════════════════════

    [HttpPost("snapshot/create")]
    public async Task<IActionResult> CreateSnapshot([FromBody] CreateSnapshotRequest req)
    {
        try
        {
            var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            var userId = userIdClaim != null && Guid.TryParse(userIdClaim, out var _parsedUserId) ? _parsedUserId : Guid.Empty;

            DateTime? snapshotFrom = null;
            DateTime? snapshotTo = null;
            if (!string.IsNullOrEmpty(req.FromDate) && DateTime.TryParse(req.FromDate, out var parsedFrom)) snapshotFrom = parsedFrom;
            if (!string.IsNullOrEmpty(req.ToDate) && DateTime.TryParse(req.ToDate, out var parsedTo)) snapshotTo = parsedTo;

            var kpiData = await ComputeKpiAsync(snapshotFrom, snapshotTo);
            var monthlyData = await GetMonthlyData(DateTime.UtcNow.Year);
            var platformData = await GetPlatformData();
            var topStaff = await StaffRankingHelper.GetRanking(_db, "top", 10, snapshotFrom, snapshotTo);
            var bottomStaff = await StaffRankingHelper.GetRanking(_db, "bottom", 10, snapshotFrom, snapshotTo);

            var dashboardState = new
            {
                kpi = new { kpiData.Staff, kpiData.Sessions, kpiData.Platforms, kpiData.Expected, kpiData.Completed, kpiData.Missed, Rate = kpiData.Rate },
                monthly = monthlyData,
                platform = platformData,
                topStaff = topStaff.Select(d => new { d.StaffID, d.FullName, d.Department, d.Completed, d.Total, d.CompletionRate }),
                bottomStaff = bottomStaff.Select(d => new { d.StaffID, d.FullName, d.Department, d.Completed, d.Total, d.CompletionRate }),
                capturedAt = DateTime.UtcNow
            };

            var options = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

            var snapshot = new DashboardSnapshot
            {
                SnapshotID = Guid.NewGuid(),
                SnapshotName = req.Name,
                SnapshotDate = DateTime.UtcNow,
                SnapshotData = JsonSerializer.Serialize(dashboardState, options),
                CreatedBy = userId,
                CreatedAt = DateTime.UtcNow,
                Notes = req.Notes
            };

            _db.DashboardSnapshots.Add(snapshot);
            await _db.SaveChangesAsync();

            return Ok(new { snapshotID = snapshot.SnapshotID, message = "Dashboard snapshot saved successfully." });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [HttpGet("snapshot/list")]
    public async Task<IActionResult> GetSnapshots()
    {
        try
        {
            var snapshots = await _db.DashboardSnapshots
                .AsNoTracking()
                .OrderByDescending(s => s.SnapshotDate)
                .Select(s => new { s.SnapshotID, s.SnapshotName, s.SnapshotDate, s.CreatedBy, s.CreatedAt, s.Notes })
                .ToListAsync();
            return Ok(snapshots);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [HttpGet("snapshot/{id}")]
    public async Task<IActionResult> GetSnapshot(Guid id)
    {
        try
        {
            var snapshot = await _db.DashboardSnapshots.AsNoTracking().FirstOrDefaultAsync(s => s.SnapshotID == id);
            if (snapshot == null) return NotFound(new { message = "Snapshot not found." });

            using var doc = JsonDocument.Parse(snapshot.SnapshotData);
            var root = doc.RootElement.Clone();

            return Ok(new { snapshot.SnapshotID, snapshot.SnapshotName, snapshot.SnapshotDate, snapshot.CreatedBy, snapshot.Notes, data = root });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [HttpDelete("snapshot/{id}")]
    public async Task<IActionResult> DeleteSnapshot(Guid id)
    {
        try
        {
            var snapshot = await _db.DashboardSnapshots.FirstOrDefaultAsync(s => s.SnapshotID == id);
            if (snapshot == null) return NotFound(new { message = "Snapshot not found." });

            _db.DashboardSnapshots.Remove(snapshot);
            await _db.SaveChangesAsync();
            return Ok(new { message = "Snapshot deleted successfully." });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    // ── Snapshot helper methods ──

    private async Task<object> GetMonthlyData(int year)
    {
        return await _db.Engagements
            .AsNoTracking()
            .Where(e => e.Session!.SessionDate.Year == year && !e.Session.IsArchived)
            .GroupBy(e => e.Session!.SessionDate.Month)
            .Select(g => new
            {
                Month = g.Key,
                Completed = g.Sum(e => (e.IsLiked ? 1 : 0) + (e.IsCommented ? 1 : 0) + (e.IsShared ? 1 : 0)),
                Missed = g.Sum(e => 3 - ((e.IsLiked ? 1 : 0) + (e.IsCommented ? 1 : 0) + (e.IsShared ? 1 : 0))),
                Total = g.Count() * 3
            })
            .OrderBy(g => g.Month)
            .ToListAsync();
    }

    // ── Trend (Timeline multi-metric) ───────────────────
    // /api/dashboard/trend
    [HttpGet("trend")]
    public async Task<IActionResult> GetTrend([FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var deptName = await GetDeptNameRestrictionAsync();
        var key = CacheKey($"trend|{deptName ?? "all"}", from, to);
        if (_cache.TryGetValue(key, out object? cached) && cached != null)
            return Ok(cached);

        var sessionsQ = _db.MonitoringSessions
            .AsNoTracking()
            .Where(s => !s.IsArchived);

        if (from.HasValue)
        {
            var fd = DateOnly.FromDateTime(from.Value);
            sessionsQ = sessionsQ.Where(s => s.SessionDate >= fd);
        }
        if (to.HasValue)
        {
            var td = DateOnly.FromDateTime(to.Value);
            sessionsQ = sessionsQ.Where(s => s.SessionDate <= td);
        }

        var sessions = await sessionsQ.OrderBy(s => s.SessionDate).ToListAsync();
        var sessionIds = sessions.Select(s => s.SessionID).ToList();

        if (sessionIds.Count == 0)
        {
            return Ok(Array.Empty<object>());
        }

        var engQ = _db.Engagements
            .AsNoTracking()
            .Where(e => sessionIds.Contains(e.SessionID));

        if (deptName != null)
            engQ = engQ.Where(e => e.Staff!.Department == deptName);

        var aggregated = await engQ
            .GroupBy(e => e.SessionID)
            .Select(g => new
            {
                SessionID = g.Key,
                Likes = g.Count(e => e.IsLiked),
                Comments = g.Count(e => e.IsCommented),
                Shares = g.Count(e => e.IsShared),
                Completed = g.Sum(e => (e.IsLiked ? 1 : 0) + (e.IsCommented ? 1 : 0) + (e.IsShared ? 1 : 0)),
                Total = g.Count() * 3
            })
            .ToListAsync();

        var aggMap = aggregated.ToDictionary(a => a.SessionID);

        var result = sessions.Select(s =>
        {
            aggMap.TryGetValue(s.SessionID, out var a);
            var total = a?.Total ?? 0;
            var completed = a?.Completed ?? 0;
            var rate = total > 0 ? Math.Round((double)completed / total * 100, 1) : 0;
            return new
            {
                sessionId = s.SessionID,
                date = s.SessionDate.ToString("yyyy-MM-dd"),
                label = s.SessionDate.ToString("dd MMM"),
                likes = a?.Likes ?? 0,
                comments = a?.Comments ?? 0,
                shares = a?.Shares ?? 0,
                completed,
                missed = total - completed,
                total,
                rate
            };
        }).ToList();

        _cache.Set(key, result, CacheTtl);
        return Ok(result);
    }

    // ── Leaderboard (Gamified Rankings) ───────────────────
    // /api/dashboard/leaderboard
    [HttpGet("leaderboard")]
    public async Task<IActionResult> GetLeaderboard(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] string? department = null)
    {
        var restrictedDept = await GetDeptNameRestrictionAsync();
        var filterDept = restrictedDept ?? department;

        var key = CacheKey($"leaderboard|{filterDept ?? "all"}", from, to);
        if (_cache.TryGetValue(key, out object? cached) && cached != null)
            return Ok(cached);

        var ranking = await StaffRankingHelper.GetRanking(_db, "top", null, from, to, filterDept);

        // Get engagement breakdown (likes/comments/shares) per staff
        var staffIds = ranking.Select(r => r.StaffID).ToList();
        var engCounts = await _db.Engagements
            .AsNoTracking()
            .Where(e => !e.Session!.IsArchived && staffIds.Contains(e.StaffID))
            .Where(e => !from.HasValue || e.Session!.SessionDate >= DateOnly.FromDateTime(from.Value))
            .Where(e => !to.HasValue || e.Session!.SessionDate <= DateOnly.FromDateTime(to.Value))
            .GroupBy(e => e.StaffID)
            .Select(g => new
            {
                StaffID = g.Key,
                Likes = g.Count(e => e.IsLiked),
                Comments = g.Count(e => e.IsCommented),
                Shares = g.Count(e => e.IsShared)
            })
            .ToDictionaryAsync(g => g.StaffID);

        var staffPositions = await _db.Staff
            .AsNoTracking()
            .Where(s => staffIds.Contains(s.StaffID))
            .ToDictionaryAsync(s => s.StaffID, s => s.Position ?? "Staff");

        var leaderboard = ranking.Select((r, idx) =>
        {
            var rank = idx + 1;
            engCounts.TryGetValue(r.StaffID, out var counts);
            staffPositions.TryGetValue(r.StaffID, out var position);

            var likes = counts?.Likes ?? 0;
            var comments = counts?.Comments ?? 0;
            var shares = counts?.Shares ?? 0;

            // Score formula: (Completed * 10) + (Shares * 3) + (Comments * 2) + (Likes * 1)
            var score = (r.Completed * 10) + (shares * 3) + (comments * 2) + likes;

            string tier = r.CompletionRate >= 90 ? "Diamond"
                        : r.CompletionRate >= 75 ? "Gold"
                        : r.CompletionRate >= 50 ? "Silver"
                        : "Bronze";

            string? medal = rank == 1 ? "🥇" : rank == 2 ? "🥈" : rank == 3 ? "🥉" : null;

            return new
            {
                rank,
                staffID = r.StaffID,
                fullName = r.FullName,
                department = string.IsNullOrWhiteSpace(r.Department) || r.Department == "-" ? "General" : r.Department,
                position = position ?? "Staff",
                completed = r.Completed,
                total = r.Total,
                missed = r.Total - r.Completed,
                completionRate = r.CompletionRate,
                likes,
                comments,
                shares,
                score,
                tier,
                medal
            };
        }).ToList();

        _cache.Set(key, leaderboard, CacheTtl);
        return Ok(leaderboard);
    }

    private async Task<object> GetPlatformData()
    {
        return await _db.Engagements
            .AsNoTracking()
            .Where(e => !e.Session!.IsArchived)
            .GroupBy(e => e.Post!.Platform!.PlatformName)
            .Select(g => new
            {
                Platform = g.Key,
                Completed = g.Sum(e => (e.IsLiked ? 1 : 0) + (e.IsCommented ? 1 : 0) + (e.IsShared ? 1 : 0)),
                Missed = g.Sum(e => 3 - ((e.IsLiked ? 1 : 0) + (e.IsCommented ? 1 : 0) + (e.IsShared ? 1 : 0))),
                Total = g.Count() * 3
            })
            .ToListAsync();
    }

    // ── Session Comparison ────────────────────────────────
    // /api/dashboard/session-comparison?sessionA=xxx&sessionB=yyy
    [HttpGet("session-comparison")]
    public async Task<IActionResult> CompareSessions(
        [FromQuery] Guid sessionA,
        [FromQuery] Guid sessionB)
    {
        var sA = await _db.MonitoringSessions.FirstOrDefaultAsync(s => s.SessionID == sessionA);
        var sB = await _db.MonitoringSessions.FirstOrDefaultAsync(s => s.SessionID == sessionB);

        if (sA == null || sB == null)
            return BadRequest(new { message = "Both session IDs must be valid." });

        async Task<object> BuildSessionStats(MonitoringSession session)
        {
            var engs = await _db.Engagements
                .AsNoTracking()
                .Include(e => e.Staff)
                .Include(e => e.Post)
                    .ThenInclude(p => p!.Platform)
                .Where(e => e.SessionID == session.SessionID)
                .ToListAsync();

            var totalStaff = engs.Select(e => e.StaffID).Distinct().Count();
            var totalExpected = engs.Count * 3;
            var likes = engs.Count(e => e.IsLiked);
            var comments = engs.Count(e => e.IsCommented);
            var shares = engs.Count(e => e.IsShared);
            var completed = likes + comments + shares;
            var missed = totalExpected - completed;
            var rate = totalExpected > 0 ? Math.Round((double)completed / totalExpected * 100, 1) : 0;

            var deptBreakdown = engs
                .GroupBy(e => e.Staff?.Department ?? "No Department")
                .Select(g =>
                {
                    var dTotal = g.Count() * 3;
                    var dCompleted = g.Sum(e => (e.IsLiked ? 1 : 0) + (e.IsCommented ? 1 : 0) + (e.IsShared ? 1 : 0));
                    var dRate = dTotal > 0 ? Math.Round((double)dCompleted / dTotal * 100, 1) : 0;
                    return new
                    {
                        department = g.Key,
                        staffCount = g.Select(e => e.StaffID).Distinct().Count(),
                        completed = dCompleted,
                        total = dTotal,
                        rate = dRate
                    };
                })
                .OrderByDescending(d => d.rate)
                .ToList();

            var platformBreakdown = engs
                .GroupBy(e => e.Post?.Platform?.PlatformName ?? "Unknown")
                .Select(g => new
                {
                    platform = g.Key,
                    likes = g.Count(e => e.IsLiked),
                    comments = g.Count(e => e.IsCommented),
                    shares = g.Count(e => e.IsShared),
                    completed = g.Sum(e => (e.IsLiked ? 1 : 0) + (e.IsCommented ? 1 : 0) + (e.IsShared ? 1 : 0)),
                    total = g.Count() * 3
                })
                .ToList();

            return new
            {
                sessionId = session.SessionID,
                date = session.SessionDate.ToString("yyyy-MM-dd"),
                totalStaff,
                totalExpected,
                completed,
                missed,
                likes,
                comments,
                shares,
                rate,
                departments = deptBreakdown,
                platforms = platformBreakdown
            };
        }

        var statsA = await BuildSessionStats(sA);
        var statsB = await BuildSessionStats(sB);

        return Ok(new
        {
            sessionA = statsA,
            sessionB = statsB
        });
    }
}

public record CreateSnapshotRequest(string Name, string? FromDate, string? ToDate, string? Notes);



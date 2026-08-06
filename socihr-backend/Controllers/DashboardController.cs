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
    private static readonly TimeSpan CacheTtl = TimeSpan.FromSeconds(30);

    public DashboardController(AppDbContext db, IMemoryCache cache) { _db = db; _cache = cache; }

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

    private async Task<KpiTotals> ComputeKpiAsync(DateTime? from, DateTime? to)
    {
        var totalStaff = await _db.Staff.CountAsync(s => s.Status == "Active" && !s.IsArchived);
        var totalSessions = await _db.MonitoringSessions.CountAsync(s => !s.IsArchived);
        var totalPlatforms = await _db.Platforms.CountAsync();

        var engQ = FilteredEngagements(from, to);

        // Push all aggregation to the database — no client-side materialisation.
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
        var key = CacheKey("kpi", from, to);
        if (_cache.TryGetValue(key, out KpiTotals? cached) && cached != null)
            return Ok(new { totalStaff = cached.Staff, totalSessions = cached.Sessions, totalPlatforms = cached.Platforms, totalExpected = cached.Expected, totalCompleted = cached.Completed, totalMissed = cached.Missed, completionRate = cached.Rate });

        var r = await ComputeKpiAsync(from, to);
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
        var key = CacheKey($"ranking|{order}|{limit}", from, to);
        if (_cache.TryGetValue(key, out object? cached) && cached != null)
            return Ok(cached);

        var data = await StaffRankingHelper.GetRanking(_db, order, limit, from, to);
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
            var userId = userIdClaim != null ? Guid.Parse(userIdClaim) : Guid.Empty;

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
}

public record CreateSnapshotRequest(string Name, string? FromDate, string? ToDate, string? Notes);

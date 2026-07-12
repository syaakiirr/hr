using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
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
    public DashboardController(AppDbContext db) => _db = db;

    // GET /api/dashboard/kpi?from=2026-01-01&to=2026-12-31
    [HttpGet("kpi")]
    public async Task<IActionResult> GetKpi([FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var totalStaff = await _db.Staff.CountAsync(s => s.Status == "Active");
        var totalSessions = await _db.MonitoringSessions.CountAsync();
        var totalPlatforms = await _db.Platforms.CountAsync();

        var engQuery = _db.Engagements
            .Include(e => e.Post).ThenInclude(p => p!.Platform)
            .AsQueryable();

        if (from.HasValue)
        {
            var fromDate = DateOnly.FromDateTime(from.Value);
            engQuery = engQuery.Where(e => e.Session!.SessionDate >= fromDate);
        }
        if (to.HasValue)
        {
            var toDate = DateOnly.FromDateTime(to.Value);
            engQuery = engQuery.Where(e => e.Session!.SessionDate <= toDate);
        }

        var engagements = await engQuery.ToListAsync();

        // Count ticks at action level: each checkbox = 1 tick
        var totalCompleted = engagements.Sum(e => TickHelper.Ticked(e.Post!.Platform!.PlatformName, e.IsLiked, e.IsCommented, e.IsShared));
        var totalExpected = engagements.Sum(e => TickHelper.Expected(e.Post!.Platform!.PlatformName));
        var totalMissed = totalExpected - totalCompleted;
        var completionRate = totalExpected > 0 ? Math.Round((double)totalCompleted / totalExpected * 100, 1) : 0;

        return Ok(new
        {
            totalStaff,
            totalSessions,
            totalPlatforms,
            totalExpected,
            totalCompleted,
            totalMissed,
            completionRate
        });
    }

    // GET /api/dashboard/monthly  — monthly engagement trend
    [HttpGet("monthly")]
    public async Task<IActionResult> GetMonthly([FromQuery] int? year)
    {
        var y = year ?? DateTime.UtcNow.Year;

        var engagements = await _db.Engagements
            .Include(e => e.Session)
            .Include(e => e.Post).ThenInclude(p => p!.Platform)
            .Where(e => e.Session!.SessionDate.Year == y)
            .ToListAsync();

        var data = engagements
            .GroupBy(e => e.Session!.SessionDate.Month)
            .Select(g => new
            {
                Month = g.Key,
                Completed = g.Sum(e => TickHelper.Ticked(e.Post!.Platform!.PlatformName, e.IsLiked, e.IsCommented, e.IsShared)),
                Missed = g.Sum(e => TickHelper.Missed(e.Post!.Platform!.PlatformName, e.IsLiked, e.IsCommented, e.IsShared)),
                Total = g.Sum(e => TickHelper.Expected(e.Post!.Platform!.PlatformName))
            })
            .OrderBy(g => g.Month)
            .ToList();

        return Ok(data);
    }

    // GET /api/dashboard/weekly  — last 12 weeks
    [HttpGet("weekly")]
    public async Task<IActionResult> GetWeekly()
    {
        var cutoff = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-84)); // 12 weeks

        var sessions = await _db.MonitoringSessions
            .Where(s => s.SessionDate >= cutoff)
            .OrderBy(s => s.SessionDate)
            .ToListAsync();

        var sessionIds = sessions.Select(s => s.SessionID).ToList();
        var engagements = await _db.Engagements
            .Include(e => e.Post).ThenInclude(p => p!.Platform)
            .Where(e => sessionIds.Contains(e.SessionID))
            .ToListAsync();

        // Group by ISO week
        var grouped = sessions.GroupBy(s =>
        {
            var date = s.SessionDate.ToDateTime(TimeOnly.MinValue);
            var cal = System.Globalization.CultureInfo.InvariantCulture.Calendar;
            var week = cal.GetWeekOfYear(date, System.Globalization.CalendarWeekRule.FirstFourDayWeek, DayOfWeek.Monday);
            return $"{s.SessionDate.Year}-W{week:D2}";
        })
        .Select(g =>
        {
            var sIds = g.Select(s => s.SessionID).ToList();
            var eng = engagements.Where(e => sIds.Contains(e.SessionID)).ToList();
            return new
            {
                Week = g.Key,
                Completed = eng.Sum(e => TickHelper.Ticked(e.Post!.Platform!.PlatformName, e.IsLiked, e.IsCommented, e.IsShared)),
                Missed = eng.Sum(e => TickHelper.Missed(e.Post!.Platform!.PlatformName, e.IsLiked, e.IsCommented, e.IsShared)),
                Total = eng.Sum(e => TickHelper.Expected(e.Post!.Platform!.PlatformName))
            };
        })
        .OrderBy(g => g.Week)
        .ToList();

        return Ok(grouped);
    }

    // GET /api/dashboard/platform-comparison
    [HttpGet("platform-comparison")]
    public async Task<IActionResult> GetPlatformComparison()
    {
        var engagements = await _db.Engagements
            .Include(e => e.Post)
                .ThenInclude(p => p!.Platform)
            .ToListAsync();

        var data = engagements
            .GroupBy(e => e.Post!.Platform!.PlatformName)
            .Select(g => new
            {
                Platform = g.Key,
                Completed = g.Sum(e => TickHelper.Ticked(e.Post!.Platform!.PlatformName, e.IsLiked, e.IsCommented, e.IsShared)),
                Missed = g.Sum(e => TickHelper.Missed(e.Post!.Platform!.PlatformName, e.IsLiked, e.IsCommented, e.IsShared)),
                Total = g.Sum(e => TickHelper.Expected(e.Post!.Platform!.PlatformName))
            })
            .ToList();

        return Ok(data);
    }

    // GET /api/dashboard/staff-ranking?limit=13&order=top&from=2026-01-01&to=2026-12-31
    [HttpGet("staff-ranking")]
    public async Task<IActionResult> GetStaffRanking([FromQuery] int limit = 13, [FromQuery] string order = "top", [FromQuery] DateTime? from = null, [FromQuery] DateTime? to = null)
    {
        var data = await GetStaffRankingData(order, limit, from, to);
        return Ok(data);
    }

    // GET /api/dashboard/heatmap?year=2026
    [HttpGet("heatmap")]
    public async Task<IActionResult> GetHeatmap([FromQuery] int? year)
    {
        var y = year ?? DateTime.UtcNow.Year;
        var startDate = new DateOnly(y, 1, 1);
        var endDate = new DateOnly(y, 12, 31);

        var engagements = await _db.Engagements
            .Include(e => e.Session)
            .Include(e => e.Post).ThenInclude(p => p!.Platform)
            .Where(e => e.Session!.SessionDate >= startDate && e.Session.SessionDate <= endDate)
            .ToListAsync();

        var data = engagements
            .GroupBy(e => e.Session!.SessionDate)
            .Select(g => new
            {
                Date = g.Key,
                Completed = g.Sum(e => TickHelper.Ticked(e.Post!.Platform!.PlatformName, e.IsLiked, e.IsCommented, e.IsShared)),
                Total = g.Sum(e => TickHelper.Expected(e.Post!.Platform!.PlatformName))
            })
            .OrderBy(g => g.Date)
            .ToList();

        return Ok(data);
    }

    // GET /api/dashboard/company-performance
    [HttpGet("company-performance")]
    public async Task<IActionResult> GetCompanyPerformance()
    {
        // Get all companies
        var companies = await _db.Companies
            .OrderBy(c => c.CompanyName)
            .ToListAsync();

        // Get all engagements grouped by post's company
        var engagements = await _db.Engagements
            .Include(e => e.Post).ThenInclude(p => p!.Platform)
            .Where(e => e.Post!.CompanyID != null)
            .ToListAsync();

        var result = companies.Select(company =>
        {
            var companyEngagements = engagements
                .Where(e => e.Post!.CompanyID == company.CompanyID)
                .ToList();

            var completed = companyEngagements.Sum(e => TickHelper.Ticked(e.Post!.Platform!.PlatformName, e.IsLiked, e.IsCommented, e.IsShared));
            var expected = companyEngagements.Sum(e => TickHelper.Expected(e.Post!.Platform!.PlatformName));
            var missed = expected - completed;
            var rate = expected > 0 ? Math.Round((double)completed / expected * 100, 1) : 0;

            return new
            {
                company.CompanyID,
                Company = company.CompanyName,
                Completed = completed,
                Missed = missed,
                Total = expected,
                Rate = rate
            };
        }).ToList();

        return Ok(result);
    }

    // ═══════════════════════════════════════════════════════════════
    // DASHBOARD SNAPSHOT ENDPOINTS
    // ═══════════════════════════════════════════════════════════════

    // POST /api/dashboard/snapshot/create
    [HttpPost("snapshot/create")]
    public async Task<IActionResult> CreateSnapshot([FromBody] CreateSnapshotRequest req)
    {
        try
        {
            var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            var userId = userIdClaim != null ? Guid.Parse(userIdClaim) : Guid.Empty;

            // Parse optional date range for staff ranking consistency
            DateTime? snapshotFrom = null;
            DateTime? snapshotTo = null;
            if (!string.IsNullOrEmpty(req.FromDate) && DateTime.TryParse(req.FromDate, out var parsedFrom))
                snapshotFrom = parsedFrom;
            if (!string.IsNullOrEmpty(req.ToDate) && DateTime.TryParse(req.ToDate, out var parsedTo))
                snapshotTo = parsedTo;

            // Get current dashboard data — all filtered by the same date range for consistency
            var kpiData = await GetKpiData(req.FromDate, req.ToDate);
            var monthlyData = await GetMonthlyData(DateTime.UtcNow.Year);
            var platformData = await GetPlatformData();
            var topStaff = await GetStaffRankingData("top", 10, snapshotFrom, snapshotTo);
            var bottomStaff = await GetStaffRankingData("bottom", 10, snapshotFrom, snapshotTo);

            var dashboardState = new
            {
                kpi = kpiData,
                monthly = monthlyData,
                platform = platformData,
                topStaff,
                bottomStaff,
                capturedAt = DateTime.UtcNow
            };

            var options = new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            };

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

            return Ok(new { 
                snapshotID = snapshot.SnapshotID, 
                message = "Dashboard snapshot saved successfully." 
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    // GET /api/dashboard/snapshot/list
    [HttpGet("snapshot/list")]
    public async Task<IActionResult> GetSnapshots()
    {
        try
        {
            var snapshots = await _db.DashboardSnapshots
                .OrderByDescending(s => s.SnapshotDate)
                .Select(s => new
                {
                    s.SnapshotID,
                    s.SnapshotName,
                    s.SnapshotDate,
                    s.CreatedBy,
                    s.CreatedAt,
                    s.Notes
                })
                .ToListAsync();

            return Ok(snapshots);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    // GET /api/dashboard/snapshot/{id}
    [HttpGet("snapshot/{id}")]
    public async Task<IActionResult> GetSnapshot(Guid id)
    {
        try
        {
            var snapshot = await _db.DashboardSnapshots
                .FirstOrDefaultAsync(s => s.SnapshotID == id);

            if (snapshot == null)
                return NotFound(new { message = "Snapshot not found." });

            // Parse the stored JSON data back to preserve original camelCase keys
            using var doc = JsonDocument.Parse(snapshot.SnapshotData);
            var data = doc.RootElement.Clone();

            return Ok(new
            {
                snapshot.SnapshotID,
                snapshot.SnapshotName,
                snapshot.SnapshotDate,
                snapshot.CreatedBy,
                snapshot.Notes,
                data
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    // DELETE /api/dashboard/snapshot/{id}
    [HttpDelete("snapshot/{id}")]
    public async Task<IActionResult> DeleteSnapshot(Guid id)
    {
        try
        {
            var snapshot = await _db.DashboardSnapshots
                .FirstOrDefaultAsync(s => s.SnapshotID == id);

            if (snapshot == null)
                return NotFound(new { message = "Snapshot not found." });

            _db.DashboardSnapshots.Remove(snapshot);
            await _db.SaveChangesAsync();

            return Ok(new { message = "Snapshot deleted successfully." });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // HELPER METHODS FOR SNAPSHOT
    // ═══════════════════════════════════════════════════════════════

    private async Task<object> GetKpiData(string? fromDate, string? toDate)
    {
        var totalStaff = await _db.Staff.CountAsync(s => s.Status == "Active");
        var totalSessions = await _db.MonitoringSessions.CountAsync();
        var totalPlatforms = await _db.Platforms.CountAsync();

        var engQuery = _db.Engagements
            .Include(e => e.Post).ThenInclude(p => p!.Platform)
            .AsQueryable();

        if (!string.IsNullOrEmpty(fromDate) && DateTime.TryParse(fromDate, out var from))
        {
            var fromDateOnly = DateOnly.FromDateTime(from);
            engQuery = engQuery.Where(e => e.Session!.SessionDate >= fromDateOnly);
        }
        if (!string.IsNullOrEmpty(toDate) && DateTime.TryParse(toDate, out var to))
        {
            var toDateOnly = DateOnly.FromDateTime(to);
            engQuery = engQuery.Where(e => e.Session!.SessionDate <= toDateOnly);
        }

        var engagements = await engQuery.ToListAsync();
        var totalCompleted = engagements.Sum(e => TickHelper.Ticked(e.Post!.Platform!.PlatformName, e.IsLiked, e.IsCommented, e.IsShared));
        var totalExpected = engagements.Sum(e => TickHelper.Expected(e.Post!.Platform!.PlatformName));
        var totalMissed = totalExpected - totalCompleted;
        var completionRate = totalExpected > 0 ? Math.Round((double)totalCompleted / totalExpected * 100, 1) : 0;

        return new
        {
            totalStaff,
            totalSessions,
            totalPlatforms,
            totalExpected,
            totalCompleted,
            totalMissed,
            completionRate
        };
    }

    private async Task<object> GetMonthlyData(int year)
    {
        var engagements = await _db.Engagements
            .Include(e => e.Session)
            .Include(e => e.Post).ThenInclude(p => p!.Platform)
            .Where(e => e.Session!.SessionDate.Year == year)
            .ToListAsync();

        var data = engagements
            .GroupBy(e => e.Session!.SessionDate.Month)
            .Select(g => new
            {
                Month = g.Key,
                Completed = g.Sum(e => TickHelper.Ticked(e.Post!.Platform!.PlatformName, e.IsLiked, e.IsCommented, e.IsShared)),
                Missed = g.Sum(e => TickHelper.Missed(e.Post!.Platform!.PlatformName, e.IsLiked, e.IsCommented, e.IsShared)),
                Total = g.Sum(e => TickHelper.Expected(e.Post!.Platform!.PlatformName))
            })
            .OrderBy(g => g.Month)
            .ToList();

        return data;
    }

    private async Task<object> GetPlatformData()
    {
        var engagements = await _db.Engagements
            .Include(e => e.Post).ThenInclude(p => p!.Platform)
            .ToListAsync();

        var data = engagements
            .GroupBy(e => e.Post!.Platform!.PlatformName)
            .Select(g => new
            {
                Platform = g.Key,
                Completed = g.Sum(e => TickHelper.Ticked(e.Post!.Platform!.PlatformName, e.IsLiked, e.IsCommented, e.IsShared)),
                Missed = g.Sum(e => TickHelper.Missed(e.Post!.Platform!.PlatformName, e.IsLiked, e.IsCommented, e.IsShared)),
                Total = g.Sum(e => TickHelper.Expected(e.Post!.Platform!.PlatformName))
            })
            .ToList();

        return data;
    }

    private async Task<object> GetStaffRankingData(string order, int limit, DateTime? from = null, DateTime? to = null)
    {
        var query = _db.Engagements
            .Include(e => e.Staff)
            .Include(e => e.Post).ThenInclude(p => p!.Platform)
            .AsQueryable();

        if (from.HasValue)
        {
            var fromDate = DateOnly.FromDateTime(from.Value);
            query = query.Where(e => e.Session!.SessionDate >= fromDate);
        }
        if (to.HasValue)
        {
            var toDate = DateOnly.FromDateTime(to.Value);
            query = query.Where(e => e.Session!.SessionDate <= toDate);
        }

        var engagements = await query.ToListAsync();

        var data = engagements
            .GroupBy(e => new { e.StaffID, e.Staff!.FullName, e.Staff.Department })
            .Select(g =>
            {
                var staffEngs = g.ToList();
                var completed = staffEngs.Sum(e => TickHelper.Ticked(e.Post!.Platform!.PlatformName, e.IsLiked, e.IsCommented, e.IsShared));
                var total = staffEngs.Sum(e => TickHelper.Expected(e.Post!.Platform!.PlatformName));
                var completionRate = total > 0 ? Math.Round((double)completed / total * 100, 1) : 0;
                return new
                {
                    g.Key.StaffID,
                    g.Key.FullName,
                    g.Key.Department,
                    Completed = completed,
                    Total = total,
                    CompletionRate = completionRate
                };
            })
            .ToList();

        if (order == "bottom")
            return data.OrderBy(d => d.CompletionRate).ThenBy(d => d.Completed).ThenBy(d => d.FullName).Take(limit).ToList();
        else
            return data.OrderByDescending(d => d.CompletionRate).ThenByDescending(d => d.Completed).ThenBy(d => d.FullName).Take(limit).ToList();
    }
}

public record CreateSnapshotRequest(string Name, string? FromDate, string? ToDate, string? Notes);

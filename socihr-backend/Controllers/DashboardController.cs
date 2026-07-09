using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using socihr_backend.Data;
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

        var engQuery = _db.Engagements.AsQueryable();

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

        var totalCompleted = await engQuery.CountAsync(e => e.Status == "Completed");
        var totalMissed = await engQuery.CountAsync(e => e.Status == "Missed");
        var totalExpected = totalCompleted + totalMissed;
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

        var data = await _db.Engagements
            .Include(e => e.Session)
            .Where(e => e.Session!.SessionDate.Year == y)
            .GroupBy(e => e.Session!.SessionDate.Month)
            .Select(g => new
            {
                Month = g.Key,
                Completed = g.Count(e => e.Status == "Completed"),
                Missed = g.Count(e => e.Status == "Missed"),
                Total = g.Count()
            })
            .OrderBy(g => g.Month)
            .ToListAsync();

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
                Completed = eng.Count(e => e.Status == "Completed"),
                Missed = eng.Count(e => e.Status == "Missed"),
                Total = eng.Count
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
        var data = await _db.Engagements
            .Include(e => e.Post)
                .ThenInclude(p => p!.Platform)
            .GroupBy(e => e.Post!.Platform!.PlatformName)
            .Select(g => new
            {
                Platform = g.Key,
                Completed = g.Count(e => e.Status == "Completed"),
                Missed = g.Count(e => e.Status == "Missed"),
                Total = g.Count()
            })
            .ToListAsync();

        return Ok(data);
    }

    // GET /api/dashboard/staff-ranking?limit=13&order=top
    [HttpGet("staff-ranking")]
    public async Task<IActionResult> GetStaffRanking([FromQuery] int limit = 13, [FromQuery] string order = "top")
    {
        var data = await _db.Engagements
            .Include(e => e.Staff)
            .GroupBy(e => new { e.StaffID, e.Staff!.FullName, e.Staff.Department })
            .Select(g => new
            {
                g.Key.StaffID,
                g.Key.FullName,
                g.Key.Department,
                Completed = g.Count(e => e.Status == "Completed"),
                Total = g.Count(e => e.Status == "Completed" || e.Status == "Missed"),
                CompletionRate = g.Count(e => e.Status == "Completed" || e.Status == "Missed") > 0
                    ? Math.Round((double)g.Count(e => e.Status == "Completed") / g.Count(e => e.Status == "Completed" || e.Status == "Missed") * 100, 1)
                    : 0
            })
            .ToListAsync();

        if (order == "bottom")
            data = data.OrderBy(d => d.CompletionRate).Take(limit).ToList();
        else
            data = data.OrderByDescending(d => d.CompletionRate).Take(limit).ToList();

        return Ok(data);
    }

    // GET /api/dashboard/heatmap?year=2026
    [HttpGet("heatmap")]
    public async Task<IActionResult> GetHeatmap([FromQuery] int? year)
    {
        var y = year ?? DateTime.UtcNow.Year;
        var startDate = new DateOnly(y, 1, 1);
        var endDate = new DateOnly(y, 12, 31);

        var data = await _db.Engagements
            .Include(e => e.Session)
            .Where(e => e.Session!.SessionDate >= startDate && e.Session.SessionDate <= endDate)
            .GroupBy(e => e.Session!.SessionDate)
            .Select(g => new
            {
                Date = g.Key,
                Completed = g.Count(e => e.Status == "Completed"),
                Total = g.Count()
            })
            .OrderBy(g => g.Date)
            .ToListAsync();

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
            .Include(e => e.Post)
            .Where(e => e.Post!.CompanyID != null)
            .ToListAsync();

        var result = companies.Select(company =>
        {
            var companyEngagements = engagements
                .Where(e => e.Post!.CompanyID == company.CompanyID)
                .ToList();

            var completed = companyEngagements.Count(e => e.Status == "Completed");
            var missed = companyEngagements.Count(e => e.Status == "Missed");
            var total = completed + missed;
            var rate = total > 0 ? Math.Round((double)completed / total * 100, 1) : 0;

            return new
            {
                company.CompanyID,
                Company = company.CompanyName,
                Completed = completed,
                Missed = missed,
                Total = total,
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

            // Get current dashboard data
            var kpiData = await GetKpiData(req.FromDate, req.ToDate);
            var monthlyData = await GetMonthlyData(DateTime.UtcNow.Year);
            var platformData = await GetPlatformData();
            var topStaff = await GetStaffRankingData("top", 13);
            var bottomStaff = await GetStaffRankingData("bottom", 13);

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

        var engQuery = _db.Engagements.AsQueryable();

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

        var totalCompleted = await engQuery.CountAsync(e => e.Status == "Completed");
        var totalMissed = await engQuery.CountAsync(e => e.Status == "Missed");
        var totalExpected = totalCompleted + totalMissed;
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
        var data = await _db.Engagements
            .Include(e => e.Session)
            .Where(e => e.Session!.SessionDate.Year == year)
            .GroupBy(e => e.Session!.SessionDate.Month)
            .Select(g => new
            {
                Month = g.Key,
                Completed = g.Count(e => e.Status == "Completed"),
                Missed = g.Count(e => e.Status == "Missed"),
                Total = g.Count()
            })
            .OrderBy(g => g.Month)
            .ToListAsync();

        return data;
    }

    private async Task<object> GetPlatformData()
    {
        var data = await _db.Engagements
            .Include(e => e.Post)
                .ThenInclude(p => p!.Platform)
            .GroupBy(e => e.Post!.Platform!.PlatformName)
            .Select(g => new
            {
                Platform = g.Key,
                Completed = g.Count(e => e.Status == "Completed"),
                Missed = g.Count(e => e.Status == "Missed"),
                Total = g.Count()
            })
            .ToListAsync();

        return data;
    }

    private async Task<object> GetStaffRankingData(string order, int limit)
    {
        var data = await _db.Engagements
            .Include(e => e.Staff)
            .GroupBy(e => new { e.StaffID, e.Staff!.FullName, e.Staff.Department })
            .Select(g => new
            {
                g.Key.StaffID,
                g.Key.FullName,
                g.Key.Department,
                Completed = g.Count(e => e.Status == "Completed"),
                Total = g.Count(e => e.Status == "Completed" || e.Status == "Missed"),
                CompletionRate = g.Count(e => e.Status == "Completed" || e.Status == "Missed") > 0
                    ? Math.Round((double)g.Count(e => e.Status == "Completed") / g.Count(e => e.Status == "Completed" || e.Status == "Missed") * 100, 1)
                    : 0
            })
            .ToListAsync();

        if (order == "bottom")
            return data.OrderBy(d => d.CompletionRate).Take(limit).ToList();
        else
            return data.OrderByDescending(d => d.CompletionRate).Take(limit).ToList();
    }
}

public record CreateSnapshotRequest(string Name, string? FromDate, string? ToDate, string? Notes);

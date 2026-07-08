using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using socihr_backend.Data;

namespace socihr_backend.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class AuditController : ControllerBase
{
    private readonly AppDbContext _db;
    public AuditController(AppDbContext db) => _db = db;

    // GET /api/audit?page=1&pageSize=50&engagementId=xxx
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] Guid? engagementId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        var query = _db.AuditTrails.AsQueryable();

        if (engagementId.HasValue)
            query = query.Where(a => a.EngagementID == engagementId.Value);

        var total = await query.CountAsync();
        var items = await query
            .OrderByDescending(a => a.UpdatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        // Enrich with user names
        var userIds = items.Select(a => a.UpdatedBy).Distinct().ToList();
        var users = await _db.Users
            .Where(u => userIds.Contains(u.UserID))
            .ToListAsync();

        // Enrich with engagement + staff info
        var engIds = items.Select(a => a.EngagementID).Distinct().ToList();
        var engagements = await _db.Engagements
            .Include(e => e.Staff)
            .Include(e => e.Post)
                .ThenInclude(p => p!.Platform)
            .Include(e => e.Session)
            .Where(e => engIds.Contains(e.EngagementID))
            .ToListAsync();

        var result = items.Select(a =>
        {
            var user = users.FirstOrDefault(u => u.UserID == a.UpdatedBy);
            var eng = engagements.FirstOrDefault(e => e.EngagementID == a.EngagementID);
            return new
            {
                a.AuditID,
                a.EngagementID,
                a.PreviousStatus,
                a.NewStatus,
                UpdatedBy = user?.Username ?? a.UpdatedBy.ToString(),
                a.UpdatedAt,
                // Enriched
                StaffName = eng?.Staff?.FullName ?? "-",
                Department = eng?.Staff?.Department ?? "-",
                PlatformName = eng?.Post?.Platform?.PlatformName ?? "-",
                SessionDate = eng?.Session?.SessionDate.ToString("yyyy-MM-dd") ?? "-"
            };
        });

        return Ok(new { total, page, pageSize, items = result });
    }
}

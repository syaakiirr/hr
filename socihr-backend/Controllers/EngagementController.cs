using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using socihr_backend.Data;
using socihr_backend.Models;

namespace socihr_backend.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class EngagementController : ControllerBase
{
    private readonly AppDbContext _db;
    public EngagementController(AppDbContext db) => _db = db;

    // GET /api/engagement?sessionId=xxx  — get all engagements for a session
    [HttpGet]
    public async Task<IActionResult> GetBySession([FromQuery] Guid sessionId)
    {
        var engagements = await _db.Engagements
            .Include(e => e.Staff)
                .ThenInclude(s => s!.Company)
            .Include(e => e.Post)
                .ThenInclude(p => p!.Platform)
            .Where(e => e.SessionID == sessionId)
            .ToListAsync();

        var result = engagements.Select(e => new
        {
            e.EngagementID,
            e.SessionID,
            e.PostID,
            e.StaffID,
            StaffName = e.Staff!.FullName,
            Department = e.Staff.Department,
            CompanyID = e.Staff.CompanyID,
            CompanyName = e.Staff.Company != null ? e.Staff.Company.CompanyName : "No Company",
            PlatformID = e.Post!.PlatformID,
            PlatformName = e.Post.Platform!.PlatformName,
            PostLink = e.Post.PostLink,
            e.Status,
            e.UpdatedBy,
            e.UpdatedAt
        });

        return Ok(result);
    }

    // PATCH /api/engagement/{id}/status  — update tick status
    [HttpPatch("{id:guid}/status")]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateStatusRequest req)
    {
        var engagement = await _db.Engagements.FindAsync(id);
        if (engagement == null) return NotFound(new { message = "Engagement tidak dijumpai." });

        var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        var userId = userIdClaim != null ? Guid.Parse(userIdClaim) : Guid.Empty;

        // Record audit trail
        var audit = new AuditTrail
        {
            AuditID = Guid.NewGuid(),
            EngagementID = engagement.EngagementID,
            PreviousStatus = engagement.Status,
            NewStatus = req.Status,
            UpdatedBy = userId,
            UpdatedAt = DateTime.UtcNow
        };
        _db.AuditTrails.Add(audit);

        engagement.Status = req.Status;
        engagement.UpdatedBy = userId;
        engagement.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return Ok(new { engagement.EngagementID, engagement.Status });
    }

    // POST /api/engagement/bulk-update  — bulk update engagement status
    [HttpPost("bulk-update")]
    public async Task<IActionResult> BulkUpdateStatus([FromBody] BulkUpdateRequest req)
    {
        if (req.EngagementIDs == null || req.EngagementIDs.Count == 0)
            return BadRequest(new { message = "No engagement IDs provided." });

        var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        var userId = userIdClaim != null ? Guid.Parse(userIdClaim) : Guid.Empty;

        // Fetch all engagements in one query
        var engagements = await _db.Engagements
            .Where(e => req.EngagementIDs.Contains(e.EngagementID))
            .ToListAsync();

        if (engagements.Count == 0)
            return NotFound(new { message = "No engagements found." });

        var now = DateTime.UtcNow;
        var audits = new List<AuditTrail>();

        // Update all engagements
        foreach (var engagement in engagements)
        {
            // Record audit trail
            audits.Add(new AuditTrail
            {
                AuditID = Guid.NewGuid(),
                EngagementID = engagement.EngagementID,
                PreviousStatus = engagement.Status,
                NewStatus = req.Status,
                UpdatedBy = userId,
                UpdatedAt = now
            });

            engagement.Status = req.Status;
            engagement.UpdatedBy = userId;
            engagement.UpdatedAt = now;
        }

        // Add all audit records
        _db.AuditTrails.AddRange(audits);

        // Save all changes in a single transaction
        await _db.SaveChangesAsync();

        return Ok(new { 
            message = $"Successfully updated {engagements.Count} engagement(s).",
            updatedCount = engagements.Count,
            status = req.Status
        });
    }
}

public record UpdateStatusRequest(string Status);
public record BulkUpdateRequest(List<Guid> EngagementIDs, string Status);

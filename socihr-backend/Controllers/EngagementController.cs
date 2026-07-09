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
            .Include(e => e.Post)
                .ThenInclude(p => p!.Platform)
            .Include(e => e.Post)
                .ThenInclude(p => p!.Company)
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
            CompanyID = e.Post!.CompanyID,
            CompanyName = e.Post.Company != null ? e.Post.Company.CompanyName : "No Company",
            PlatformID = e.Post!.PlatformID,
            PlatformName = e.Post.Platform!.PlatformName,
            PostLink = e.Post.PostLink,
            e.Status,
            e.IsLiked,
            e.IsCommented,
            e.IsShared,
            e.Reason,
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

    // PATCH /api/engagement/{id}/action  — tick a sub-action (like/comment/share)
    [HttpPatch("{id:guid}/action")]
    public async Task<IActionResult> UpdateAction(Guid id, [FromBody] UpdateActionRequest req)
    {
        var engagement = await _db.Engagements
            .Include(e => e.Post).ThenInclude(p => p!.Platform)
            .FirstOrDefaultAsync(e => e.EngagementID == id);
        if (engagement == null) return NotFound(new { message = "Engagement tidak dijumpai." });

        var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        var userId = userIdClaim != null ? Guid.Parse(userIdClaim) : Guid.Empty;

        switch (req.Action.ToLower())
        {
            case "like":    engagement.IsLiked    = req.Value; break;
            case "comment": engagement.IsCommented = req.Value; break;
            case "share":   engagement.IsShared   = req.Value; break;
            default: return BadRequest(new { message = "Invalid action. Must be like, comment, or share." });
        }

        // Auto-calculate status based on platform rules
        var platform = engagement.Post?.Platform?.PlatformName ?? "";
        var prevStatus = engagement.Status;

        engagement.Status = platform.ToLower() switch
        {
            "facebook"  => (engagement.IsLiked && engagement.IsCommented) ? "Completed" : "Missed",
            "instagram" => (engagement.IsLiked && engagement.IsCommented) ? "Completed" : "Missed",
            "tiktok"    => engagement.IsCommented ? "Completed" : "Missed",
            _           => engagement.Status
        };

        engagement.UpdatedBy = userId;
        engagement.UpdatedAt = DateTime.UtcNow;

        // Record audit trail if status changed
        if (prevStatus != engagement.Status)
        {
            _db.AuditTrails.Add(new AuditTrail
            {
                AuditID = Guid.NewGuid(),
                EngagementID = engagement.EngagementID,
                PreviousStatus = prevStatus,
                NewStatus = engagement.Status,
                UpdatedBy = userId,
                UpdatedAt = DateTime.UtcNow
            });
        }

        await _db.SaveChangesAsync();
        return Ok(new
        {
            engagement.EngagementID,
            engagement.Status,
            engagement.IsLiked,
            engagement.IsCommented,
            engagement.IsShared
        });
    }

    // PATCH /api/engagement/{id}/reason  — update reason field
    [HttpPatch("{id:guid}/reason")]
    public async Task<IActionResult> UpdateReason(Guid id, [FromBody] UpdateReasonRequest req)
    {
        var engagement = await _db.Engagements.FindAsync(id);
        if (engagement == null) return NotFound(new { message = "Engagement tidak dijumpai." });

        var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        var userId = userIdClaim != null ? Guid.Parse(userIdClaim) : Guid.Empty;

        engagement.Reason = string.IsNullOrWhiteSpace(req.Reason) ? null : req.Reason.Trim();
        engagement.UpdatedBy = userId;
        engagement.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return Ok(new { engagement.EngagementID, engagement.Reason });
    }

    // POST /api/engagement/bulk-update  — bulk update engagement status
    [HttpPost("bulk-update")]
    public async Task<IActionResult> BulkUpdateStatus([FromBody] BulkUpdateRequest req)
    {
        if (req.EngagementIDs == null || req.EngagementIDs.Count == 0)
            return BadRequest(new { message = "No engagement IDs provided." });

        var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        var userId = userIdClaim != null ? Guid.Parse(userIdClaim) : Guid.Empty;

        var engagements = await _db.Engagements
            .Where(e => req.EngagementIDs.Contains(e.EngagementID))
            .ToListAsync();

        if (engagements.Count == 0)
            return NotFound(new { message = "No engagements found." });

        var now = DateTime.UtcNow;
        var audits = new List<AuditTrail>();

        foreach (var engagement in engagements)
        {
            audits.Add(new AuditTrail
            {
                AuditID = Guid.NewGuid(),
                EngagementID = engagement.EngagementID,
                PreviousStatus = engagement.Status,
                NewStatus = req.Status,
                UpdatedBy = userId,
                UpdatedAt = now
            });

            // When bulk marking Completed, also set all sub-actions
            if (req.Status == "Completed")
            {
                engagement.IsLiked = true;
                engagement.IsCommented = true;
                engagement.IsShared = true;
            }
            else if (req.Status == "Missed")
            {
                engagement.IsLiked = false;
                engagement.IsCommented = false;
                engagement.IsShared = false;
            }

            engagement.Status = req.Status;
            engagement.UpdatedBy = userId;
            engagement.UpdatedAt = now;
        }

        _db.AuditTrails.AddRange(audits);
        await _db.SaveChangesAsync();

        return Ok(new { 
            message = $"Successfully updated {engagements.Count} engagement(s).",
            updatedCount = engagements.Count,
            status = req.Status
        });
    }
}

public record UpdateStatusRequest(string Status);
public record UpdateActionRequest(string Action, bool Value);
public record UpdateReasonRequest(string? Reason);
public record BulkUpdateRequest(List<Guid> EngagementIDs, string Status);

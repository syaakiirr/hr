using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using socihr_backend.Data;
using socihr_backend.Models;

namespace socihr_backend.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class MonitoringSessionController : ControllerBase
{
    private readonly AppDbContext _db;
    public MonitoringSessionController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] bool includeArchived = false)
    {
        var query = _db.MonitoringSessions.AsQueryable();
        
        // Filter archived by default
        if (!includeArchived)
            query = query.Where(s => !s.IsArchived);
        
        var sessions = await query
            .OrderByDescending(s => s.SessionDate)
            .ToListAsync();

        // Load posts for each session
        var sessionIds = sessions.Select(s => s.SessionID).ToList();
        var posts = await _db.SessionPosts
            .Include(p => p.Platform)
            .Where(p => sessionIds.Contains(p.SessionID))
            .ToListAsync();

        var result = sessions.Select(s => new
        {
            s.SessionID,
            s.SessionDate,
            s.CreatedBy,
            s.CreatedAt,
            s.IsArchived,
            s.ArchivedBy,
            s.ArchivedAt,
            Posts = posts
                .Where(p => p.SessionID == s.SessionID)
                .Select(p => new
                {
                    p.PostID,
                    p.PlatformID,
                    PlatformName = p.Platform!.PlatformName,
                    p.PostLink
                })
        });

        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var session = await _db.MonitoringSessions.FindAsync(id);
        if (session == null) return NotFound(new { message = "Session tidak dijumpai." });

        var posts = await _db.SessionPosts
            .Include(p => p.Platform)
            .Where(p => p.SessionID == id)
            .ToListAsync();

        return Ok(new
        {
            session.SessionID,
            session.SessionDate,
            session.CreatedBy,
            session.CreatedAt,
            Posts = posts.Select(p => new
            {
                p.PostID,
                p.PlatformID,
                PlatformName = p.Platform!.PlatformName,
                p.PostLink
            })
        });
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateSessionRequest req)
    {
        var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        var userId = userIdClaim != null ? Guid.Parse(userIdClaim) : Guid.Empty;

        var session = new MonitoringSession
        {
            SessionID = Guid.NewGuid(),
            SessionDate = req.SessionDate,
            CreatedBy = userId,
            CreatedAt = DateTime.UtcNow
        };
        _db.MonitoringSessions.Add(session);

        // Create posts for each platform selected (PostLink is optional)
        foreach (var postReq in req.Posts)
        {
            var post = new SessionPost
            {
                PostID = Guid.NewGuid(),
                SessionID = session.SessionID,
                PlatformID = postReq.PlatformID,
                PostLink = string.IsNullOrWhiteSpace(postReq.PostLink) ? "" : postReq.PostLink
            };
            _db.SessionPosts.Add(post);
        }

        await _db.SaveChangesAsync();

        // Now generate Engagement records for all active staff x all posts
        var activeStaff = await _db.Staff.Where(s => s.Status == "Active").ToListAsync();
        var createdPosts = await _db.SessionPosts.Where(p => p.SessionID == session.SessionID).ToListAsync();

        foreach (var staff in activeStaff)
        {
            foreach (var post in createdPosts)
            {
                _db.Engagements.Add(new Engagement
                {
                    EngagementID = Guid.NewGuid(),
                    SessionID = session.SessionID,
                    PostID = post.PostID,
                    StaffID = staff.StaffID,
                    Status = "Missed"
                });
            }
        }

        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = session.SessionID }, new { session.SessionID });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        try
        {
            var session = await _db.MonitoringSessions.FindAsync(id);
            if (session == null) return NotFound(new { message = "Session tidak dijumpai." });

            // 1. Get all engagement IDs for this session
            var engagementIds = await _db.Engagements
                .Where(e => e.SessionID == id)
                .Select(e => e.EngagementID)
                .ToListAsync();

            // 2. Delete all AuditTrail records referencing those engagements
            var audits = await _db.AuditTrails
                .Where(a => engagementIds.Contains(a.EngagementID))
                .ToListAsync();
            _db.AuditTrails.RemoveRange(audits);

            // 3. Delete all Engagements for this session
            var engagements = await _db.Engagements
                .Where(e => e.SessionID == id)
                .ToListAsync();
            _db.Engagements.RemoveRange(engagements);

            // 4. Delete all SessionPosts for this session
            var posts = await _db.SessionPosts
                .Where(p => p.SessionID == id)
                .ToListAsync();
            _db.SessionPosts.RemoveRange(posts);

            // 5. Finally, delete the MonitoringSession itself
            _db.MonitoringSessions.Remove(session);

            await _db.SaveChangesAsync();
            return NoContent();
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // ARCHIVE ENDPOINTS
    // ═══════════════════════════════════════════════════════════════

    // POST /api/monitoringsession/{id}/archive
    [HttpPost("{id:guid}/archive")]
    public async Task<IActionResult> ArchiveSession(Guid id)
    {
        try
        {
            var session = await _db.MonitoringSessions.FindAsync(id);
            if (session == null)
                return NotFound(new { message = "Session not found." });

            var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            var userId = userIdClaim != null ? Guid.Parse(userIdClaim) : Guid.Empty;

            session.IsArchived = true;
            session.ArchivedBy = userId;
            session.ArchivedAt = DateTime.UtcNow;

            await _db.SaveChangesAsync();

            return Ok(new { message = "Session archived successfully." });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    // POST /api/monitoringsession/{id}/restore
    [HttpPost("{id:guid}/restore")]
    public async Task<IActionResult> RestoreSession(Guid id)
    {
        try
        {
            var session = await _db.MonitoringSessions.FindAsync(id);
            if (session == null)
                return NotFound(new { message = "Session not found." });

            session.IsArchived = false;
            session.ArchivedBy = null;
            session.ArchivedAt = null;

            await _db.SaveChangesAsync();

            return Ok(new { message = "Session restored successfully." });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    // GET /api/monitoringsession/archived
    [HttpGet("archived")]
    public async Task<IActionResult> GetArchivedSessions()
    {
        try
        {
            var sessions = await _db.MonitoringSessions
                .Where(s => s.IsArchived)
                .OrderByDescending(s => s.ArchivedAt)
                .ToListAsync();

            var sessionIds = sessions.Select(s => s.SessionID).ToList();
            var posts = await _db.SessionPosts
                .Include(p => p.Platform)
                .Where(p => sessionIds.Contains(p.SessionID))
                .ToListAsync();

            var result = sessions.Select(s => new
            {
                s.SessionID,
                s.SessionDate,
                s.CreatedBy,
                s.CreatedAt,
                s.IsArchived,
                s.ArchivedBy,
                s.ArchivedAt,
                Posts = posts
                    .Where(p => p.SessionID == s.SessionID)
                    .Select(p => new
                    {
                        p.PostID,
                        p.PlatformID,
                        PlatformName = p.Platform!.PlatformName,
                        p.PostLink
                    })
            });

            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }
}

public record PostRequest(Guid PlatformID, string PostLink);
public record CreateSessionRequest(DateOnly SessionDate, List<PostRequest> Posts);

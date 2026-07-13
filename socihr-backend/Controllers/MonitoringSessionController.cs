using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using socihr_backend.Data;
using socihr_backend.Models;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

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
        var query = _db.MonitoringSessions.AsNoTracking().AsQueryable();
        
        // Filter archived by default
        if (!includeArchived)
            query = query.Where(s => !s.IsArchived);
        
        var sessions = await query
            .OrderByDescending(s => s.SessionDate)
            .ToListAsync();

        // Load posts for each session
        var sessionIds = sessions.Select(s => s.SessionID).ToList();
        var posts = await _db.SessionPosts
            .AsNoTracking()
            .Include(p => p.Platform)
            .Include(p => p.Company)
            .Where(p => sessionIds.Contains(p.SessionID))
            .ToListAsync();

        var result = sessions.Select(s => {
            var sessionPosts = posts.Where(p => p.SessionID == s.SessionID).ToList();
            return new
            {
                s.SessionID,
                s.SessionDate,
                s.CreatedBy,
                s.CreatedAt,
                s.IsArchived,
                s.ArchivedBy,
                s.ArchivedAt,
                Posts = sessionPosts.Select(p => new
                {
                    p.PostID,
                    p.PlatformID,
                    PlatformName = p.Platform!.PlatformName,
                    p.PostLink,
                    p.CompanyID,
                    CompanyName = p.Company != null ? p.Company.CompanyName : "No Company"
                }),
                Companies = sessionPosts
                    .Where(p => p.Company != null)
                    .Select(p => new
                    {
                        p.CompanyID,
                        CompanyName = p.Company!.CompanyName
                    })
                    .GroupBy(c => c.CompanyID)
                    .Select(g => g.First())
            };
        });

        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var session = await _db.MonitoringSessions.AsNoTracking().FirstOrDefaultAsync(s => s.SessionID == id);
        if (session == null) return NotFound(new { message = "Session not found." });

        var posts = await _db.SessionPosts
            .AsNoTracking()
            .Include(p => p.Platform)
            .Include(p => p.Company)
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
                p.PostLink,
                p.CompanyID,
                CompanyName = p.Company != null ? p.Company.CompanyName : "No Company"
            }),
            Companies = posts
                .Where(p => p.Company != null)
                .Select(p => new
                {
                    p.CompanyID,
                    CompanyName = p.Company!.CompanyName
                })
                .GroupBy(c => c.CompanyID)
                .Select(g => g.First())
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

        // Create posts for each platform for each company selected
        if (req.CompanyIDs != null && req.CompanyIDs.Count > 0 && req.Posts != null && req.Posts.Count > 0)
        {
            foreach (var companyId in req.CompanyIDs)
            {
                foreach (var postReq in req.Posts)
                {
                    var post = new SessionPost
                    {
                        PostID = Guid.NewGuid(),
                        SessionID = session.SessionID,
                        PlatformID = postReq.PlatformID,
                        CompanyID = companyId,
                        PostLink = ""
                    };
                    _db.SessionPosts.Add(post);
                }
            }
        }
        else if (req.Posts != null && req.Posts.Count > 0)
        {
            // Fallback for sessions with no companies specified
            foreach (var postReq in req.Posts)
            {
                var post = new SessionPost
                {
                    PostID = Guid.NewGuid(),
                    SessionID = session.SessionID,
                    PlatformID = postReq.PlatformID,
                    CompanyID = null,
                    PostLink = ""
                };
                _db.SessionPosts.Add(post);
            }
        }

        await _db.SaveChangesAsync();

        // Load all active staff members
        var activeStaff = await _db.Staff.Where(s => s.Status == "Active" && !s.IsArchived).ToListAsync();
        
        // Load the created posts to generate engagements for all staff members
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
            if (session == null) return NotFound(new { message = "Session not found." });

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
                .Include(p => p.Company)
                .Where(p => sessionIds.Contains(p.SessionID))
                .ToListAsync();

            var result = sessions.Select(s => {
                var sessionPosts = posts.Where(p => p.SessionID == s.SessionID).ToList();
                return new
                {
                    s.SessionID,
                    s.SessionDate,
                    s.CreatedBy,
                    s.CreatedAt,
                    s.IsArchived,
                    s.ArchivedBy,
                    s.ArchivedAt,
                    Posts = sessionPosts.Select(p => new
                    {
                        p.PostID,
                        p.PlatformID,
                        PlatformName = p.Platform!.PlatformName,
                        p.PostLink,
                        p.CompanyID,
                        CompanyName = p.Company != null ? p.Company.CompanyName : "No Company"
                    }),
                    Companies = sessionPosts
                        .Where(p => p.Company != null)
                        .Select(p => new
                        {
                            p.CompanyID,
                            CompanyName = p.Company!.CompanyName
                        })
                        .GroupBy(c => c.CompanyID)
                        .Select(g => g.First())
                };
            });

            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }
    // PATCH /api/monitoringsession/posts/{postId}/link
    [HttpPatch("posts/{postId:guid}/link")]
    public async Task<IActionResult> UpdatePostLink(Guid postId, [FromBody] UpdatePostLinkRequest req)
    {
        var post = await _db.SessionPosts.FindAsync(postId);
        if (post == null) return NotFound(new { message = "Post not found." });

        post.PostLink = req.PostLink?.Trim() ?? "";
        await _db.SaveChangesAsync();

        return Ok(new { post.PostID, post.PostLink });
    }

    // GET /api/monitoringsession/{id}/report-pdf
    [HttpGet("{id:guid}/report-pdf")]
    public async Task<IActionResult> GenerateReportPdf(Guid id)
    {
        try
        {
            var session = await _db.MonitoringSessions
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.SessionID == id);
            
            if (session == null)
                return NotFound(new { message = "Session not found." });

            // Load engagements with related data
            var engagements = await _db.Engagements
                .AsNoTracking()
                .Include(e => e.Staff)
                .Include(e => e.Post)
                .ThenInclude(p => p!.Platform)
                .Include(e => e.Post)
                .ThenInclude(p => p!.Company)
                .Where(e => e.SessionID == id)
                .ToListAsync();

            // Build report data
            var reportData = BuildReportData(session, engagements);

            // Generate PDF
            var pdf = GeneratePdfDocument(reportData);

            return File(pdf, "application/pdf", $"monitoring-report-{session.SessionDate:yyyy-MM-dd}.pdf");
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    private class ReportData
    {
        public DateOnly SessionDate { get; set; }
        public List<StaffRowData> StaffRows { get; set; } = new();
        public int TotalComments { get; set; }
        public int TotalLikes { get; set; }
        public int TotalShares { get; set; }
        public int TotalCompleted { get; set; }
        public int TotalMissed { get; set; }
    }

    private class StaffRowData
    {
        public string StaffName { get; set; } = "";
        public string Department { get; set; } = "";
        public int Comments { get; set; }
        public int Likes { get; set; }
        public int Shares { get; set; }
        public int Completed { get; set; }
        public int Missed { get; set; }
    }

    private ReportData BuildReportData(MonitoringSession session, List<Engagement> engagements)
    {
        var data = new ReportData { SessionDate = session.SessionDate };

        // Group by staff
        var staffGroups = engagements
            .GroupBy(e => new { e.StaffID, e.Staff!.FullName, e.Staff.Department })
            .ToList();

        foreach (var group in staffGroups)
        {
            var row = new StaffRowData
            {
                StaffName = group.Key.FullName ?? "Unknown",
                Department = group.Key.Department ?? "N/A"
            };

            foreach (var eng in group)
            {
                if (eng.IsLiked) row.Likes++;
                if (eng.IsCommented) row.Comments++;
                if (eng.IsShared) row.Shares++;
                if (eng.Status == "Completed") row.Completed++;
                else if (eng.Status == "Missed") row.Missed++;
            }

            data.StaffRows.Add(row);
            data.TotalComments += row.Comments;
            data.TotalLikes += row.Likes;
            data.TotalShares += row.Shares;
            data.TotalCompleted += row.Completed;
            data.TotalMissed += row.Missed;
        }

        // Sort by staff name
        data.StaffRows = data.StaffRows.OrderBy(r => r.StaffName).ToList();

        return data;
    }

    private byte[] GeneratePdfDocument(ReportData data)
    {
        var document = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(20);
                page.PageColor(Colors.White);

                page.Header().Text(txt =>
                {
                    txt.Span("Monitoring Session Report").FontSize(20).Bold().FontColor("#1e40af");
                });

                page.Content().Column(col =>
                {
                    // Session date
                    col.Item().Text($"Date: {data.SessionDate:dd MMMM yyyy}").FontSize(12).FontColor("#4b5563");

                    // Summary section
                    col.Item().PaddingTop(12).Column(c =>
                    {
                        c.Item().Text("Total Engagements").FontSize(12).Bold().FontColor("#1e40af");
                        c.Item().Row(r =>
                        {
                            r.RelativeColumn().Text($"💬 Comments: {data.TotalComments}").FontSize(11);
                            r.RelativeColumn().Text($"👍 Likes: {data.TotalLikes}").FontSize(11);
                            r.RelativeColumn().Text($"🔁 Shares: {data.TotalShares}").FontSize(11);
                        });
                    });

                    col.Item().PaddingTop(8).Text($"Completed: {data.TotalCompleted} | Missed: {data.TotalMissed}").FontSize(10).FontColor("#6b7280");

                    // Table
                    col.Item().PaddingTop(16).Table(table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            columns.RelativeColumn(2f);
                            columns.RelativeColumn(1.5f);
                            columns.RelativeColumn();
                            columns.RelativeColumn();
                            columns.RelativeColumn();
                            columns.RelativeColumn();
                            columns.RelativeColumn();
                        });

                        // Header
                        table.Header(header =>
                        {
                            void HeaderCell(string text)
                            {
                                header.Cell().Background("#1e40af").Padding(8).Text(text).FontColor(Colors.White).Bold().FontSize(10);
                            }

                            HeaderCell("Staff Name");
                            HeaderCell("Department");
                            HeaderCell("Comments");
                            HeaderCell("Likes");
                            HeaderCell("Shares");
                            HeaderCell("Completed");
                            HeaderCell("Missed");
                        });

                        // Rows
                        foreach (var row in data.StaffRows)
                        {
                            table.Cell().Padding(8).Text(row.StaffName).FontSize(10);
                            table.Cell().Padding(8).Text(row.Department).FontSize(10);
                            table.Cell().Padding(8).Text(row.Comments.ToString()).FontSize(10);
                            table.Cell().Padding(8).Text(row.Likes.ToString()).FontSize(10);
                            table.Cell().Padding(8).Text(row.Shares.ToString()).FontSize(10);
                            table.Cell().Padding(8).Text(row.Completed.ToString()).FontSize(10);
                            table.Cell().Padding(8).Text(row.Missed.ToString()).FontSize(10);
                        }
                    });
                });

                page.Footer().AlignCenter().Text($"Generated on {DateTime.UtcNow:dd MMMM yyyy HH:mm:ss} UTC").FontSize(9).FontColor("#9ca3af");
            });
        });

        return document.GeneratePdf();
    }
}

public record PostRequest(Guid PlatformID, string PostLink);
public record CreateSessionRequest(DateOnly SessionDate, List<PostRequest> Posts, List<Guid>? CompanyIDs);
public record UpdatePostLinkRequest(string? PostLink);

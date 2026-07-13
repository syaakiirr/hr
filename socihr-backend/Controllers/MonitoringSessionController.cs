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

    // GET /api/monitoringsession/{id}/report
    [HttpGet("{id:guid}/report")]
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
        public List<string> Companies { get; set; } = new();  // Unique company names
        public List<StaffRowData> StaffRows { get; set; } = new();
        public int TotalComments { get; set; }
        public int TotalLikes { get; set; }
        public int TotalShares { get; set; }
    }

    private class StaffRowData
    {
        public string StaffName { get; set; } = "";
        public string Department { get; set; } = "";
        public List<EngagementDetail> Engagements { get; set; } = new();  // Per staff, all engagements
    }

    private class EngagementDetail
    {
        public string CompanyName { get; set; } = "";
        public bool IsLiked { get; set; }
        public bool IsCommented { get; set; }
        public bool IsShared { get; set; }
    }

    private ReportData BuildReportData(MonitoringSession session, List<Engagement> engagements)
    {
        var data = new ReportData { SessionDate = session.SessionDate };

        // Get unique companies
        var companies = engagements
            .Where(e => !string.IsNullOrEmpty(e.Post?.Company?.CompanyName))
            .Select(e => e.Post!.Company!.CompanyName)
            .Distinct()
            .OrderBy(c => c)
            .ToList();
        data.Companies = companies;

        // Count totals
        data.TotalLikes = engagements.Count(e => e.IsLiked);
        data.TotalComments = engagements.Count(e => e.IsCommented);
        data.TotalShares = engagements.Count(e => e.IsShared);

        // Group by staff
        var staffGroups = engagements
            .GroupBy(e => new { e.StaffID, e.Staff!.FullName, e.Staff.Department })
            .OrderBy(g => g.Key.FullName)
            .ToList();

        foreach (var group in staffGroups)
        {
            var row = new StaffRowData
            {
                StaffName = group.Key.FullName ?? "Unknown",
                Department = group.Key.Department ?? "N/A"
            };

            // For each company, add engagement details
            foreach (var company in companies)
            {
                var staffCompanyEngs = group.Where(e => e.Post?.Company?.CompanyName == company).ToList();
                var detail = new EngagementDetail
                {
                    CompanyName = company,
                    IsLiked = staffCompanyEngs.Any(e => e.IsLiked),
                    IsCommented = staffCompanyEngs.Any(e => e.IsCommented),
                    IsShared = staffCompanyEngs.Any(e => e.IsShared)
                };
                row.Engagements.Add(detail);
            }

            data.StaffRows.Add(row);
        }

        return data;
    }

    private byte[] GeneratePdfDocument(ReportData data)
    {
        var document = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4.Landscape());
                page.Margin(15);
                page.PageColor(Colors.White);

                page.Header().Text(txt =>
                {
                    txt.Span("Monitoring Session Report").FontSize(18).Bold().FontColor("#1e40af");
                });

                page.Content().Column(col =>
                {
                    // Session date
                    col.Item().Text($"Date: {data.SessionDate:dd MMMM yyyy}").FontSize(11).FontColor("#4b5563");

                    // Summary section (totals)
                    col.Item().PaddingTop(10).Column(c =>
                    {
                        c.Item().Text("Summary").FontSize(11).Bold().FontColor("#1e40af");
                        c.Item().Row(r =>
                        {
                            r.RelativeColumn().Text($"Total Likes: {data.TotalLikes}").FontSize(10);
                            r.RelativeColumn().Text($"Total Comments: {data.TotalComments}").FontSize(10);
                            r.RelativeColumn().Text($"Total Shares: {data.TotalShares}").FontSize(10);
                        });
                    });

                    // Table with per-staff, per-company engagements
                    col.Item().PaddingTop(12).Table(table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            columns.RelativeColumn(1.5f);  // Staff Name
                            columns.RelativeColumn(1.2f);  // Department
                            
                            // For each company, add 3 columns (Like, Comment, Share)
                            foreach (var _ in data.Companies)
                            {
                                columns.RelativeColumn(0.5f);  // Like
                                columns.RelativeColumn(0.5f);  // Comment
                                columns.RelativeColumn(0.5f);  // Share
                            }
                        });

                        // Header row: Staff name, Dept, then Company names with sub-labels
                        table.Header(header =>
                        {
                            header.Cell().Background("#1e40af").Padding(6).Text("Staff Name").FontColor(Colors.White).Bold().FontSize(9);
                            header.Cell().Background("#1e40af").Padding(6).Text("Department").FontColor(Colors.White).Bold().FontSize(9);
                            
                            foreach (var company in data.Companies)
                            {
                                header.Cell().Background("#3b82f6").Padding(3).Text(company).FontColor(Colors.White).Bold().FontSize(8).AlignCenter();
                                header.Cell().Background("#3b82f6").Padding(3).Text("").FontSize(8);
                                header.Cell().Background("#3b82f6").Padding(3).Text("").FontSize(8);
                            }
                        });

                        // Data rows
                        foreach (var staffRow in data.StaffRows)
                        {
                            table.Cell().Padding(6).Text(staffRow.StaffName).FontSize(9);
                            table.Cell().Padding(6).Text(staffRow.Department).FontSize(9);
                            
                            foreach (var engagement in staffRow.Engagements)
                            {
                                table.Cell().Padding(4).Text(engagement.IsLiked ? "✓" : "-").FontSize(9).AlignCenter().FontColor(engagement.IsLiked ? "#10b981" : "#d1d5db");
                                table.Cell().Padding(4).Text(engagement.IsCommented ? "✓" : "-").FontSize(9).AlignCenter().FontColor(engagement.IsCommented ? "#10b981" : "#d1d5db");
                                table.Cell().Padding(4).Text(engagement.IsShared ? "✓" : "-").FontSize(9).AlignCenter().FontColor(engagement.IsShared ? "#10b981" : "#d1d5db");
                            }
                        }
                    });

                    // Legend
                    col.Item().PaddingTop(8).Text("✓ = Yes | - = No | L = Like | C = Comment | S = Share").FontSize(8).FontColor("#9ca3af").Italic();
                });

                page.Footer().AlignCenter().Text($"Generated on {DateTime.UtcNow:dd MMMM yyyy HH:mm:ss} UTC").FontSize(8).FontColor("#9ca3af");
            });
        });

        return document.GeneratePdf();
    }
}

public record PostRequest(Guid PlatformID, string PostLink);
public record CreateSessionRequest(DateOnly SessionDate, List<PostRequest> Posts, List<Guid>? CompanyIDs);
public record UpdatePostLinkRequest(string? PostLink);

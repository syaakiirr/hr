using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using socihr_backend.Data;
using socihr_backend.Models;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using SkiaSharp;

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
        public List<ColumnInfo> ActionColumns { get; set; } = new();  // Columns with company/platform/action info
        public List<CompanyGroup> CompanyGroups { get; set; } = new();  // Grouped for header
        public List<PlatformGroup> PlatformGroups { get; set; } = new();  // Grouped for sub-header
        public List<StaffRowData> StaffRows { get; set; } = new();
        public int TotalLikes { get; set; }
        public int TotalComments { get; set; }
        public int TotalShares { get; set; }
    }

    private class ColumnInfo
    {
        public string PostID { get; set; } = "";
        public string PlatformName { get; set; } = "";
        public string CompanyID { get; set; } = "";
        public string CompanyName { get; set; } = "";
        public string Action { get; set; } = "";  // "like", "comment", "share"
        public string ActionLabel { get; set; } = "";
        public string ActionIcon { get; set; } = "";
        public string PostLink { get; set; } = "";
    }

    private class CompanyGroup
    {
        public string CompanyID { get; set; } = "";
        public string Name { get; set; } = "";
        public int Span { get; set; }
    }

    private class PlatformGroup
    {
        public string PostID { get; set; } = "";
        public string PlatformName { get; set; } = "";
        public string PostLink { get; set; } = "";
        public int Span { get; set; }
    }

    private class StaffRowData
    {
        public string StaffName { get; set; } = "";
        public string Department { get; set; } = "";
        public List<bool> EngagementValues { get; set; } = new();  // Per column (like/comment/share)
    }

    private ReportData BuildReportData(MonitoringSession session, List<Engagement> engagements)
    {
        var data = new ReportData { SessionDate = session.SessionDate };

        // Get unique posts from engagements, sorted by company then platform
        var platformOrder = new Dictionary<string, int> { { "Facebook", 0 }, { "Instagram", 1 }, { "TikTok", 2 } };
        var uniquePosts = engagements
            .Where(e => e.Post != null)
            .GroupBy(e => e.Post!.PostID)
            .Select(g => g.First().Post!)
            .OrderBy(p => (p.Company?.CompanyName ?? "").ToLower())
            .ThenBy(p => platformOrder.ContainsKey(p.Platform?.PlatformName ?? "") 
                ? platformOrder[p.Platform!.PlatformName] 
                : 99)
            .ToList();

        // Build action columns
        foreach (var post in uniquePosts)
        {
            var platform = post.Platform?.PlatformName?.ToLower() ?? "";
            var actions = platform == "facebook"
                ? new[] { ("like", "Like"), ("comment", "Comment") }
                : platform == "instagram"
                ? new[] { ("like", "Like"), ("comment", "Comment") }
                : platform == "tiktok"
                ? new[] { ("comment", "Comment") }
                : new[] { ("like", "Like"), ("comment", "Comment"), ("share", "Share") };

            foreach (var (action, label) in actions)
            {
                data.ActionColumns.Add(new ColumnInfo
                {
                    PostID = post.PostID.ToString(),
                    PlatformName = post.Platform?.PlatformName ?? "Unknown",
                    CompanyID = post.Company?.CompanyID.ToString() ?? "",
                    CompanyName = post.Company?.CompanyName ?? "No Company",
                    Action = action,
                    ActionLabel = label,
                    PostLink = post.PostLink ?? ""
                });
            }
        }

        // Build company groups (for header spanning)
        var companyGroups = new List<CompanyGroup>();
        foreach (var col in data.ActionColumns)
        {
            var lastCo = companyGroups.LastOrDefault();
            if (lastCo != null && lastCo.Name == col.CompanyName)
            {
                lastCo.Span++;
            }
            else
            {
                companyGroups.Add(new CompanyGroup { CompanyID = col.CompanyID, Name = col.CompanyName, Span = 1 });
            }
        }
        data.CompanyGroups = companyGroups;

        // Build platform groups (for sub-header spanning)
        var platformGroups = new List<PlatformGroup>();
        foreach (var col in data.ActionColumns)
        {
            var lastPl = platformGroups.LastOrDefault();
            if (lastPl != null && lastPl.PostID == col.PostID)
            {
                lastPl.Span++;
            }
            else
            {
                platformGroups.Add(new PlatformGroup 
                { 
                    PostID = col.PostID,
                    PlatformName = col.PlatformName, 
                    PostLink = col.PostLink,
                    Span = 1 
                });
            }
        }
        data.PlatformGroups = platformGroups;

        // Build staff rows with engagement values
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

            // For each column, check if staff has this action for this post
            foreach (var col in data.ActionColumns)
            {
                var eng = group.FirstOrDefault(e => e.PostID.ToString() == col.PostID);
                bool value = false;

                if (eng != null)
                {
                    value = col.Action == "like" ? eng.IsLiked
                          : col.Action == "comment" ? eng.IsCommented
                          : col.Action == "share" ? eng.IsShared
                          : false;
                }

                row.EngagementValues.Add(value);

                // Count totals
                if (value)
                {
                    if (col.Action == "like") data.TotalLikes++;
                    else if (col.Action == "comment") data.TotalComments++;
                    else if (col.Action == "share") data.TotalShares++;
                }
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
                page.Margin(16);
                page.PageColor(Colors.White);

                page.Header().PaddingBottom(8).Row(row =>
                {
                    row.RelativeItem().Column(c =>
                    {
                        c.Item().Text("Monitoring Session Report").FontSize(16).Bold().FontColor("#1e40af");
                        c.Item().Text($"System crafted by @syaakiirr").FontSize(8).FontColor("#9ca3af");
                    });
                    row.ConstantItem(150).AlignRight().Text($"{data.SessionDate:dd MMMM yyyy}").FontSize(11).Bold().FontColor("#475569");
                });

                page.Content().Column(col =>
                {
                    // Summary Totals cards
                    col.Item().PaddingBottom(12).Row(row =>
                    {
                        row.RelativeItem().Element(c => Card(c, "Total Likes", data.TotalLikes.ToString(), "#3b82f6"));
                        row.ConstantItem(12);
                        row.RelativeItem().Element(c => Card(c, "Total Comments", data.TotalComments.ToString(), "#0ea5e9"));
                        row.ConstantItem(12);
                        row.RelativeItem().Element(c => Card(c, "Total Shares", data.TotalShares.ToString(), "#10b981"));
                    });

                    // Engagement Matrix - Single Table
                    col.Item().Table(table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            columns.RelativeColumn(0.3f);  // Rank
                            columns.RelativeColumn(1.5f);  // Staff Name
                            columns.RelativeColumn(0.9f);  // Department
                            
                            foreach (var _ in data.ActionColumns)
                            {
                                columns.RelativeColumn(0.55f);
                            }
                        });

                        // Headers
                        table.Header(header =>
                        {
                            static IContainer BaseHeader(IContainer container, string bg) =>
                                container.Background(bg).Border(1).BorderColor("#cbd5e1").PaddingHorizontal(2).AlignCenter().AlignMiddle();

                            // Column 1, 2, 3: Spanning 3 rows vertically
                            header.Cell().RowSpan(3).Element(c => BaseHeader(c, "#f1f5f9")).Text("#").FontSize(7.5f).Bold().FontColor("#475569");
                            header.Cell().RowSpan(3).Element(c => BaseHeader(c, "#f1f5f9")).Text("Staff Name").FontSize(7.5f).Bold().FontColor("#475569");
                            header.Cell().RowSpan(3).Element(c => BaseHeader(c, "#f1f5f9")).Text("Dept").FontSize(7.5f).Bold().FontColor("#475569");

                            // Row 1: Company groups
                            foreach (var coGroup in data.CompanyGroups)
                            {
                                header.Cell().ColumnSpan((uint)coGroup.Span).Element(c => BaseHeader(c, "#dbeafe"))
                                    .Text(coGroup.Name).FontSize(7.5f).Bold().FontColor("#1e40af");
                            }

                            // Row 2: Platform groups
                            foreach (var platGroup in data.PlatformGroups)
                            {
                                var cell = header.Cell().ColumnSpan((uint)platGroup.Span).Element(c => BaseHeader(c, "#e0f2fe"));
                                if (!string.IsNullOrEmpty(platGroup.PostLink))
                                {
                                    cell.Hyperlink(platGroup.PostLink).Text(platGroup.PlatformName).FontSize(6f).Bold().FontColor("#0369a1").Underline();
                                }
                                else
                                {
                                    cell.Text(platGroup.PlatformName).FontSize(6f).Bold().FontColor("#0369a1");
                                }
                            }

                            // Row 3: Action columns
                            foreach (var col in data.ActionColumns)
                            {
                                header.Cell().Element(c => BaseHeader(c, "#f0fdf4"))
                                    .Text(col.ActionLabel).FontSize(5.5f).Bold().FontColor("#15803d");
                            }
                        });

                        // Data Rows
                        int rowNum = 1;
                        foreach (var staffRow in data.StaffRows)
                        {
                            var bgColor = rowNum % 2 == 0 ? "#f8fafc" : "#ffffff";

                            static IContainer DataCell(IContainer container, string bg) =>
                                container.Background(bg).Border(1).BorderColor("#cbd5e1").Padding(4).AlignMiddle();

                            // Rank
                            table.Cell().Element(c => DataCell(c, bgColor)).AlignCenter().Text(rowNum.ToString()).FontSize(7).FontColor("#64748b");
                            
                            // Staff Name
                            table.Cell().Element(c => DataCell(c, bgColor)).Text(staffRow.StaffName).FontSize(7).Bold().FontColor("#1e293b");
                            
                            // Department
                            table.Cell().Element(c => DataCell(c, bgColor)).Text(staffRow.Department).FontSize(7).FontColor("#475569");

                            // Engagement Values
                            for (int i = 0; i < staffRow.EngagementValues.Count; i++)
                            {
                                var value = staffRow.EngagementValues[i];
                                var cell = table.Cell().Element(c => DataCell(c, bgColor)).AlignCenter();
                                
                                if (value)
                                {
                                    cell.AlignCenter().AlignMiddle()
                                        .Width(11).Height(11)
                                        .Background("#10b981")
                                        .AlignCenter().AlignMiddle()
                                        .Text("✓").FontSize(8).Bold().FontColor("#ffffff");
                                }
                                else
                                {
                                    cell.Text("");
                                }
                            }

                            rowNum++;
                        }
                    });
                });

                page.Footer().AlignCenter().Text(t =>
                {
                    t.Span("Generated ").FontSize(8).FontColor("#9ca3af");
                    t.Span($"{DateTime.UtcNow:dd MMMM yyyy HH:mm:ss} UTC").FontSize(8).FontColor("#9ca3af");
                    t.Span("  •  Page ").FontSize(8).FontColor("#9ca3af");
                    t.CurrentPageNumber().FontSize(8).FontColor("#9ca3af");
                    t.Span(" of ").FontSize(8).FontColor("#9ca3af");
                    t.TotalPages().FontSize(8).FontColor("#9ca3af");
                });
            });
        });

        return document.GeneratePdf();
    }

    private void Card(IContainer container, string label, string value, string color)
    {
        container
            .Background("#f8fafc")
            .Border(1)
            .BorderColor("#cbd5e1")
            .Row(row =>
            {
                row.ConstantItem(4).Background(color);
                row.RelativeItem().Padding(6).Column(c =>
                {
                    c.Item().Text(label).FontSize(8).FontColor("#64748b").Bold();
                    c.Item().Text(value).FontSize(12).Bold().FontColor(color);
                });
            });
    }
}

public record PostRequest(Guid PlatformID, string PostLink);
public record CreateSessionRequest(DateOnly SessionDate, List<PostRequest> Posts, List<Guid>? CompanyIDs);
public record UpdatePostLinkRequest(string? PostLink);

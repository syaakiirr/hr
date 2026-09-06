using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using socihr_backend.Data;
using socihr_backend.Models;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using SkiaSharp;
using socihr_backend.Helpers;
using ClosedXML.Excel;

namespace socihr_backend.Controllers;

[Authorize(Roles = "SuperAdmin,DeptAdmin")]
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

    // PUT /api/monitoringsession/{id}
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateSessionRequest req)
    {
        try
        {
            var session = await _db.MonitoringSessions.FindAsync(id);
            if (session == null) return NotFound(new { message = "Session not found." });

            // 1. Update session date
            session.SessionDate = req.SessionDate;

            // 2. Load current posts
            var currentPosts = await _db.SessionPosts
                .Where(p => p.SessionID == id)
                .ToListAsync();

            // Build desired set of (companyID, platformID) pairs
            var desiredPairs = new HashSet<(Guid? companyID, Guid platformID)>();
            if (req.CompanyIDs != null && req.CompanyIDs.Count > 0 && req.PlatformIDs != null && req.PlatformIDs.Count > 0)
            {
                foreach (var cId in req.CompanyIDs)
                    foreach (var pId in req.PlatformIDs)
                        desiredPairs.Add((cId, pId));
            }
            else if (req.PlatformIDs != null && req.PlatformIDs.Count > 0)
            {
                foreach (var pId in req.PlatformIDs)
                    desiredPairs.Add((null, pId));
            }

            // 3. Find posts to remove
            var postsToRemove = currentPosts.Where(p =>
                !desiredPairs.Contains((p.CompanyID, p.PlatformID))).ToList();

            // 4. Find pairs to add
            var currentPairs = currentPosts.Select(p => (p.CompanyID, p.PlatformID)).ToHashSet();
            var pairsToAdd = desiredPairs.Where(d => !currentPairs.Contains(d)).ToList();

            if (postsToRemove.Any())
            {
                var removePostIds = postsToRemove.Select(p => p.PostID).ToList();

                var removeEngIds = await _db.Engagements
                    .Where(e => removePostIds.Contains(e.PostID))
                    .Select(e => e.EngagementID)
                    .ToListAsync();

                var audits = await _db.AuditTrails
                    .Where(a => removeEngIds.Contains(a.EngagementID))
                    .ToListAsync();
                _db.AuditTrails.RemoveRange(audits);

                var engsToRemove = await _db.Engagements
                    .Where(e => removePostIds.Contains(e.PostID))
                    .ToListAsync();
                _db.Engagements.RemoveRange(engsToRemove);
                _db.SessionPosts.RemoveRange(postsToRemove);
            }

            if (pairsToAdd.Any())
            {
                var activeStaff = await _db.Staff
                    .Where(s => s.Status == "Active" && !s.IsArchived)
                    .ToListAsync();

                foreach (var (companyID, platformID) in pairsToAdd)
                {
                    var post = new SessionPost
                    {
                        PostID = Guid.NewGuid(),
                        SessionID = id,
                        PlatformID = platformID,
                        CompanyID = companyID,
                        PostLink = ""
                    };
                    _db.SessionPosts.Add(post);

                    foreach (var staff in activeStaff)
                    {
                        _db.Engagements.Add(new Engagement
                        {
                            EngagementID = Guid.NewGuid(),
                            SessionID = id,
                            PostID = post.PostID,
                            StaffID = staff.StaffID,
                            Status = "Missed"
                        });
                    }
                }
            }

            await _db.SaveChangesAsync();

            var updatedPosts = await _db.SessionPosts
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
                session.IsArchived,
                Posts = updatedPosts.Select(p => new
                {
                    p.PostID,
                    p.PlatformID,
                    PlatformName = p.Platform!.PlatformName,
                    p.PostLink,
                    p.CompanyID,
                    CompanyName = p.Company != null ? p.Company.CompanyName : "No Company"
                }),
                Companies = updatedPosts
                    .Where(p => p.Company != null)
                    .Select(p => new { p.CompanyID, CompanyName = p.Company!.CompanyName })
                    .GroupBy(c => c.CompanyID)
                    .Select(g => g.First())
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
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

    // POST /api/monitoringsession/{sessionId}/add-staff
    [HttpPost("{sessionId:guid}/add-staff")]
    public async Task<IActionResult> AddStaffToSession(Guid sessionId, [FromBody] AddStaffToSessionRequest req)
    {
        // Validate session exists
        var session = await _db.MonitoringSessions.FindAsync(sessionId);
        if (session == null) return NotFound(new { message = "Session not found." });

        // Get posts for the session
        var posts = await _db.SessionPosts.Where(p => p.SessionID == sessionId).ToListAsync();
        if (!posts.Any()) return BadRequest(new { message = "Session has no posts." });

        // Get existing staff IDs in the session
        var existingStaffIds = await _db.Engagements
            .Where(e => e.SessionID == sessionId)
            .Select(e => e.StaffID)
            .Distinct()
            .ToListAsync();

        // Get valid staff: active, not archived, and not already in the session
        var staffIdsToAdd = req.StaffIds.Distinct().ToList();
        var validStaff = await _db.Staff
            .Where(s => staffIdsToAdd.Contains(s.StaffID) 
                        && s.Status == "Active" 
                        && !s.IsArchived
                        && !existingStaffIds.Contains(s.StaffID))
            .ToListAsync();

        if (!validStaff.Any()) return BadRequest(new { message = "No valid staff to add (either not active, archived, or already in session)." });

        // Create engagements for each new staff and each post
        foreach (var staff in validStaff)
        {
            foreach (var post in posts)
            {
                _db.Engagements.Add(new Engagement
                {
                    EngagementID = Guid.NewGuid(),
                    SessionID = sessionId,
                    PostID = post.PostID,
                    StaffID = staff.StaffID,
                    Status = "Missed"
                });
            }
        }

        await _db.SaveChangesAsync();

        return Ok(new 
        { 
            message = $"Successfully added {validStaff.Count} staff to the session.",
            addedStaffCount = validStaff.Count 
        });
    }

    // POST /api/monitoringsession/multi-report  — generate a combined PDF for multiple sessions
    [HttpPost("multi-report")]
    public async Task<IActionResult> GenerateMultiReportPdf([FromBody] MultiSessionReportRequest req)
    {
        try
        {
            if (req.SessionIDs == null || req.SessionIDs.Count == 0)
                return BadRequest(new { message = "No session IDs provided." });

            var sessions = await _db.MonitoringSessions
                .AsNoTracking()
                .Where(s => req.SessionIDs.Contains(s.SessionID))
                .OrderBy(s => s.SessionDate)
                .ToListAsync();

            if (sessions.Count == 0)
                return NotFound(new { message = "No sessions found." });

            var sessionIds = sessions.Select(s => s.SessionID).ToList();

            var engagements = await _db.Engagements
                .AsNoTracking()
                .Include(e => e.Staff)
                .Include(e => e.Post)
                .ThenInclude(p => p!.Platform)
                .Include(e => e.Post)
                .ThenInclude(p => p!.Company)
                .Where(e => sessionIds.Contains(e.SessionID))
                .ToListAsync();

            var pdf = GenerateMultiPdfDocument(sessions, engagements);

            var fileName = $"combined-monitoring-report-{sessions.Count}-sessions.pdf";
            return File(pdf, "application/pdf", fileName);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message, stackTrace = ex.StackTrace });
        }
    }

    // POST /api/monitoringsession/custom-report
    [HttpPost("custom-report")]
    public async Task<IActionResult> GenerateCustomReportPdf([FromBody] CustomReportRequest req)
    {
        try
        {
            if (req.SessionIDs == null || req.SessionIDs.Count == 0)
                return BadRequest(new { message = "No session IDs provided." });

            var query = _db.MonitoringSessions.AsNoTracking()
                .Where(s => req.SessionIDs.Contains(s.SessionID));

            if (req.DateFrom.HasValue)
                query = query.Where(s => s.SessionDate >= DateOnly.FromDateTime(req.DateFrom.Value));
            if (req.DateTo.HasValue)
                query = query.Where(s => s.SessionDate <= DateOnly.FromDateTime(req.DateTo.Value));

            var sessions = await query.OrderBy(s => s.SessionDate).ToListAsync();

            if (sessions.Count == 0)
                return NotFound(new { message = "No sessions found." });

            var sessionIds = sessions.Select(s => s.SessionID).ToList();

            var engQuery = _db.Engagements
                .AsNoTracking()
                .Include(e => e.Staff)
                .Include(e => e.Post)
                .ThenInclude(p => p!.Platform)
                .Include(e => e.Post)
                .ThenInclude(p => p!.Company)
                .Where(e => sessionIds.Contains(e.SessionID));

            var engagements = await engQuery.ToListAsync();

            if (req.SelectedCompanyIDs != null && req.SelectedCompanyIDs.Count > 0)
                engagements = engagements.Where(e => e.Post != null && req.SelectedCompanyIDs.Any(id => id == e.Post.CompanyID)).ToList();
            if (req.SelectedPlatformIDs != null && req.SelectedPlatformIDs.Count > 0)
                engagements = engagements.Where(e => e.Post != null && req.SelectedPlatformIDs.Any(id => id == e.Post.PlatformID)).ToList();

            var pdf = await GenerateCustomReportPdf(sessions, engagements, req);

            var fileName = $"custom-report-{sessions.Count}-sessions.pdf";
            return File(pdf, "application/pdf", fileName);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message, stackTrace = ex.StackTrace });
        }
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

    // GET /api/monitoringsession/{id}/report-excel
    [HttpGet("{id:guid}/report-excel")]
    public async Task<IActionResult> GenerateReportExcel(Guid id)
    {
        try
        {
            var session = await _db.MonitoringSessions
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.SessionID == id);

            if (session == null)
                return NotFound(new { message = "Session not found." });

            var engagements = await _db.Engagements
                .AsNoTracking()
                .Include(e => e.Staff)
                .Include(e => e.Post).ThenInclude(p => p!.Platform)
                .Include(e => e.Post).ThenInclude(p => p!.Company)
                .Where(e => e.SessionID == id)
                .ToListAsync();

            var reportData = BuildReportData(session, engagements);

            using var workbook = new XLWorkbook();
            var ws = workbook.Worksheets.Add("Session Report");
            FillSessionSheet(ws, reportData, session, 1, 1);
            ws.Columns().AdjustToContents();

            using var ms = new MemoryStream();
            workbook.SaveAs(ms);
            ms.Seek(0, SeekOrigin.Begin);

            return File(ms.ToArray(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                $"monitoring-report-{session.SessionDate:yyyy-MM-dd}.xlsx");
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    // POST /api/monitoringsession/multi-report-excel
    [HttpPost("multi-report-excel")]
    public async Task<IActionResult> GenerateMultiReportExcel([FromBody] MultiSessionReportRequest req)
    {
        try
        {
            if (req.SessionIDs == null || req.SessionIDs.Count == 0)
                return BadRequest(new { message = "No session IDs provided." });

            var sessions = await _db.MonitoringSessions
                .AsNoTracking()
                .Where(s => req.SessionIDs.Contains(s.SessionID))
                .OrderBy(s => s.SessionDate)
                .ToListAsync();

            if (sessions.Count == 0)
                return NotFound(new { message = "No sessions found." });

            var sessionIds = sessions.Select(s => s.SessionID).ToList();

            var engagements = await _db.Engagements
                .AsNoTracking()
                .Include(e => e.Staff)
                .Include(e => e.Post).ThenInclude(p => p!.Platform)
                .Include(e => e.Post).ThenInclude(p => p!.Company)
                .Where(e => sessionIds.Contains(e.SessionID))
                .ToListAsync();

            using var workbook = new XLWorkbook();

            for (int i = 0; i < sessions.Count; i++)
            {
                var session = sessions[i];
                var sessionEngagements = engagements.Where(e => e.SessionID == session.SessionID).ToList();
                var reportData = BuildReportData(session, sessionEngagements);

                var sheetName = $"Session {i + 1} - {session.SessionDate:yyyy-MM-dd}";
                if (sheetName.Length > 31) sheetName = $"Session {i + 1} - {session.SessionDate:yyyy-MM-dd}";
                sheetName = sheetName[..Math.Min(sheetName.Length, 31)];

                var ws = workbook.Worksheets.Add(sheetName);
                FillSessionSheet(ws, reportData, session, 1, 1);
                ws.Columns().AdjustToContents();
            }

            using var ms = new MemoryStream();
            workbook.SaveAs(ms);
            ms.Seek(0, SeekOrigin.Begin);

            var fileName = $"combined-monitoring-report-{sessions.Count}-sessions.xlsx";
            return File(ms.ToArray(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                fileName);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message, stackTrace = ex.StackTrace });
        }
    }

    private void FillSessionSheet(IXLWorksheet ws, ReportData data, MonitoringSession session, int startRow, int startCol)
    {
        static XLColor Html(string hex) => XLColor.FromHtml(hex);

        // ── Header ──
        ws.Cell(startRow, startCol).Value = "Monitoring Session Report";
        ws.Cell(startRow, startCol).Style.Font.Bold = true;
        ws.Cell(startRow, startCol).Style.Font.FontSize = 16;
        ws.Cell(startRow, startCol).Style.Font.FontColor = Html("#1e40af");
        ws.Range(startRow, startCol, startRow, startCol + 2).Merge();
        ws.Cell(startRow + 1, startCol).Value = $"Date: {session.SessionDate:dd MMMM yyyy}";
        ws.Cell(startRow + 1, startCol).Style.Font.FontSize = 11;
        ws.Cell(startRow + 1, startCol).Style.Font.FontColor = Html("#475569");
        ws.Cell(startRow + 2, startCol).Value = "System crafted by @syaakiirr";
        ws.Cell(startRow + 2, startCol).Style.Font.FontSize = 8;
        ws.Cell(startRow + 2, startCol).Style.Font.FontColor = Html("#9ca3af");

        // ── Summary Cards ──
        int cardRow = startRow + 4;
        var cards = new[] {
            ("Total Likes", data.TotalLikes.ToString(), "#3b82f6"),
            ("Total Comments", data.TotalComments.ToString(), "#0ea5e9"),
            ("Total Shares", data.TotalShares.ToString(), "#10b981")
        };
        for (int ci = 0; ci < cards.Length; ci++)
        {
            var (label, val, color) = cards[ci];
            var c = ws.Cell(cardRow, startCol + ci * 3);
            c.Value = label;
            c.Style.Font.Bold = true;
            c.Style.Font.FontSize = 10;
            c.Style.Font.FontColor = Html(color);
            c.Style.Fill.BackgroundColor = Html("#f8fafc");
            c = ws.Cell(cardRow + 1, startCol + ci * 3);
            c.Value = val;
            c.Style.Font.Bold = true;
            c.Style.Font.FontSize = 14;
            c.Style.Font.FontColor = Html(color);
        }

        // ── Company Breakdown Table ──
        int tableRow = cardRow + 3;
        if (data.CompanyStats.Count > 0)
        {
            ws.Cell(tableRow, startCol).Value = "Company Engagement Breakdown";
            ws.Cell(tableRow, startCol).Style.Font.Bold = true;
            ws.Cell(tableRow, startCol).Style.Font.FontSize = 11;
            ws.Cell(tableRow, startCol).Style.Font.FontColor = Html("#1e40af");

            var coHeaders = new[] { "Company", "Total Likes", "Total Comments", "Total Shares", "Completed", "Expected", "Rate (%)" };
            for (int i = 0; i < coHeaders.Length; i++)
            {
                var cell = ws.Cell(tableRow + 1, startCol + i);
                cell.Value = coHeaders[i];
                cell.Style.Font.Bold = true;
                cell.Style.Font.FontSize = 8.5f;
                cell.Style.Fill.BackgroundColor = Html("#1e40af");
                cell.Style.Font.FontColor = Html("#ffffff");
                cell.Style.Alignment.SetHorizontal(XLAlignmentHorizontalValues.Center);
            }

            for (int i = 0; i < data.CompanyStats.Count; i++)
            {
                var cs = data.CompanyStats[i];
                var r = tableRow + 2 + i;
                var bg = i % 2 == 0 ? "#ffffff" : "#f8fafc";

                ws.Cell(r, startCol).Value = cs.CompanyName;
                ws.Cell(r, startCol + 1).Value = cs.Likes;
                ws.Cell(r, startCol + 2).Value = cs.Comments;
                ws.Cell(r, startCol + 3).Value = cs.Shares;
                ws.Cell(r, startCol + 4).Value = cs.CompletedTicks;
                ws.Cell(r, startCol + 5).Value = cs.TotalExpectedTicks;
                ws.Cell(r, startCol + 6).Value = $"{cs.Rate}%";

                for (int c = 0; c < 7; c++)
                {
                    var cell = ws.Cell(r, startCol + c);
                    cell.Style.Fill.BackgroundColor = Html(bg);
                    cell.Style.Font.FontSize = 8.5f;
                    cell.Style.Border.SetBottomBorder(XLBorderStyleValues.Thin).Border.SetBottomBorderColor(Html("#cbd5e1"));
                    if (c > 0) cell.Style.Alignment.SetHorizontal(XLAlignmentHorizontalValues.Center);
                }
                var rColor = cs.Rate >= 80 ? "#16a34a" : cs.Rate >= 50 ? "#d97706" : "#dc2626";
                ws.Cell(r, startCol + 6).Style.Font.FontColor = Html(rColor);
                ws.Cell(r, startCol + 6).Style.Font.Bold = true;
            }
            tableRow += 3 + data.CompanyStats.Count;
        }

        // ── Table Headers ──
        int col = startCol;

        // Fixed columns: #, Staff Name, Department
        ws.Cell(tableRow, col).Value = "#";
        StyleHeader(ws, tableRow, col, Html("#f1f5f9"), Html("#475569"), 7.5f);
        ws.Range(tableRow, col, tableRow + 2, col).Merge();

        col++;
        ws.Cell(tableRow, col).Value = "Staff Name";
        StyleHeader(ws, tableRow, col, Html("#f1f5f9"), Html("#475569"), 7.5f);
        ws.Range(tableRow, col, tableRow + 2, col).Merge();

        col++;
        ws.Cell(tableRow, col).Value = "Dept";
        StyleHeader(ws, tableRow, col, Html("#f1f5f9"), Html("#475569"), 7.5f);
        ws.Range(tableRow, col, tableRow + 2, col).Merge();

        int actionStartCol = col + 1;

        // Company headers (row 1 of action header)
        int companyRow = tableRow;
        int platformRow = tableRow + 1;
        int actionRow = tableRow + 2;

        foreach (var coGroup in data.CompanyGroups)
        {
            var cell = ws.Cell(companyRow, col + 1);
            cell.Value = coGroup.Name;
            StyleHeader(ws, companyRow, col + 1, Html("#dbeafe"), Html("#1e40af"), 9f);
            if (coGroup.Span > 1)
                ws.Range(companyRow, col + 1, companyRow, col + coGroup.Span).Merge();
            for (int s = 0; s < coGroup.Span; s++)
            {
                col++;
            }
        }

        // Reason header
        col++;
        ws.Cell(tableRow, col).Value = "Reason";
        StyleHeader(ws, tableRow, col, Html("#fef3c7"), Html("#92400e"), 7.5f);
        ws.Range(tableRow, col, tableRow + 2, col).Merge();
        int reasonCol = col;

        // Platform headers (row 2)
        col = actionStartCol;
        foreach (var platGroup in data.PlatformGroups)
        {
            var cell = ws.Cell(platformRow, col);
            cell.Value = platGroup.PlatformName;
            StyleHeader(ws, platformRow, col, Html("#e0f2fe"), Html("#0369a1"), 8f);
            if (platGroup.Span > 1)
                ws.Range(platformRow, col, platformRow, col + platGroup.Span - 1).Merge();
            col += platGroup.Span;
        }

        // Action headers (row 3)
        col = actionStartCol;
        foreach (var ac in data.ActionColumns)
        {
            ws.Cell(actionRow, col).Value = ac.ActionLabel;
            StyleHeader(ws, actionRow, col, Html("#f0fdf4"), Html("#15803d"), 6.5f);
            col++;
        }

        // ── Data Rows ──
        int dataRow = tableRow + 3;
        for (int ri = 0; ri < data.StaffRows.Count; ri++)
        {
            var staffRow = data.StaffRows[ri];
            var bgColor = ri % 2 == 0 ? Html("#ffffff") : Html("#f8fafc");

            int dc = startCol;
            ws.Cell(dataRow, dc).Value = ri + 1;
            StyleData(ws, dataRow, dc, bgColor, Html("#64748b"), 7);
            ws.Cell(dataRow, dc).Style.Alignment.SetHorizontal(XLAlignmentHorizontalValues.Center);

            dc++;
            ws.Cell(dataRow, dc).Value = staffRow.StaffName;
            StyleData(ws, dataRow, dc, bgColor, Html("#1e293b"), 7);
            ws.Cell(dataRow, dc).Style.Font.Bold = true;

            dc++;
            ws.Cell(dataRow, dc).Value = staffRow.Department;
            StyleData(ws, dataRow, dc, bgColor, Html("#475569"), 7);

            dc++;
            for (int ei = 0; ei < staffRow.EngagementValues.Count; ei++)
            {
                if (staffRow.EngagementValues[ei])
                {
                    ws.Cell(dataRow, dc).Value = "✓";
                    ws.Cell(dataRow, dc).Style.Font.FontColor = Html("#ffffff");
                    ws.Cell(dataRow, dc).Style.Fill.BackgroundColor = Html("#10b981");
                    ws.Cell(dataRow, dc).Style.Alignment.SetHorizontal(XLAlignmentHorizontalValues.Center);
                    ws.Cell(dataRow, dc).Style.Font.Bold = true;
                }
                else
                {
                    ws.Cell(dataRow, dc).Value = "";
                }
                ws.Cell(dataRow, dc).Style.Border.SetLeftBorder(XLBorderStyleValues.Thin).Border.SetLeftBorderColor(Html("#cbd5e1"));
                ws.Cell(dataRow, dc).Style.Border.SetRightBorder(XLBorderStyleValues.Thin).Border.SetRightBorderColor(Html("#cbd5e1"));
                ws.Cell(dataRow, dc).Style.Border.SetTopBorder(XLBorderStyleValues.Thin).Border.SetTopBorderColor(Html("#cbd5e1"));
                ws.Cell(dataRow, dc).Style.Border.SetBottomBorder(XLBorderStyleValues.Thin).Border.SetBottomBorderColor(Html("#cbd5e1"));
                dc++;
            }

            ws.Cell(dataRow, reasonCol).Value = staffRow.Reason ?? "";
            StyleData(ws, dataRow, reasonCol, bgColor, Html("#475569"), 6);

            dataRow++;
        }

        // ── Footer ──
        int footerRow = dataRow + 2;
        ws.Cell(footerRow, startCol).Value = "@syaakiirr";
        ws.Cell(footerRow, startCol).Style.Font.FontColor = Html("#94a3b8");
        ws.Cell(footerRow, startCol).Style.Font.FontSize = 7;
        ws.Cell(footerRow + 1, startCol).Value = $"Generated {DateTime.UtcNow:dd MMMM yyyy HH:mm:ss} UTC";
        ws.Cell(footerRow + 1, startCol).Style.Font.FontColor = Html("#9ca3af");
        ws.Cell(footerRow + 1, startCol).Style.Font.FontSize = 8;
    }

    private static void StyleHeader(IXLWorksheet ws, int row, int col, XLColor bg, XLColor fg, float fontSize)
    {
        var cell = ws.Cell(row, col);
        cell.Style.Font.Bold = true;
        cell.Style.Font.FontSize = fontSize;
        cell.Style.Font.FontColor = fg;
        cell.Style.Fill.BackgroundColor = bg;
        cell.Style.Alignment.SetHorizontal(XLAlignmentHorizontalValues.Center);
        cell.Style.Alignment.SetVertical(XLAlignmentVerticalValues.Center);
        cell.Style.Border.SetLeftBorder(XLBorderStyleValues.Thin).Border.SetLeftBorderColor(XLColor.FromHtml("#cbd5e1"));
        cell.Style.Border.SetRightBorder(XLBorderStyleValues.Thin).Border.SetRightBorderColor(XLColor.FromHtml("#cbd5e1"));
        cell.Style.Border.SetTopBorder(XLBorderStyleValues.Thin).Border.SetTopBorderColor(XLColor.FromHtml("#cbd5e1"));
        cell.Style.Border.SetBottomBorder(XLBorderStyleValues.Thin).Border.SetBottomBorderColor(XLColor.FromHtml("#cbd5e1"));
    }

    private static void StyleData(IXLWorksheet ws, int row, int col, XLColor bg, XLColor fg, float fontSize)
    {
        var cell = ws.Cell(row, col);
        cell.Style.Font.FontSize = fontSize;
        cell.Style.Font.FontColor = fg;
        cell.Style.Fill.BackgroundColor = bg;
        cell.Style.Alignment.SetVertical(XLAlignmentVerticalValues.Center);
        cell.Style.Border.SetLeftBorder(XLBorderStyleValues.Thin).Border.SetLeftBorderColor(XLColor.FromHtml("#cbd5e1"));
        cell.Style.Border.SetRightBorder(XLBorderStyleValues.Thin).Border.SetRightBorderColor(XLColor.FromHtml("#cbd5e1"));
        cell.Style.Border.SetTopBorder(XLBorderStyleValues.Thin).Border.SetTopBorderColor(XLColor.FromHtml("#cbd5e1"));
        cell.Style.Border.SetBottomBorder(XLBorderStyleValues.Thin).Border.SetBottomBorderColor(XLColor.FromHtml("#cbd5e1"));
    }

    internal class ReportData
    {
        public DateOnly SessionDate { get; set; }
        public List<ColumnInfo> ActionColumns { get; set; } = new();  // Columns with company/platform/action info
        public List<CompanyGroup> CompanyGroups { get; set; } = new();  // Grouped for header
        public List<PlatformGroup> PlatformGroups { get; set; } = new();  // Grouped for sub-header
        public List<StaffRowData> StaffRows { get; set; } = new();
        public List<CompanyEngagementStat> CompanyStats { get; set; } = new();
        public List<PlatformEngagementStat> PlatformStats { get; set; } = new();
        public int TotalLikes { get; set; }
        public int TotalComments { get; set; }
        public int TotalShares { get; set; }
        public bool IsUnit { get; set; }
    }

    internal class CompanyEngagementStat
    {
        public string CompanyName { get; set; } = "";
        public int Likes { get; set; }
        public int Comments { get; set; }
        public int Shares { get; set; }
        public int CompletedTicks { get; set; }
        public int TotalExpectedTicks { get; set; }
        public double Rate => TotalExpectedTicks > 0 ? Math.Round((double)CompletedTicks / TotalExpectedTicks * 100, 1) : 0;
    }

    internal class PlatformEngagementStat
    {
        public string PlatformName { get; set; } = "";
        public int Likes { get; set; }
        public int Comments { get; set; }
        public int Shares { get; set; }
        public int CompletedTicks { get; set; }
        public int TotalExpectedTicks { get; set; }
        public double Rate => TotalExpectedTicks > 0 ? Math.Round((double)CompletedTicks / TotalExpectedTicks * 100, 1) : 0;
    }

    internal class ColumnInfo
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

    internal class CompanyGroup
    {
        public string CompanyID { get; set; } = "";
        public string Name { get; set; } = "";
        public int Span { get; set; }
    }

    internal class PlatformGroup
    {
        public string PostID { get; set; } = "";
        public string PlatformName { get; set; } = "";
        public string PostLink { get; set; } = "";
        public int Span { get; set; }
    }

    internal class StaffRowData
    {
        public string StaffName { get; set; } = "";
        public string Department { get; set; } = "";
        public string Position { get; set; } = "";
        public int Likes { get; set; }
        public int Comments { get; set; }
        public int Shares { get; set; }
        public List<bool> EngagementValues { get; set; } = new();  // Per column (like/comment/share)
        public string? Reason { get; set; }  // Reason for missing engagements
        // Tick stats for consistent sorting (matches TickHelper / StaffRankingHelper logic)
        public int CompletedTicks { get; set; }
        public int TotalTicks { get; set; }
        public double CompletionRate => TotalTicks > 0 ? Math.Round((double)CompletedTicks / TotalTicks * 100, 1) : 0;
    }

    internal static ReportData BuildReportData(MonitoringSession? session, List<Engagement> engagements)
    {
        var data = new ReportData
        {
            SessionDate = session != null ? session.SessionDate : DateOnly.FromDateTime(DateTime.Now),
            IsUnit = session == null
        };

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

        // Build action columns — all platforms have Like + Comment + Share
        foreach (var post in uniquePosts)
        {
            var platform = post.Platform?.PlatformName?.ToLower() ?? "";
            var icon = platform == "instagram" ? "❤️" : "👍";

            foreach (var (action, label) in new[] { ("like", "Like"), ("comment", "Comment"), ("share", "Share") })
            {
                var actionIcon = action == "like" ? icon
                              : action == "comment" ? "💬"
                              : "🔁";

                data.ActionColumns.Add(new ColumnInfo
                {
                    PostID = post.PostID.ToString(),
                    PlatformName = post.Platform?.PlatformName ?? "Unknown",
                    CompanyID = post.Company?.CompanyID.ToString() ?? "",
                    CompanyName = post.Company?.CompanyName ?? "No Company",
                    Action = action,
                    ActionLabel = label,
                    ActionIcon = actionIcon,
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
            var firstEng = group.First();
            var row = new StaffRowData
            {
                StaffName = group.Key.FullName ?? "Unknown",
                Department = group.Key.Department ?? "N/A",
                Position = firstEng.Staff?.Position ?? "-",
                Likes = group.Count(e => e.IsLiked),
                Comments = group.Count(e => e.IsCommented),
                Shares = group.Count(e => e.IsShared)
            };

            // Get the reason (take the first non-null reason from the staff's engagements)
            row.Reason = group.FirstOrDefault(e => !string.IsNullOrEmpty(e.Reason))?.Reason;

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

                // Count totals (for session summary cards)
                if (value)
                {
                    if (col.Action == "like") data.TotalLikes++;
                    else if (col.Action == "comment") data.TotalComments++;
                    else if (col.Action == "share") data.TotalShares++;
                }
            }

            // Calculate tick stats using TickHelper-equivalent logic (per engagement, not per column)
            // This matches StaffRankingHelper / Dashboard / Reports ranking exactly:
            //   Facebook: Like+Comment = 2 expected; Instagram: Like+Comment = 2; TikTok: Comment = 1
            foreach (var eng in group)
            {
                var platformName = eng.Post?.Platform?.PlatformName ?? "";
                row.CompletedTicks += socihr_backend.Helpers.TickHelper.Ticked(platformName, eng.IsLiked, eng.IsCommented, eng.IsShared);
                row.TotalTicks += socihr_backend.Helpers.TickHelper.Expected(platformName);
            }

            // Bug fix: add the row to the list (was missing — staff rows were never added before)
            data.StaffRows.Add(row);
        }

        // Sort by Department (asc) → within each department: completion rate desc → completed ticks desc → name asc
        // Grouping by department allows PDF to inject divider rows between units cleanly.
        data.StaffRows = data.StaffRows
            .OrderBy(r => r.Department)
            .ThenByDescending(r => r.CompletionRate)
            .ThenByDescending(r => r.CompletedTicks)
            .ThenByDescending(r => r.TotalTicks)
            .ThenBy(r => r.StaffName)
            .ToList();

        // Build company stats breakdown with Likes, Comments, Shares
        data.CompanyStats = engagements
            .Where(e => e.Post?.Company != null)
            .GroupBy(e => e.Post!.Company!.CompanyName)
            .Select(g => new CompanyEngagementStat
            {
                CompanyName = g.Key,
                Likes = g.Count(e => e.IsLiked),
                Comments = g.Count(e => e.IsCommented),
                Shares = g.Count(e => e.IsShared),
                CompletedTicks = g.Sum(e => socihr_backend.Helpers.TickHelper.Ticked(e.Post!.Platform!.PlatformName, e.IsLiked, e.IsCommented, e.IsShared)),
                TotalExpectedTicks = g.Sum(e => socihr_backend.Helpers.TickHelper.Expected(e.Post!.Platform!.PlatformName))
            })
            .OrderBy(c => c.CompanyName)
            .ToList();

        // Build platform stats breakdown with Likes, Comments, Shares
        data.PlatformStats = engagements
            .Where(e => e.Post?.Platform != null)
            .GroupBy(e => e.Post!.Platform!.PlatformName)
            .Select(g => new PlatformEngagementStat
            {
                PlatformName = g.Key,
                Likes = g.Count(e => e.IsLiked),
                Comments = g.Count(e => e.IsCommented),
                Shares = g.Count(e => e.IsShared),
                CompletedTicks = g.Sum(e => socihr_backend.Helpers.TickHelper.Ticked(e.Post!.Platform!.PlatformName, e.IsLiked, e.IsCommented, e.IsShared)),
                TotalExpectedTicks = g.Sum(e => socihr_backend.Helpers.TickHelper.Expected(e.Post!.Platform!.PlatformName))
            })
            .OrderBy(p => p.PlatformName)
            .ToList();

        return data;
    }

    private byte[] GeneratePdfDocument(ReportData data)
    {
        var document = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A3.Landscape());
                page.Margin(16);
                page.PageColor(Colors.White);

                page.Header().PaddingBottom(10).Row(row =>
                {
                    row.RelativeItem().Column(c =>
                    {
                        c.Item().Text("MONITORING SESSION ENGAGEMENT REPORT").FontSize(16).Bold().FontColor("#1e1b4b");
                        c.Item().PaddingTop(2).Text($"System crafted by @syaakiirr").FontSize(8).FontColor("#94a3b8");
                    });
                    row.ConstantItem(320).AlignRight().Background("#eff6ff").Border(1.5f).BorderColor("#3b82f6").Padding(6).Column(c =>
                    {
                        c.Item().Text("MONITORING SESSION DATE").FontSize(8).Bold().FontColor("#1d4ed8").AlignCenter();
                        c.Item().PaddingTop(1).Text($"{data.SessionDate:dddd, dd MMMM yyyy}").FontSize(13).Bold().FontColor("#1e40af").AlignCenter();
                    });
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

                    // Company Engagement Breakdown Table
                    if (data.CompanyStats.Count > 0)
                    {
                        col.Item().PaddingBottom(12).Column(cc =>
                        {
                            cc.Item().Text("Company Engagement Breakdown").FontSize(9.5f).Bold().FontColor("#1e40af");
                            cc.Item().PaddingTop(3).Table(ct =>
                            {
                                ct.ColumnsDefinition(cd =>
                                {
                                    cd.RelativeColumn(3);  // Company
                                    cd.ConstantColumn(75); // Likes
                                    cd.ConstantColumn(75); // Comments
                                    cd.ConstantColumn(75); // Shares
                                    cd.ConstantColumn(85); // Completed
                                    cd.ConstantColumn(85); // Expected
                                    cd.ConstantColumn(70); // Rate
                                });

                                static IContainer HeaderCell(IContainer c) =>
                                    c.DefaultTextStyle(t => t.Bold().FontSize(7.5f).FontColor(Colors.White)).Background("#1e40af").Padding(3).AlignCenter();

                                ct.Header(h =>
                                {
                                    h.Cell().Element(HeaderCell).AlignLeft().Text("Company");
                                    h.Cell().Element(HeaderCell).Text("Likes 👍");
                                    h.Cell().Element(HeaderCell).Text("Comments 💬");
                                    h.Cell().Element(HeaderCell).Text("Shares 🔁");
                                    h.Cell().Element(HeaderCell).Text("Completed");
                                    h.Cell().Element(HeaderCell).Text("Expected");
                                    h.Cell().Element(HeaderCell).Text("Rate (%)");
                                });

                                for (int ci = 0; ci < data.CompanyStats.Count; ci++)
                                {
                                    var cs = data.CompanyStats[ci];
                                    var bg = ci % 2 == 1 ? "#f8fafc" : "#ffffff";

                                    static IContainer DataCell(IContainer c, string bgCol) =>
                                        c.Background(bgCol).BorderBottom(1).BorderColor("#cbd5e1").Padding(3).AlignCenter();

                                    ct.Cell().Element(c => DataCell(c, bg)).AlignLeft().Text(cs.CompanyName).Bold().FontSize(7.5f);
                                    ct.Cell().Element(c => DataCell(c, bg)).Text(cs.Likes.ToString()).FontColor("#2563eb").Bold().FontSize(7.5f);
                                    ct.Cell().Element(c => DataCell(c, bg)).Text(cs.Comments.ToString()).FontColor("#0284c7").Bold().FontSize(7.5f);
                                    ct.Cell().Element(c => DataCell(c, bg)).Text(cs.Shares.ToString()).FontColor("#059669").Bold().FontSize(7.5f);
                                    ct.Cell().Element(c => DataCell(c, bg)).Text(cs.CompletedTicks.ToString()).FontSize(7.5f);
                                    ct.Cell().Element(c => DataCell(c, bg)).Text(cs.TotalExpectedTicks.ToString()).FontSize(7.5f);
                                    var rateColor = cs.Rate >= 80 ? Colors.Green.Darken1 : cs.Rate >= 50 ? Colors.Orange.Darken2 : Colors.Red.Darken1;
                                    ct.Cell().Element(c => DataCell(c, bg)).Text($"{cs.Rate}%").FontColor(rateColor).Bold().FontSize(7.5f);
                                }
                            });
                        });
                    }

                    // Engagement Matrix - Single Table
                    col.Item().Table(table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            columns.ConstantColumn(18);   // Rank
                            columns.ConstantColumn(115);  // Staff Name

                            columns.ConstantColumn(65);   // Department
                            foreach (var _ in data.ActionColumns)
                            {
                                columns.RelativeColumn();
                            }

                            columns.ConstantColumn(50);   // Reason
                        });

                        // Headers
                        table.Header(header =>
                        {
                            static IContainer BaseHeader(IContainer container, string bg) =>
                                container.Background(bg).Border(1).BorderColor("#cbd5e1").Padding(4).AlignCenter().AlignMiddle();

                            // Column 1, 2, 3: Spanning 3 rows vertically
                            header.Cell().RowSpan(3).Element(c => BaseHeader(c, "#f1f5f9")).Text("#").FontSize(7.5f).Bold().FontColor("#475569");
                            header.Cell().RowSpan(3).Element(c => BaseHeader(c, "#f1f5f9")).Text("Staff Name").FontSize(7.5f).Bold().FontColor("#475569");
                            header.Cell().RowSpan(3).Element(c => BaseHeader(c, "#f1f5f9")).Text("Dept").FontSize(7.5f).Bold().FontColor("#475569");

                            foreach (var coGroup in data.CompanyGroups)
                            {
                                header.Cell().ColumnSpan((uint)coGroup.Span).Element(c => BaseHeader(c, "#dbeafe"))
                                    .Text(t => t.Span(coGroup.Name).FontSize(9f).Bold().FontColor("#1e40af"));
                            }
                            
                            header.Cell().RowSpan(3).Element(c => BaseHeader(c, "#fef3c7")).Text("Reason").FontSize(7.5f).Bold().FontColor("#92400e");

                            foreach (var platGroup in data.PlatformGroups)
                            {
                                var cell = header.Cell().ColumnSpan((uint)platGroup.Span).Element(c => BaseHeader(c, "#e0f2fe"));
                                if (!string.IsNullOrEmpty(platGroup.PostLink))
                                {
                                    cell.Hyperlink(platGroup.PostLink).Text(t => t.Span(platGroup.PlatformName).FontSize(8f).Bold().FontColor("#0369a1").Underline());
                                }
                                else
                                {
                                    cell.Text(t => t.Span(platGroup.PlatformName).FontSize(8f).Bold().FontColor("#0369a1"));
                                }
                            }

                            foreach (var col in data.ActionColumns)
                            {
                                header.Cell().Element(c => BaseHeader(c, "#f0fdf4"))
                                    .Text(t => t.Span(col.ActionLabel).FontSize(6.5f).Bold().FontColor("#15803d").WrapAnywhere());
                            }
                        });

                        // Data Rows — grouped by Department with divider sub-heading rows
                        int rowNum = 1;
                        string lastDept = "";
                        // totalCols = rank + name + dept + N action cols + reason
                        uint totalCols1 = (uint)(3 + data.ActionColumns.Count + 1);

                        static IContainer DataCell(IContainer container, string bg) =>
                            container.Background(bg).Border(1).BorderColor("#cbd5e1").Padding(4).AlignMiddle();
                        static IContainer ActionCell(IContainer container, string bg) =>
                            container.Background(bg).Border(1).BorderColor("#cbd5e1").Padding(2).AlignMiddle();

                        foreach (var staffRow in data.StaffRows)
                        {
                            // Inject department divider row when department changes
                            if (staffRow.Department != lastDept)
                            {
                                lastDept = staffRow.Department;
                                table.Cell().ColumnSpan(totalCols1)
                                    .Background("#e0e7ff").BorderBottom(1).BorderColor("#6366f1")
                                    .Padding(4).AlignMiddle()
                                    .Text(t =>
                                    {
                                        t.Span("▸  ").FontSize(7.5f).Bold().FontColor("#4338ca");
                                        t.Span(staffRow.Department.ToUpperInvariant()).FontSize(7.5f).Bold().FontColor("#3730a3");
                                    });
                            }

                            var bgColor = rowNum % 2 == 0 ? "#f8fafc" : "#ffffff";

                            // Rank
                            table.Cell().Element(c => DataCell(c, bgColor)).AlignCenter().Text(rowNum.ToString()).FontSize(7).FontColor("#64748b");
                            table.Cell().Element(c => DataCell(c, bgColor)).Text(t => t.Span(staffRow.StaffName).FontSize(7).Bold().FontColor("#1e293b"));
                            table.Cell().Element(c => DataCell(c, bgColor)).Text(t => t.Span(staffRow.Department).FontSize(7).FontColor("#475569"));

                            for (int i = 0; i < staffRow.EngagementValues.Count; i++)
                            {
                                var value = staffRow.EngagementValues[i];
                                var cell = table.Cell().Element(c => ActionCell(c, bgColor)).AlignCenter();
                                if (value)
                                {
                                    cell.AlignCenter().AlignMiddle()
                                        .Width(9).Height(9)
                                        .Background("#10b981")
                                        .Border(1).BorderColor("#059669")
                                        .Padding(1.5f)
                                        .Svg("""<svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>""");
                                }
                                else
                                {
                                    cell.Text("");
                                }
                            }

                            table.Cell().Element(c => DataCell(c, bgColor)).Text(t => t.Span(staffRow.Reason ?? "").FontSize(6).FontColor("#475569"));
                            rowNum++;
                        }
                    });
                });

                page.Footer().Column(f =>
                {
                    f.Item().AlignCenter().Text("@syaakiirr").FontSize(7).FontColor("#94a3b8");
                    f.Item().AlignCenter().Text(t =>
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
        });

        return document.GeneratePdf();
    }

    private byte[] GenerateMultiPdfDocument(List<MonitoringSession> sessions, List<Engagement> engagements)
    {
        int totalLikes = 0, totalComments = 0, totalShares = 0;
        foreach (var eng in engagements)
        {
            if (eng.IsLiked) totalLikes++;
            if (eng.IsCommented) totalComments++;
            if (eng.IsShared) totalShares++;
        }

        var accentColors = new[] { "#1e40af", "#059669", "#d97706", "#7c3aed", "#dc2626" };

        return Document.Create(container =>
        {
            for (int sIdx = 0; sIdx < sessions.Count; sIdx++)
            {
                var session = sessions[sIdx];
                var accent = accentColors[sIdx % accentColors.Length];

                container.Page(page =>
                {
                    page.Size(PageSizes.A3.Landscape());
                    page.Margin(16);

                    page.Header().Column(h =>
                    {
                        h.Item().Background(accent).Padding(8).Row(row =>
                        {
                            row.RelativeItem().Column(c =>
                            {
                                c.Item().Text($"MONITORING SESSION {sIdx + 1} OF {sessions.Count}").FontSize(10).Bold().FontColor("#e0e7ff");
                                c.Item().Text("COMBINED MONITORING REPORT").FontSize(15).Bold().FontColor("#ffffff");
                            });
                            row.ConstantItem(320).AlignRight().Column(c =>
                            {
                                c.Item().Text("MONITORING SESSION DATE").FontSize(8).Bold().FontColor("#e0e7ff");
                                c.Item().Text($"{session.SessionDate:dddd, dd MMMM yyyy}").FontSize(13).Bold().FontColor("#ffffff");
                            });
                        });
                        h.Item().PaddingTop(2).Row(row =>
                        {
                            row.RelativeItem().Text("System crafted by @syaakiirr").FontSize(7.5f).FontColor("#9ca3af");
                        });
                    });

                    var sessionEngagements = engagements.Where(e => e.SessionID == session.SessionID).ToList();
                    var reportData = BuildReportData(session, sessionEngagements);

                    page.Content().Column(col =>
                    {
                        // Summary Totals cards
                        col.Item().PaddingBottom(12).Row(row =>
                        {
                            row.RelativeItem().Element(c => Card(c, "Total Likes", reportData.TotalLikes.ToString(), "#3b82f6"));
                            row.ConstantItem(12);
                            row.RelativeItem().Element(c => Card(c, "Total Comments", reportData.TotalComments.ToString(), "#0ea5e9"));
                            row.ConstantItem(12);
                            row.RelativeItem().Element(c => Card(c, "Total Shares", reportData.TotalShares.ToString(), "#10b981"));
                        });

                        // Company Engagement Breakdown Table
                        if (reportData.CompanyStats.Count > 0)
                        {
                            col.Item().PaddingBottom(12).Column(cc =>
                            {
                                cc.Item().Text("Company Engagement Breakdown").FontSize(9.5f).Bold().FontColor("#1e40af");
                                cc.Item().PaddingTop(3).Table(ct =>
                                {
                                    ct.ColumnsDefinition(cd =>
                                    {
                                        cd.RelativeColumn(3);  // Company
                                        cd.ConstantColumn(75); // Likes
                                        cd.ConstantColumn(75); // Comments
                                        cd.ConstantColumn(75); // Shares
                                        cd.ConstantColumn(85); // Completed
                                        cd.ConstantColumn(85); // Expected
                                        cd.ConstantColumn(70); // Rate
                                    });

                                    static IContainer HeaderCell(IContainer c) =>
                                        c.DefaultTextStyle(t => t.Bold().FontSize(7.5f).FontColor(Colors.White)).Background("#1e40af").Padding(3).AlignCenter();

                                    ct.Header(h =>
                                    {
                                        h.Cell().Element(HeaderCell).AlignLeft().Text("Company");
                                        h.Cell().Element(HeaderCell).Text("Likes 👍");
                                        h.Cell().Element(HeaderCell).Text("Comments 💬");
                                        h.Cell().Element(HeaderCell).Text("Shares 🔁");
                                        h.Cell().Element(HeaderCell).Text("Completed");
                                        h.Cell().Element(HeaderCell).Text("Expected");
                                        h.Cell().Element(HeaderCell).Text("Rate (%)");
                                    });

                                    for (int ci = 0; ci < reportData.CompanyStats.Count; ci++)
                                    {
                                        var cs = reportData.CompanyStats[ci];
                                        var bg = ci % 2 == 1 ? "#f8fafc" : "#ffffff";

                                        static IContainer DataCell(IContainer c, string bgCol) =>
                                            c.Background(bgCol).BorderBottom(1).BorderColor("#cbd5e1").Padding(3).AlignCenter();

                                        ct.Cell().Element(c => DataCell(c, bg)).AlignLeft().Text(cs.CompanyName).Bold().FontSize(7.5f);
                                        ct.Cell().Element(c => DataCell(c, bg)).Text(cs.Likes.ToString()).FontColor("#2563eb").Bold().FontSize(7.5f);
                                        ct.Cell().Element(c => DataCell(c, bg)).Text(cs.Comments.ToString()).FontColor("#0284c7").Bold().FontSize(7.5f);
                                        ct.Cell().Element(c => DataCell(c, bg)).Text(cs.Shares.ToString()).FontColor("#059669").Bold().FontSize(7.5f);
                                        ct.Cell().Element(c => DataCell(c, bg)).Text(cs.CompletedTicks.ToString()).FontSize(7.5f);
                                        ct.Cell().Element(c => DataCell(c, bg)).Text(cs.TotalExpectedTicks.ToString()).FontSize(7.5f);
                                        var rateColor = cs.Rate >= 80 ? Colors.Green.Darken1 : cs.Rate >= 50 ? Colors.Orange.Darken2 : Colors.Red.Darken1;
                                        ct.Cell().Element(c => DataCell(c, bg)).Text($"{cs.Rate}%").FontColor(rateColor).Bold().FontSize(7.5f);
                                    }
                                });
                            });
                        }

                        col.Item().Table(table =>
                        {
                            table.ColumnsDefinition(columns =>
                            {
                                columns.ConstantColumn(18);   // Rank
                                columns.ConstantColumn(115);  // Staff Name

                                columns.ConstantColumn(65);   // Department
                                foreach (var _ in reportData.ActionColumns)
                                    columns.RelativeColumn();

                                columns.ConstantColumn(50);   // Reason
                            });

                            table.Header(header =>
                            {
                                static IContainer BaseHeader(IContainer container, string bg) =>
                                    container.Background(bg).Border(1).BorderColor("#cbd5e1").Padding(4).AlignCenter().AlignMiddle();

                                header.Cell().RowSpan(3).Element(c => BaseHeader(c, "#f1f5f9")).Text("#").FontSize(7.5f).Bold().FontColor("#475569");
                                header.Cell().RowSpan(3).Element(c => BaseHeader(c, "#f1f5f9")).Text("Staff Name").FontSize(7.5f).Bold().FontColor("#475569");
                                header.Cell().RowSpan(3).Element(c => BaseHeader(c, "#f1f5f9")).Text("Dept").FontSize(7.5f).Bold().FontColor("#475569");

                                foreach (var coGroup in reportData.CompanyGroups)
                                {
                                    header.Cell().ColumnSpan((uint)coGroup.Span).Element(c => BaseHeader(c, "#dbeafe"))
                                        .Text(t => t.Span(coGroup.Name).FontSize(9f).Bold().FontColor("#1e40af"));
                                }

                                header.Cell().RowSpan(3).Element(c => BaseHeader(c, "#fef3c7")).Text("Reason").FontSize(7.5f).Bold().FontColor("#92400e");

                                foreach (var platGroup in reportData.PlatformGroups)
                                {
                                    var cell = header.Cell().ColumnSpan((uint)platGroup.Span).Element(c => BaseHeader(c, "#e0f2fe"));
                                    if (!string.IsNullOrEmpty(platGroup.PostLink))
                                        cell.Hyperlink(platGroup.PostLink).Text(t => t.Span(platGroup.PlatformName).FontSize(8f).Bold().FontColor("#0369a1").Underline());
                                    else
                                        cell.Text(t => t.Span(platGroup.PlatformName).FontSize(8f).Bold().FontColor("#0369a1"));
                                }

                                foreach (var ac in reportData.ActionColumns)
                                {
                                    header.Cell().Element(c => BaseHeader(c, "#f0fdf4"))
                                        .Text(t => t.Span(ac.ActionLabel).FontSize(6.5f).Bold().FontColor("#15803d").WrapAnywhere());
                                }
                            });

                            int rowNum = 1;
                            string lastDeptM = "";
                            uint totalColsM = (uint)(3 + reportData.ActionColumns.Count + 1);

                            static IContainer DataCell(IContainer container, string bg) =>
                                container.Background(bg).Border(1).BorderColor("#cbd5e1").Padding(4).AlignMiddle();
                            static IContainer ActionCell(IContainer container, string bg) =>
                                container.Background(bg).Border(1).BorderColor("#cbd5e1").Padding(2).AlignMiddle();

                            foreach (var staffRow in reportData.StaffRows)
                            {
                                if (staffRow.Department != lastDeptM)
                                {
                                    lastDeptM = staffRow.Department;
                                    table.Cell().ColumnSpan(totalColsM)
                                        .Background("#e0e7ff").BorderBottom(1).BorderColor("#6366f1")
                                        .Padding(4).AlignMiddle()
                                        .Text(t =>
                                        {
                                            t.Span("▸  ").FontSize(7.5f).Bold().FontColor("#4338ca");
                                            t.Span(staffRow.Department.ToUpperInvariant()).FontSize(7.5f).Bold().FontColor("#3730a3");
                                        });
                                }

                                var bgColor = rowNum % 2 == 0 ? "#f8fafc" : "#ffffff";

                                table.Cell().Element(c => DataCell(c, bgColor)).AlignCenter().Text(rowNum.ToString()).FontSize(7).FontColor("#64748b");
                                table.Cell().Element(c => DataCell(c, bgColor)).Text(t => t.Span(staffRow.StaffName).FontSize(7).Bold().FontColor("#1e293b"));
                                table.Cell().Element(c => DataCell(c, bgColor)).Text(t => t.Span(staffRow.Department).FontSize(7).FontColor("#475569"));

                                for (int i = 0; i < staffRow.EngagementValues.Count; i++)
                                {
                                    var value = staffRow.EngagementValues[i];
                                    var cell = table.Cell().Element(c => ActionCell(c, bgColor)).AlignCenter();
                                    if (value)
                                    {
                                        cell.AlignCenter().AlignMiddle()
                                            .Width(9).Height(9)
                                            .Background("#10b981")
                                            .Border(1).BorderColor("#059669")
                                            .Padding(1.5f)
                                            .Svg("""<svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>""");
                                    }
                                    else
                                    {
                                        cell.Text("");
                                    }
                                }

                                table.Cell().Element(c => DataCell(c, bgColor)).Text(t => t.Span(staffRow.Reason ?? "").FontSize(6).FontColor("#475569"));
                                rowNum++;
                            }
                        });
                    });

                    page.Footer().Column(f =>
                    {
                        f.Item().AlignCenter().Text("@syaakiirr").FontSize(7).FontColor("#94a3b8");
                        f.Item().AlignCenter().Text(t =>
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
            }
        }).GeneratePdf();
    }

    private async Task<byte[]> GenerateCustomReportPdf(List<MonitoringSession> sessions, List<Engagement> engagements, CustomReportRequest req)
    {
        var accentColors = new[] { "#1e40af", "#059669", "#d97706", "#7c3aed", "#dc2626" };
        var dateLabel = "";
        if (req.DateFrom.HasValue || req.DateTo.HasValue)
            dateLabel = $"Period: {req.DateFrom:dd MMM yyyy} - {req.DateTo:dd MMM yyyy}";

        // Load ranking data if needed
        List<StaffRankingHelper.StaffRankingDto>? top10 = null;
        List<StaffRankingHelper.StaffRankingDto>? bottom10 = null;
        List<StaffRankingHelper.StaffRankingDto>? allStaff = null;
        if (req.IncludeStaffRanking || req.IncludePerformanceStaff)
        {
            var allRanked = await StaffRankingHelper.GetRanking(_db, "top", null,
                req.DateFrom, req.DateTo);
            top10 = allRanked.Take(10).ToList();
            bottom10 = allRanked.OrderBy(r => r.CompletionRate).ThenBy(r => r.Completed).Take(10).ToList();
            if (req.IncludePerformanceStaff)
                allStaff = allRanked;
        }

        return Document.Create(container =>
        {
            for (int sIdx = 0; sIdx < sessions.Count; sIdx++)
            {
                var session = sessions[sIdx];
                var accent = accentColors[sIdx % accentColors.Length];
                var sessionEngagements = engagements.Where(e => e.SessionID == session.SessionID).ToList();
                var reportData = BuildReportData(session, sessionEngagements);

                container.Page(page =>
                {
                    page.Size(PageSizes.A3.Landscape());
                    page.Margin(16);

                    page.Header().Column(h =>
                    {
                        h.Item().Background(accent).Padding(8).Row(row =>
                        {
                            row.RelativeItem().Column(c =>
                            {
                                c.Item().Text($"MONITORING SESSION {sIdx + 1} OF {sessions.Count}").FontSize(10).Bold().FontColor("#e0e7ff");
                                c.Item().Text("CUSTOM MODULAR MONITORING REPORT").FontSize(15).Bold().FontColor("#ffffff");
                            });
                            row.ConstantItem(320).AlignRight().Column(c =>
                            {
                                c.Item().Text("MONITORING SESSION DATE").FontSize(8).Bold().FontColor("#e0e7ff");
                                c.Item().Text($"{session.SessionDate:dddd, dd MMMM yyyy}").FontSize(13).Bold().FontColor("#ffffff");
                            });
                        });
                        h.Item().PaddingTop(2).Row(row =>
                        {
                            row.RelativeItem().Text(string.IsNullOrEmpty(dateLabel) ? "System crafted by @syaakiirr" : $"Date Range: {dateLabel}  •  System crafted by @syaakiirr").FontSize(7.5f).FontColor("#9ca3af");
                        });
                    });

                    page.Content().Column(col =>
                    {
                        if (req.IncludeSummaryCards)
                        {
                            col.Item().PaddingBottom(12).Row(row =>
                            {
                                row.RelativeItem().Element(c => Card(c, "Total Likes", reportData.TotalLikes.ToString(), "#3b82f6"));
                                row.ConstantItem(12);
                                row.RelativeItem().Element(c => Card(c, "Total Comments", reportData.TotalComments.ToString(), "#0ea5e9"));
                                row.ConstantItem(12);
                                row.RelativeItem().Element(c => Card(c, "Total Shares", reportData.TotalShares.ToString(), "#10b981"));
                            });

                            if (reportData.CompanyStats.Count > 0)
                            {
                                col.Item().PaddingBottom(12).Column(cc =>
                                {
                                    cc.Item().Text("Company Engagement Breakdown").FontSize(9.5f).Bold().FontColor("#1e40af");
                                    cc.Item().PaddingTop(3).Table(ct =>
                                    {
                                        ct.ColumnsDefinition(cd =>
                                        {
                                            cd.RelativeColumn(3);  // Company
                                            cd.ConstantColumn(75); // Likes
                                            cd.ConstantColumn(75); // Comments
                                            cd.ConstantColumn(75); // Shares
                                            cd.ConstantColumn(85); // Completed
                                            cd.ConstantColumn(85); // Expected
                                            cd.ConstantColumn(70); // Rate
                                        });

                                        static IContainer HeaderCell(IContainer c) =>
                                            c.DefaultTextStyle(t => t.Bold().FontSize(7.5f).FontColor(Colors.White)).Background("#1e40af").Padding(3).AlignCenter();

                                        ct.Header(h =>
                                        {
                                            h.Cell().Element(HeaderCell).AlignLeft().Text("Company");
                                            h.Cell().Element(HeaderCell).Text("Likes 👍");
                                            h.Cell().Element(HeaderCell).Text("Comments 💬");
                                            h.Cell().Element(HeaderCell).Text("Shares 🔁");
                                            h.Cell().Element(HeaderCell).Text("Completed");
                                            h.Cell().Element(HeaderCell).Text("Expected");
                                            h.Cell().Element(HeaderCell).Text("Rate (%)");
                                        });

                                        for (int ci = 0; ci < reportData.CompanyStats.Count; ci++)
                                        {
                                            var cs = reportData.CompanyStats[ci];
                                            var bg = ci % 2 == 1 ? "#f8fafc" : "#ffffff";

                                            static IContainer DataCell(IContainer c, string bgCol) =>
                                                c.Background(bgCol).BorderBottom(1).BorderColor("#cbd5e1").Padding(3).AlignCenter();

                                            ct.Cell().Element(c => DataCell(c, bg)).AlignLeft().Text(cs.CompanyName).Bold().FontSize(7.5f);
                                            ct.Cell().Element(c => DataCell(c, bg)).Text(cs.Likes.ToString()).FontColor("#2563eb").Bold().FontSize(7.5f);
                                            ct.Cell().Element(c => DataCell(c, bg)).Text(cs.Comments.ToString()).FontColor("#0284c7").Bold().FontSize(7.5f);
                                            ct.Cell().Element(c => DataCell(c, bg)).Text(cs.Shares.ToString()).FontColor("#059669").Bold().FontSize(7.5f);
                                            ct.Cell().Element(c => DataCell(c, bg)).Text(cs.CompletedTicks.ToString()).FontSize(7.5f);
                                            ct.Cell().Element(c => DataCell(c, bg)).Text(cs.TotalExpectedTicks.ToString()).FontSize(7.5f);
                                            var rateColor = cs.Rate >= 80 ? Colors.Green.Darken1 : cs.Rate >= 50 ? Colors.Orange.Darken2 : Colors.Red.Darken1;
                                            ct.Cell().Element(c => DataCell(c, bg)).Text($"{cs.Rate}%").FontColor(rateColor).Bold().FontSize(7.5f);
                                        }
                                    });
                                });
                            }
                        }

                        if (req.IncludeMonitoringTable && reportData.StaffRows.Count > 0)
                        {
                            col.Item().Table(table =>
                            {
                                table.ColumnsDefinition(columns =>
                                {
                                    columns.ConstantColumn(18);
                                    columns.ConstantColumn(115);
                                    columns.ConstantColumn(req.IncludeStaffPosition ? 55 : 65);

                                    foreach (var _ in reportData.ActionColumns)
                                        columns.RelativeColumn();

                                    if (req.IncludeReasonColumn)
                                        columns.ConstantColumn(50);
                                });

                                table.Header(header =>
                                {
                                    static IContainer BaseHeader(IContainer container, string bg) =>
                                        container.Background(bg).Border(1).BorderColor("#cbd5e1").Padding(4).AlignCenter().AlignMiddle();

                                    uint headerRowSpan = (uint)(req.IncludeReasonColumn ? 3 : 2);

                                    header.Cell().RowSpan(headerRowSpan).Element(c => BaseHeader(c, "#f1f5f9")).Text("#").FontSize(7.5f).Bold().FontColor("#475569");
                                    header.Cell().RowSpan(headerRowSpan).Element(c => BaseHeader(c, "#f1f5f9")).Text("Staff Name").FontSize(7.5f).Bold().FontColor("#475569");
                                    header.Cell().RowSpan(headerRowSpan).Element(c => BaseHeader(c, "#f1f5f9")).Text(req.IncludeStaffPosition ? "Position" : "Dept").FontSize(7.5f).Bold().FontColor("#475569");

                                    foreach (var coGroup in reportData.CompanyGroups)
                                    {
                                        header.Cell().ColumnSpan((uint)coGroup.Span).Element(c => BaseHeader(c, "#dbeafe"))
                                            .Text(t => t.Span(coGroup.Name).FontSize(9f).Bold().FontColor("#1e40af"));
                                    }

                                    if (req.IncludeReasonColumn)
                                        header.Cell().RowSpan(headerRowSpan).Element(c => BaseHeader(c, "#fef3c7")).Text("Reason").FontSize(7.5f).Bold().FontColor("#92400e");

                                    foreach (var platGroup in reportData.PlatformGroups)
                                    {
                                        var cell = header.Cell().ColumnSpan((uint)platGroup.Span).Element(c => BaseHeader(c, "#e0f2fe"));
                                        if (!string.IsNullOrEmpty(platGroup.PostLink))
                                            cell.Hyperlink(platGroup.PostLink).Text(t => t.Span(platGroup.PlatformName).FontSize(8f).Bold().FontColor("#0369a1").Underline());
                                        else
                                            cell.Text(t => t.Span(platGroup.PlatformName).FontSize(8f).Bold().FontColor("#0369a1"));
                                    }

                                    foreach (var ac in reportData.ActionColumns)
                                    {
                                        header.Cell().Element(c => BaseHeader(c, "#f0fdf4"))
                                            .Text(t => t.Span(ac.ActionLabel).FontSize(6.5f).Bold().FontColor("#15803d"));
                                    }
                                });

                                int rowNum = 1;
                                string lastDeptC = "";
                                // totalCols = rank + name + dept + N action cols + (reason col if enabled)
                                uint totalColsC = (uint)(3 + reportData.ActionColumns.Count + (req.IncludeReasonColumn ? 1 : 0));

                                static IContainer DataCell(IContainer container, string bg) =>
                                    container.Background(bg).Border(1).BorderColor("#cbd5e1").Padding(4).AlignMiddle();
                                static IContainer ActionCell(IContainer container, string bg) =>
                                    container.Background(bg).Border(1).BorderColor("#cbd5e1").Padding(2).AlignMiddle();

                                foreach (var staffRow in reportData.StaffRows)
                                {
                                    if (staffRow.Department != lastDeptC)
                                    {
                                        lastDeptC = staffRow.Department;
                                        table.Cell().ColumnSpan(totalColsC)
                                            .Background("#e0e7ff").BorderBottom(1).BorderColor("#6366f1")
                                            .Padding(4).AlignMiddle()
                                            .Text(t =>
                                            {
                                                t.Span("▸  ").FontSize(7.5f).Bold().FontColor("#4338ca");
                                                t.Span(staffRow.Department.ToUpperInvariant()).FontSize(7.5f).Bold().FontColor("#3730a3");
                                            });
                                    }

                                    var bgColor = rowNum % 2 == 0 ? "#f8fafc" : "#ffffff";

                                    table.Cell().Element(c => DataCell(c, bgColor)).AlignCenter().Text(rowNum.ToString()).FontSize(7).FontColor("#64748b");
                                    table.Cell().Element(c => DataCell(c, bgColor)).Text(t => t.Span(staffRow.StaffName).FontSize(7).Bold().FontColor("#1e293b"));
                                    table.Cell().Element(c => DataCell(c, bgColor)).Text(t => t.Span(staffRow.Department).FontSize(7).FontColor("#475569"));

                                    for (int i = 0; i < staffRow.EngagementValues.Count; i++)
                                    {
                                        var value = staffRow.EngagementValues[i];
                                        var cell = table.Cell().Element(c => ActionCell(c, bgColor)).AlignCenter();
                                        if (value)
                                        {
                                            cell.AlignCenter().AlignMiddle()
                                                .Width(9).Height(9)
                                                .Background("#10b981")
                                                .Border(1).BorderColor("#059669")
                                                .Padding(1.5f)
                                                .Svg("""<svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>""");
                                        }
                                        else
                                        {
                                            cell.Text("");
                                        }
                                    }

                                    if (req.IncludeReasonColumn)
                                        table.Cell().Element(c => DataCell(c, bgColor)).Text(t => t.Span(staffRow.Reason ?? "").FontSize(6).FontColor("#475569"));

                                    rowNum++;
                                }
                            });
                        }
                    });

                    page.Footer().Column(f =>
                    {
                        f.Item().AlignCenter().Text("@syaakiirr").FontSize(7).FontColor("#94a3b8");
                        f.Item().AlignCenter().Text(t =>
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
            }

            // Staff Ranking pages
            if (req.IncludeStaffRanking && top10 != null && bottom10 != null)
            {
                container.Page(page =>
                {
                    page.Size(PageSizes.A3.Landscape());
                    page.Margin(16);

                    page.Header().Column(h =>
                    {
                        h.Item().Background("#1e40af").Padding(6).Row(row =>
                        {
                            row.RelativeItem().Text("STAFF RANKING").FontSize(11).Bold().FontColor("#ffffff");
                            if (!string.IsNullOrEmpty(dateLabel))
                                row.RelativeItem().AlignRight().Text(dateLabel).FontSize(11).Bold().FontColor("#ffffff");
                        });
                        h.Item().PaddingTop(4).Text("Top 10 Performers & Underperformers").FontSize(16).Bold().FontColor("#1e40af");
                    });

                    page.Content().Column(col =>
                    {
                        col.Item().PaddingBottom(16).Text("Top 10 Performers").FontSize(13).Bold().FontColor("#059669");
                        col.Item().Table(table =>
                        {
                            table.ColumnsDefinition(c =>
                            {
                                c.ConstantColumn(25); c.RelativeColumn(3); c.RelativeColumn(2); c.ConstantColumn(50);
                            });
                            table.Header(h =>
                            {
                                h.Cell().Background("#059669").Padding(4).Text("#").FontSize(8).Bold().FontColor("#ffffff");
                                h.Cell().Background("#059669").Padding(4).Text("Name").FontSize(8).Bold().FontColor("#ffffff");
                                h.Cell().Background("#059669").Padding(4).Text("Dept").FontSize(8).Bold().FontColor("#ffffff");
                                h.Cell().Background("#059669").Padding(4).AlignRight().Text("Rate").FontSize(8).Bold().FontColor("#ffffff");
                            });
                            foreach (var (s, i) in top10.Select((s, i) => (s, i)))
                            {
                                var bg = i % 2 == 0 ? "#f0fdf4" : "#ffffff";
                                table.Cell().Background(bg).Padding(3).Text((i + 1).ToString()).FontSize(7);
                                table.Cell().Background(bg).Padding(3).Text(s.FullName).FontSize(7).Bold();
                                table.Cell().Background(bg).Padding(3).Text(s.Department ?? "-").FontSize(7);
                                table.Cell().Background(bg).Padding(3).AlignRight().Text($"{s.CompletionRate}%").FontSize(7).Bold().FontColor("#059669");
                            }
                        });

                        col.Item().PaddingTop(16).PaddingBottom(16).Text("Bottom 10 Underperformers").FontSize(13).Bold().FontColor("#dc2626");
                        col.Item().Table(table =>
                        {
                            table.ColumnsDefinition(c =>
                            {
                                c.ConstantColumn(25); c.RelativeColumn(3); c.RelativeColumn(2); c.ConstantColumn(50);
                            });
                            table.Header(h =>
                            {
                                h.Cell().Background("#dc2626").Padding(4).Text("#").FontSize(8).Bold().FontColor("#ffffff");
                                h.Cell().Background("#dc2626").Padding(4).Text("Name").FontSize(8).Bold().FontColor("#ffffff");
                                h.Cell().Background("#dc2626").Padding(4).Text("Dept").FontSize(8).Bold().FontColor("#ffffff");
                                h.Cell().Background("#dc2626").Padding(4).AlignRight().Text("Rate").FontSize(8).Bold().FontColor("#ffffff");
                            });
                            foreach (var (s, i) in bottom10.Select((s, i) => (s, i)))
                            {
                                var bg = i % 2 == 0 ? "#fef2f2" : "#ffffff";
                                table.Cell().Background(bg).Padding(3).Text((i + 1).ToString()).FontSize(7);
                                table.Cell().Background(bg).Padding(3).Text(s.FullName).FontSize(7).Bold();
                                table.Cell().Background(bg).Padding(3).Text(s.Department ?? "-").FontSize(7);
                                table.Cell().Background(bg).Padding(3).AlignRight().Text($"{s.CompletionRate}%").FontSize(7).Bold().FontColor("#dc2626");
                            }
                        });

                        if (req.IncludePerformanceStaff && allStaff != null)
                        {
                            col.Item().PaddingTop(24).Text("All Staff Performance").FontSize(13).Bold().FontColor("#1e40af");
                            col.Item().Table(table =>
                            {
                                table.ColumnsDefinition(c =>
                                {
                                    c.ConstantColumn(25); c.RelativeColumn(2.5f); c.RelativeColumn(1.5f); c.ConstantColumn(50); c.ConstantColumn(50);
                                });
                                table.Header(h =>
                                {
                                    h.Cell().Background("#1e40af").Padding(4).Text("#").FontSize(8).Bold().FontColor("#ffffff");
                                    h.Cell().Background("#1e40af").Padding(4).Text("Name").FontSize(8).Bold().FontColor("#ffffff");
                                    h.Cell().Background("#1e40af").Padding(4).Text("Dept").FontSize(8).Bold().FontColor("#ffffff");
                                    h.Cell().Background("#1e40af").Padding(4).AlignRight().Text("Done").FontSize(8).Bold().FontColor("#ffffff");
                                    h.Cell().Background("#1e40af").Padding(4).AlignRight().Text("Rate").FontSize(8).Bold().FontColor("#ffffff");
                                });
                                foreach (var (s, i) in allStaff.Select((s, i) => (s, i)))
                                {
                                    var bg = i % 2 == 0 ? "#f8fafc" : "#ffffff";
                                    var rateColor = s.CompletionRate >= 80 ? "#059669" : s.CompletionRate >= 50 ? "#d97706" : "#dc2626";
                                    table.Cell().Background(bg).Padding(3).Text((i + 1).ToString()).FontSize(7);
                                    table.Cell().Background(bg).Padding(3).Text(s.FullName).FontSize(7).Bold();
                                    table.Cell().Background(bg).Padding(3).Text(s.Department ?? "-").FontSize(7);
                                    table.Cell().Background(bg).Padding(3).AlignRight().Text(s.Completed.ToString()).FontSize(7);
                                    table.Cell().Background(bg).Padding(3).AlignRight().Text($"{s.CompletionRate}%").FontSize(7).Bold().FontColor(rateColor);
                                }
                            });
                        }
                    });

                    page.Footer().Column(f =>
                    {
                        f.Item().AlignCenter().Text(t =>
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
            }
        }).GeneratePdf();
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
public record AddStaffToSessionRequest(List<Guid> StaffIds);
public record UpdateSessionRequest(DateOnly SessionDate, List<Guid>? CompanyIDs, List<Guid>? PlatformIDs);
public record MultiSessionReportRequest(List<Guid> SessionIDs);
public record CustomReportRequest(
    List<Guid> SessionIDs,
    DateTime? DateFrom,
    DateTime? DateTo,
    bool IncludeSummaryCards = true,
    bool IncludeMonitoringTable = true,
    bool IncludeReasonColumn = true,
    bool IncludeStaffPosition = true,
    bool IncludeStaffRanking = true,
    bool IncludePerformanceStaff = true,
    List<Guid>? SelectedCompanyIDs = null,
    List<Guid>? SelectedPlatformIDs = null
);

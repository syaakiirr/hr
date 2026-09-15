using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using socihr_backend.Data;
using socihr_backend.Helpers;
using socihr_backend.Models;
using System.Security.Claims;

namespace socihr_backend.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class StaffController : ControllerBase
{
    private readonly AppDbContext _db;

    public StaffController(AppDbContext db) => _db = db;

    // Helper: get the DepartmentID for DeptAdmin, null for SuperAdmin
    private Guid? GetDeptIdRestriction()
    {
        if (User.IsInRole("DeptAdmin"))
        {
            var claim = User.FindFirst("DepartmentID")?.Value;
            return claim != null ? Guid.Parse(claim) : null;
        }
        return null;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? search, [FromQuery] string? department, [FromQuery] string? status, [FromQuery] bool includeArchived = false)
    {
        var query = _db.Staff.AsQueryable();
        
        // Filter archived by default
        if (!includeArchived)
            query = query.Where(s => !s.IsArchived);
        
        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(s => s.FullName.ToLower().Contains(search.ToLower()));
        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(s => s.Status == status);

        // DeptAdmin: force filter to own department
        if (User.IsInRole("DeptAdmin"))
        {
            var deptId = GetDeptIdRestriction();
            if (deptId.HasValue)
            {
                var deptName = await _db.Departments
                    .Where(d => d.DepartmentID == deptId)
                    .Select(d => d.DepartmentName)
                    .FirstOrDefaultAsync();
                if (deptName != null)
                    query = query.Where(s => s.Department == deptName);
            }
        }
        else if (!string.IsNullOrWhiteSpace(department))
        {
            query = query.Where(s => s.Department == department);
        }

        var staff = await query
            .OrderBy(s => s.Department ?? string.Empty)
            .ThenBy(s => s.FullName ?? string.Empty)
            .ToListAsync();
        return Ok(staff);
    }

    [HttpGet("paged")]
    public async Task<IActionResult> GetPaged(
        [FromQuery] string? search,
        [FromQuery] string? department,
        [FromQuery] string? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] bool includeArchived = false)
    {
        var query = _db.Staff.AsQueryable();
        
        if (!includeArchived)
            query = query.Where(s => !s.IsArchived);
        
        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(s => s.FullName.ToLower().Contains(search.ToLower()));
        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(s => s.Status == status);

        if (User.IsInRole("DeptAdmin"))
        {
            var deptId = GetDeptIdRestriction();
            if (deptId.HasValue)
            {
                var deptName = await _db.Departments
                    .Where(d => d.DepartmentID == deptId)
                    .Select(d => d.DepartmentName)
                    .FirstOrDefaultAsync();
                if (deptName != null)
                    query = query.Where(s => s.Department == deptName);
            }
        }
        else if (!string.IsNullOrWhiteSpace(department))
        {
            query = query.Where(s => s.Department == department);
        }

        var total = await query.CountAsync();
        var totalPages = (int)Math.Ceiling((double)total / pageSize);
        var items = await query
            .OrderBy(s => s.Department ?? string.Empty)
            .ThenBy(s => s.FullName ?? string.Empty)
            .Skip((Math.Max(1, page) - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return Ok(new
        {
            total,
            page = Math.Max(1, page),
            pageSize,
            totalPages = Math.Max(1, totalPages),
            items
        });
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var staff = await _db.Staff.FindAsync(id);
        if (staff == null) return NotFound(new { message = "Staff not found." });

        // DeptAdmin: can only see own department staff
        if (User.IsInRole("DeptAdmin"))
        {
            var deptId = GetDeptIdRestriction();
            if (deptId.HasValue)
            {
                var deptName = await _db.Departments
                    .Where(d => d.DepartmentID == deptId)
                    .Select(d => d.DepartmentName)
                    .FirstOrDefaultAsync();
                if (staff.Department != deptName)
                    return Forbid();
            }
        }

        return Ok(staff);
    }

    // GET /api/staff/{id}/performance?from&to — agregat engagement per session
    // untuk satu staff (diguna halaman profil staff: carta + jadual per-session)
    [HttpGet("{id:guid}/performance")]
    public async Task<IActionResult> GetPerformance(Guid id, [FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var staff = await _db.Staff.FindAsync(id);
        if (staff == null)
            return NotFound(new { message = "Staff not found." });

        // DeptAdmin: can only see own department staff
        if (User.IsInRole("DeptAdmin"))
        {
            var deptId = GetDeptIdRestriction();
            if (deptId.HasValue)
            {
                var deptName = await _db.Departments
                    .Where(d => d.DepartmentID == deptId)
                    .Select(d => d.DepartmentName)
                    .FirstOrDefaultAsync();
                if (staff.Department != deptName)
                    return Forbid();
            }
        }

        var sessionsQ = _db.MonitoringSessions.AsNoTracking().Where(s => !s.IsArchived);
        if (from.HasValue)
        {
            var fd = DateOnly.FromDateTime(from.Value);
            sessionsQ = sessionsQ.Where(s => s.SessionDate >= fd);
        }
        if (to.HasValue)
        {
            var td = DateOnly.FromDateTime(to.Value);
            sessionsQ = sessionsQ.Where(s => s.SessionDate <= td);
        }
        var sessions = await sessionsQ.OrderBy(s => s.SessionDate).ToListAsync();
        var sessionIds = sessions.Select(s => s.SessionID).ToList();

        var agg = await _db.Engagements
            .AsNoTracking()
            .Where(e => sessionIds.Contains(e.SessionID) && e.StaffID == id)
            .GroupBy(e => e.SessionID)
            .Select(g => new
            {
                SessionID = g.Key,
                Likes = g.Count(e => e.IsLiked),
                Comments = g.Count(e => e.IsCommented),
                Shares = g.Count(e => e.IsShared),
                Completed = g.Sum(e => (e.IsLiked ? 1 : 0) + (e.IsCommented ? 1 : 0) + (e.IsShared ? 1 : 0)),
                Total = g.Count() * 3
            })
            .ToListAsync();
        var map = agg.ToDictionary(a => a.SessionID);

        // Hanya session yang ada engagement staff ini (elak noise kosong)
        var result = sessions
            .Where(s => map.ContainsKey(s.SessionID))
            .Select(s =>
            {
                var a = map[s.SessionID];
                var rate = a.Total > 0 ? Math.Round((double)a.Completed / a.Total * 100, 1) : 0;
                return new
                {
                    sessionId = s.SessionID,
                    date = s.SessionDate.ToString("yyyy-MM-dd"),
                    label = s.SessionDate.ToString("dd MMM"),
                    likes = a.Likes,
                    comments = a.Comments,
                    shares = a.Shares,
                    completed = a.Completed,
                    missed = a.Total - a.Completed,
                    total = a.Total,
                    rate
                };
            })
            .ToList();

        return Ok(new
        {
            staff = new { staff.StaffID, staff.FullName, staff.Department, staff.Position, staff.StaffType, staff.Status },
            sessions = result
        });
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] StaffRequest req)
    {
        // DeptAdmin: force department to their own department
        if (User.IsInRole("DeptAdmin"))
        {
            var deptId = GetDeptIdRestriction();
            if (deptId.HasValue)
            {
                var deptName = await _db.Departments
                    .Where(d => d.DepartmentID == deptId)
                    .Select(d => d.DepartmentName)
                    .FirstOrDefaultAsync();
                req = req with { Department = deptName };
            }
        }

        return await CreateStaffInternal(req);
    }

    private async Task<IActionResult> CreateStaffInternal(StaffRequest req)
    {
        await EnsureDepartmentExistsAsync(req.Department);
        var validTypes = new[] { "Permanent", "Intern" };
        var staffType = validTypes.Contains(req.StaffType) ? req.StaffType : "Permanent";
        var staff = new Staff
        {
            StaffID = Guid.NewGuid(),
            FullName = req.FullName,
            Department = req.Department,
            Position = req.Position,
            StaffType = staffType,
            Status = "Active",
            CreatedAt = DateTime.UtcNow
        };
        _db.Staff.Add(staff);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { id = staff.StaffID }, staff);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] StaffRequest req)
    {
        var staff = await _db.Staff.FindAsync(id);
        if (staff == null) return NotFound(new { message = "Staff not found." });

        // DeptAdmin: can only edit staff in their own department
        if (User.IsInRole("DeptAdmin"))
        {
            var deptId = GetDeptIdRestriction();
            if (deptId.HasValue)
            {
                var deptName = await _db.Departments
                    .Where(d => d.DepartmentID == deptId)
                    .Select(d => d.DepartmentName)
                    .FirstOrDefaultAsync();
                if (staff.Department != deptName)
                    return Forbid();
                // Force department — DeptAdmin cannot move staff to another dept
                req = req with { Department = deptName };
            }
        }
        else
        {
            await EnsureDepartmentExistsAsync(req.Department);
        }

        var validTypes = new[] { "Permanent", "Intern" };
        staff.FullName = req.FullName;
        staff.Department = req.Department;
        staff.Position = req.Position;
        staff.StaffType = validTypes.Contains(req.StaffType) ? req.StaffType : staff.StaffType;
        await _db.SaveChangesAsync();
        return Ok(staff);
    }

    // DELETE — SuperAdmin only
    [Authorize(Roles = "SuperAdmin")]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        try
        {
            var staff = await _db.Staff.FindAsync(id);
            if (staff == null) return NotFound(new { message = "Staff not found." });

            var engagementIds = await _db.Engagements
                .Where(e => e.StaffID == id)
                .Select(e => e.EngagementID)
                .ToListAsync();

            var audits = await _db.AuditTrails
                .Where(a => engagementIds.Contains(a.EngagementID))
                .ToListAsync();
            _db.AuditTrails.RemoveRange(audits);

            var engagements = await _db.Engagements
                .Where(e => e.StaffID == id)
                .ToListAsync();
            _db.Engagements.RemoveRange(engagements);

            _db.Staff.Remove(staff);

            var actorId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            var actorName = User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value ?? "";
            Helpers.SecurityAuditLog.Write(_db, HttpContext,
                actorId != null ? Guid.Parse(actorId) : Guid.Empty, actorName,
                "staff.deleted", $"{staff.FullName} (+{engagements.Count} engagements)");
            await _db.SaveChangesAsync();

            return NoContent();
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [HttpPatch("{id:guid}/toggle-status")]
    public async Task<IActionResult> ToggleStatus(Guid id)
    {
        var staff = await _db.Staff.FindAsync(id);
        if (staff == null) return NotFound(new { message = "Staff not found." });

        // DeptAdmin: can only toggle status of own department staff
        if (User.IsInRole("DeptAdmin"))
        {
            var deptId = GetDeptIdRestriction();
            if (deptId.HasValue)
            {
                var deptName = await _db.Departments
                    .Where(d => d.DepartmentID == deptId)
                    .Select(d => d.DepartmentName)
                    .FirstOrDefaultAsync();
                if (staff.Department != deptName)
                    return Forbid();
            }
        }

        staff.Status = staff.Status == "Active" ? "Inactive" : "Active";
        await _db.SaveChangesAsync();
        return Ok(staff);
    }

    // GET /api/staff/engagement-stats
    [HttpGet("engagement-stats")]
    public async Task<IActionResult> GetEngagementStats([FromQuery] string? search, [FromQuery] string? department, [FromQuery] string? status, [FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var staffQuery = _db.Staff.AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
            staffQuery = staffQuery.Where(s => s.FullName.ToLower().Contains(search.ToLower()));
        if (!string.IsNullOrWhiteSpace(status))
            staffQuery = staffQuery.Where(s => s.Status == status);
        staffQuery = staffQuery.Where(s => !s.IsArchived);

        // DeptAdmin: force filter to own department
        if (User.IsInRole("DeptAdmin"))
        {
            var deptId = GetDeptIdRestriction();
            if (deptId.HasValue)
            {
                var deptName = await _db.Departments
                    .Where(d => d.DepartmentID == deptId)
                    .Select(d => d.DepartmentName)
                    .FirstOrDefaultAsync();
                if (deptName != null)
                    staffQuery = staffQuery.Where(s => s.Department == deptName);
            }
        }
        else if (!string.IsNullOrWhiteSpace(department))
        {
            staffQuery = staffQuery.Where(s => s.Department == department);
        }

        var staffList = await staffQuery.ToListAsync();
        
        var staffIds = staffList.Select(s => s.StaffID).ToList();
        var allEngagementsQuery = _db.Engagements
            .Include(e => e.Post).ThenInclude(p => p!.Platform)
            .Where(e => staffIds.Contains(e.StaffID))
            .Where(e => !e.Session!.IsArchived);
        if (from.HasValue)
        {
            var fd = DateOnly.FromDateTime(from.Value);
            allEngagementsQuery = allEngagementsQuery.Where(e => e.Session != null && e.Session.SessionDate >= fd);
        }
        if (to.HasValue)
        {
            var td = DateOnly.FromDateTime(to.Value);
            allEngagementsQuery = allEngagementsQuery.Where(e => e.Session != null && e.Session.SessionDate <= td);
        }
        var allEngagements = await allEngagementsQuery.ToListAsync();

        var stats = staffList
            .Select(s =>
            {
                var staffEngs = allEngagements.Where(e => e.StaffID == s.StaffID).ToList();
                var totalCompleted = staffEngs.Sum(e => TickHelper.Ticked(e.Post!.Platform!.PlatformName, e.IsLiked, e.IsCommented, e.IsShared));
                var totalExpected = staffEngs.Sum(e => TickHelper.Expected(e.Post!.Platform!.PlatformName));
                var totalMissed = totalExpected - totalCompleted;
                var totalPosts = staffEngs.Select(e => e.PostID).Distinct().Count();
                var rawRate = totalExpected > 0 ? (double)totalCompleted / totalExpected * 100 : 0;
                var completionRate = Math.Round(rawRate, 1);
                var rankRate = Math.Round(rawRate);
                
                return new
                {
                    s.StaffID,
                    s.FullName,
                    s.Department,
                    s.Position,
                    s.Status,
                    TotalPosts = totalPosts,
                    TotalEngagements = totalExpected,
                    TotalCompleted = totalCompleted,
                    TotalMissed = totalMissed,
                    CompletionRate = completionRate,
                    RankRate = rankRate
                };
            })
            .OrderByDescending(s => s.RankRate)
            .ThenByDescending(s => s.TotalCompleted)
            .ThenByDescending(s => s.TotalEngagements)
            .ThenBy(s => s.FullName)
            .Select(s => new
            {
                s.StaffID,
                s.FullName,
                s.Department,
                s.Position,
                s.Status,
                s.TotalPosts,
                s.TotalEngagements,
                s.TotalCompleted,
                s.TotalMissed,
                s.CompletionRate
            })
            .ToList();

        return Ok(stats);
    }

    // ═══════════════════════════════════════════════════════════════
    // ARCHIVE ENDPOINTS — SuperAdmin only
    // ═══════════════════════════════════════════════════════════════

    [Authorize(Roles = "SuperAdmin")]
    [HttpPost("{id:guid}/archive")]
    public async Task<IActionResult> ArchiveStaff(Guid id)
    {
        try
        {
            var staff = await _db.Staff.FindAsync(id);
            if (staff == null)
                return NotFound(new { message = "Staff not found." });

            var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            var userId = userIdClaim != null && Guid.TryParse(userIdClaim, out var _parsedUserId) ? _parsedUserId : Guid.Empty;

            staff.IsArchived = true;
            staff.ArchivedBy = userId;
            staff.ArchivedAt = DateTime.UtcNow;
            staff.Status = "Archived";

            var archiverName = User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value ?? "";
            Helpers.SecurityAuditLog.Write(_db, HttpContext, userId, archiverName,
                "staff.archived", staff.FullName);
            await _db.SaveChangesAsync();

            return Ok(new { message = "Staff archived successfully." });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [Authorize(Roles = "SuperAdmin")]
    [HttpPost("{id:guid}/restore")]
    public async Task<IActionResult> RestoreStaff(Guid id)
    {
        try
        {
            var staff = await _db.Staff.FindAsync(id);
            if (staff == null)
                return NotFound(new { message = "Staff not found." });

            staff.IsArchived = false;
            staff.ArchivedBy = null;
            staff.ArchivedAt = null;
            staff.Status = "Active";

            var restorerIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            var restorerId = restorerIdClaim != null && Guid.TryParse(restorerIdClaim, out var _rid) ? _rid : Guid.Empty;
            var restorerName = User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value ?? "";
            Helpers.SecurityAuditLog.Write(_db, HttpContext, restorerId, restorerName,
                "staff.restored", staff.FullName);
            await _db.SaveChangesAsync();

            return Ok(new { message = "Staff restored successfully." });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [Authorize(Roles = "SuperAdmin")]
    [HttpGet("archived")]
    public async Task<IActionResult> GetArchivedStaff()
    {
        try
        {
            var archived = await _db.Staff
                .Where(s => s.IsArchived)
                .OrderByDescending(s => s.ArchivedAt)
                .ToListAsync();

            return Ok(archived);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    private async Task EnsureDepartmentExistsAsync(string? departmentName)
    {
        if (string.IsNullOrWhiteSpace(departmentName))
            return;

        var trimmedName = departmentName.Trim();
        var exists = await _db.Departments
            .AnyAsync(d => d.DepartmentName.ToLower() == trimmedName.ToLower());

        if (exists)
            return;

        _db.Departments.Add(new Department
        {
            DepartmentID = Guid.NewGuid(),
            DepartmentName = trimmedName,
            CreatedAt = DateTime.UtcNow
        });
    }
}

public record StaffRequest(string FullName, string? Department, string? Position, string StaffType = "Permanent");


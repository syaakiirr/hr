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


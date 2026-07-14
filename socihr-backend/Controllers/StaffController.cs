using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using socihr_backend.Data;
using socihr_backend.Helpers;
using socihr_backend.Models;

namespace socihr_backend.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class StaffController : ControllerBase
{
    private readonly AppDbContext _db;

    public StaffController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? search, [FromQuery] string? department, [FromQuery] string? status, [FromQuery] bool includeArchived = false)
    {
        var query = _db.Staff.AsQueryable();
        
        // Filter archived by default
        if (!includeArchived)
            query = query.Where(s => !s.IsArchived);
        
        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(s => s.FullName.ToLower().Contains(search.ToLower()));
        if (!string.IsNullOrWhiteSpace(department))
            query = query.Where(s => s.Department == department);
        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(s => s.Status == status);
        // Order by Department A→Z, then FullName A→Z so each department's staff are grouped and
        // alphabetically ordered within the department (no interleaving across departments).
        var staff = await query
            .OrderBy(s => s.Department ?? string.Empty)
            .ThenBy(s => s.FullName ?? string.Empty)
            .ToListAsync();
        return Ok(staff);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var staff = await _db.Staff.FindAsync(id);
        if (staff == null) return NotFound(new { message = "Staff not found." });
        return Ok(staff);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] StaffRequest req)
    {
        await EnsureDepartmentExistsAsync(req.Department);

        var staff = new Staff
        {
            StaffID = Guid.NewGuid(),
            FullName = req.FullName,
            Department = req.Department,
            Position = req.Position,
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

        await EnsureDepartmentExistsAsync(req.Department);

        staff.FullName = req.FullName;
        staff.Department = req.Department;
        staff.Position = req.Position;
        await _db.SaveChangesAsync();
        return Ok(staff);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        try
        {
            var staff = await _db.Staff.FindAsync(id);
            if (staff == null) return NotFound(new { message = "Staff not found." });

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
        staff.Status = staff.Status == "Active" ? "Inactive" : "Active";
        await _db.SaveChangesAsync();
        return Ok(staff);
    }

    // GET /api/staff/engagement-stats
    [HttpGet("engagement-stats")]
    public async Task<IActionResult> GetEngagementStats([FromQuery] string? search, [FromQuery] string? department, [FromQuery] string? status)
    {
        var staffQuery = _db.Staff.AsQueryable();
        
        if (!string.IsNullOrWhiteSpace(search))
            staffQuery = staffQuery.Where(s => s.FullName.ToLower().Contains(search.ToLower()));
        if (!string.IsNullOrWhiteSpace(department))
            staffQuery = staffQuery.Where(s => s.Department == department);
        if (!string.IsNullOrWhiteSpace(status))
            staffQuery = staffQuery.Where(s => s.Status == status);

        var staffList = await staffQuery.ToListAsync();
        
        // Get all relevant engagements with necessary includes
        var staffIds = staffList.Select(s => s.StaffID).ToList();
        var allEngagements = await _db.Engagements
            .Include(e => e.Post).ThenInclude(p => p!.Platform)
            .Where(e => staffIds.Contains(e.StaffID))
            .ToListAsync();

        var stats = staffList
            .Select(s =>
            {
                var staffEngs = allEngagements.Where(e => e.StaffID == s.StaffID).ToList();
                var totalCompleted = staffEngs.Sum(e => TickHelper.Ticked(e.Post!.Platform!.PlatformName, e.IsLiked, e.IsCommented, e.IsShared));
                var totalExpected = staffEngs.Sum(e => TickHelper.Expected(e.Post!.Platform!.PlatformName));
                var totalMissed = totalExpected - totalCompleted;
                var totalPosts = staffEngs.Select(e => e.PostID).Distinct().Count();
                var completionRate = totalExpected > 0 ? Math.Round((double)totalCompleted / totalExpected * 100, 1) : 0;
                
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
                    CompletionRate = completionRate
                };
            })
            .OrderByDescending(s => s.TotalCompleted)
            .ToList();

        return Ok(stats);
    }

    // ═══════════════════════════════════════════════════════════════
    // ARCHIVE ENDPOINTS
    // ═══════════════════════════════════════════════════════════════

    // POST /api/staff/{id}/archive
    [HttpPost("{id:guid}/archive")]
    public async Task<IActionResult> ArchiveStaff(Guid id)
    {
        try
        {
            var staff = await _db.Staff.FindAsync(id);
            if (staff == null)
                return NotFound(new { message = "Staff not found." });

            var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            var userId = userIdClaim != null ? Guid.Parse(userIdClaim) : Guid.Empty;

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

    // POST /api/staff/{id}/restore
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

    // GET /api/staff/archived
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

public record StaffRequest(string FullName, string? Department, string? Position);

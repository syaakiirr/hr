using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using socihr_backend.Data;
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
        var query = _db.Staff.Include(s => s.Company).AsQueryable();
        
        // Filter archived by default
        if (!includeArchived)
            query = query.Where(s => !s.IsArchived);
        
        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(s => s.FullName.ToLower().Contains(search.ToLower()));
        if (!string.IsNullOrWhiteSpace(department))
            query = query.Where(s => s.Department == department);
        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(s => s.Status == status);
        var staff = await query.OrderByDescending(s => s.CreatedAt).ToListAsync();
        return Ok(staff);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var staff = await _db.Staff.Include(s => s.Company).FirstOrDefaultAsync(s => s.StaffID == id);
        if (staff == null) return NotFound(new { message = "Staff tidak dijumpai." });
        return Ok(staff);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] StaffRequest req)
    {
        var staff = new Staff
        {
            StaffID = Guid.NewGuid(),
            FullName = req.FullName,
            Department = req.Department,
            Position = req.Position,
            CompanyID = req.CompanyID,
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
        if (staff == null) return NotFound(new { message = "Staff tidak dijumpai." });
        staff.FullName = req.FullName;
        staff.Department = req.Department;
        staff.Position = req.Position;
        staff.CompanyID = req.CompanyID;
        await _db.SaveChangesAsync();
        return Ok(staff);
    }

    [HttpPatch("{id:guid}/toggle-status")]
    public async Task<IActionResult> ToggleStatus(Guid id)
    {
        var staff = await _db.Staff.FindAsync(id);
        if (staff == null) return NotFound(new { message = "Staff tidak dijumpai." });
        staff.Status = staff.Status == "Active" ? "Inactive" : "Active";
        await _db.SaveChangesAsync();
        return Ok(staff);
    }

    // GET /api/staff/engagement-stats
    [HttpGet("engagement-stats")]
    public async Task<IActionResult> GetEngagementStats([FromQuery] string? search, [FromQuery] string? department, [FromQuery] string? status)
    {
        var query = _db.Staff.AsQueryable();
        
        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(s => s.FullName.ToLower().Contains(search.ToLower()));
        if (!string.IsNullOrWhiteSpace(department))
            query = query.Where(s => s.Department == department);
        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(s => s.Status == status);

        var stats = await query
            .Select(s => new
            {
                s.StaffID,
                s.FullName,
                s.Department,
                s.Position,
                s.Status,
                TotalEngagements = _db.Engagements.Count(e => e.StaffID == s.StaffID && (e.Status == "Completed" || e.Status == "Missed")),
                TotalCompleted = _db.Engagements.Count(e => e.StaffID == s.StaffID && e.Status == "Completed"),
                TotalMissed = _db.Engagements.Count(e => e.StaffID == s.StaffID && e.Status == "Missed"),
                CompletionRate = _db.Engagements.Count(e => e.StaffID == s.StaffID && (e.Status == "Completed" || e.Status == "Missed")) > 0
                    ? Math.Round((double)_db.Engagements.Count(e => e.StaffID == s.StaffID && e.Status == "Completed") 
                        / _db.Engagements.Count(e => e.StaffID == s.StaffID && (e.Status == "Completed" || e.Status == "Missed")) * 100, 1)
                    : 0
            })
            .OrderByDescending(s => s.TotalCompleted)
            .ToListAsync();

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
}

public record StaffRequest(string FullName, string? Department, string? Position, Guid? CompanyID);

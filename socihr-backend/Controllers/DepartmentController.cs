using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using socihr_backend.Data;

namespace socihr_backend.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class DepartmentController : ControllerBase
{
    private readonly AppDbContext _db;
    public DepartmentController(AppDbContext db) => _db = db;

    // GET /api/department
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var departments = await _db.Departments
            .OrderBy(d => d.DepartmentName)
            .Select(d => new
            {
                d.DepartmentID,
                d.DepartmentName
            })
            .ToListAsync();

        return Ok(departments);
    }

    // POST /api/department
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateDepartmentRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.DepartmentName))
            return BadRequest(new { message = "Department name cannot be empty." });

        var departmentName = req.DepartmentName.Trim();
        var exists = await _db.Departments
            .AnyAsync(d => d.DepartmentName.ToLower() == departmentName.ToLower());
        if (exists)
            return BadRequest(new { message = "Department already exists." });

        var department = new Models.Department
        {
            DepartmentID = Guid.NewGuid(),
            DepartmentName = departmentName,
            CreatedAt = DateTime.UtcNow
        };

        _db.Departments.Add(department);
        await _db.SaveChangesAsync();

        return Created($"/api/department/{department.DepartmentID}", new
        {
            department.DepartmentID,
            department.DepartmentName
        });
    }

    // DELETE /api/department/{id}
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        try
        {
            var department = await _db.Departments.FindAsync(id);
            if (department == null)
                return NotFound(new { message = "Department not found." });

            // Check if any staff still assigned to this department
            var inUse = await _db.Staff.AnyAsync(s => s.Department == department.DepartmentName);
            if (inUse)
                return BadRequest(new { message = "Cannot delete department — staff members are still assigned to it. Reassign them first." });

            _db.Departments.Remove(department);
            await _db.SaveChangesAsync();

            return NoContent();
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }
}

public record CreateDepartmentRequest(string DepartmentName);

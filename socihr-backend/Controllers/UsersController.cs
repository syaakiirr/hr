using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using socihr_backend.Data;
using socihr_backend.Models;

namespace socihr_backend.Controllers;

[Authorize(Roles = "SuperAdmin")]
[ApiController]
[Route("api/[controller]")]
public class UsersController : ControllerBase
{
    private readonly AppDbContext _db;
    public UsersController(AppDbContext db) => _db = db;

    // GET /api/users — list all users (excluding the SuperAdmin's own password hash)
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var users = await _db.Users
            .Include(u => u.Department)
            .OrderBy(u => u.Role)
            .ThenBy(u => u.Username)
            .Select(u => new
            {
                u.UserID,
                u.Username,
                u.Role,
                u.DepartmentID,
                DepartmentName = u.Department != null ? u.Department.DepartmentName : null
            })
            .ToListAsync();

        return Ok(users);
    }

    // POST /api/users — create a new DeptAdmin user
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateUserRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Username) || string.IsNullOrWhiteSpace(req.Password))
            return BadRequest(new { message = "Username and password are required." });

        var exists = await _db.Users.AnyAsync(u => u.Username == req.Username);
        if (exists)
            return Conflict(new { message = "Username already taken." });

        // Validate department for DeptAdmin
        if (req.Role == "DeptAdmin")
        {
            if (!req.DepartmentID.HasValue)
                return BadRequest(new { message = "DepartmentID is required for DeptAdmin role." });

            var deptExists = await _db.Departments.AnyAsync(d => d.DepartmentID == req.DepartmentID);
            if (!deptExists)
                return BadRequest(new { message = "Department not found." });
        }

        var user = new AppUser
        {
            UserID = Guid.NewGuid(),
            Username = req.Username.Trim(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password),
            Role = req.Role == "DeptAdmin" ? "DeptAdmin" : "SuperAdmin",
            DepartmentID = req.Role == "DeptAdmin" ? req.DepartmentID : null
        };

        await _db.Users.AddAsync(user);
        await _db.SaveChangesAsync();

        // Return with department name
        var dept = user.DepartmentID.HasValue
            ? await _db.Departments.FindAsync(user.DepartmentID)
            : null;

        return CreatedAtAction(nameof(GetAll), new
        {
            user.UserID,
            user.Username,
            user.Role,
            user.DepartmentID,
            DepartmentName = dept?.DepartmentName
        });
    }

    // PUT /api/users/{id} — update username / reset password / change department
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateUserRequest req)
    {
        var user = await _db.Users.Include(u => u.Department).FirstOrDefaultAsync(u => u.UserID == id);
        if (user == null) return NotFound(new { message = "User not found." });

        // Prevent editing own account via this endpoint
        var selfId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (selfId == id.ToString())
            return BadRequest(new { message = "Cannot edit your own account here. Use the profile settings." });

        // Check username uniqueness if changed
        if (!string.IsNullOrWhiteSpace(req.Username) && req.Username != user.Username)
        {
            var taken = await _db.Users.AnyAsync(u => u.Username == req.Username && u.UserID != id);
            if (taken) return Conflict(new { message = "Username already taken." });
            user.Username = req.Username.Trim();
        }

        // Reset password if provided
        if (!string.IsNullOrWhiteSpace(req.Password))
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password);

        // Update department (only relevant for DeptAdmin)
        if (user.Role == "DeptAdmin" && req.DepartmentID.HasValue)
        {
            var deptExists = await _db.Departments.AnyAsync(d => d.DepartmentID == req.DepartmentID);
            if (!deptExists) return BadRequest(new { message = "Department not found." });
            user.DepartmentID = req.DepartmentID;
        }

        await _db.SaveChangesAsync();

        var dept = user.DepartmentID.HasValue
            ? await _db.Departments.FindAsync(user.DepartmentID)
            : null;

        return Ok(new
        {
            user.UserID,
            user.Username,
            user.Role,
            user.DepartmentID,
            DepartmentName = dept?.DepartmentName
        });
    }

    // DELETE /api/users/{id}
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var user = await _db.Users.FindAsync(id);
        if (user == null) return NotFound(new { message = "User not found." });

        // Prevent self-deletion
        var selfId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (selfId == id.ToString())
            return BadRequest(new { message = "Cannot delete your own account." });

        _db.Users.Remove(user);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}

public record CreateUserRequest(string Username, string Password, string Role, Guid? DepartmentID);
public record UpdateUserRequest(string? Username, string? Password, Guid? DepartmentID);

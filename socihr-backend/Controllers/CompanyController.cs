using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using socihr_backend.Data;

namespace socihr_backend.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class CompanyController : ControllerBase
{
    private readonly AppDbContext _db;
    public CompanyController(AppDbContext db) => _db = db;

    // GET /api/company
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var companies = await _db.Companies
            .OrderBy(c => c.CompanyName)
            .Select(c => new
            {
                c.CompanyID,
                c.CompanyName
            })
            .ToListAsync();

        return Ok(companies);
    }

    // POST /api/company
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateCompanyRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.CompanyName))
            return BadRequest(new { message = "Company name cannot be empty." });

        var company = new Models.Company
        {
            CompanyID = Guid.NewGuid(),
            CompanyName = req.CompanyName.Trim(),
            CreatedAt = DateTime.UtcNow
        };

        _db.Companies.Add(company);
        await _db.SaveChangesAsync();

        return Created($"/api/company/{company.CompanyID}", new
        {
            company.CompanyID,
            company.CompanyName
        });
    }

    // DELETE /api/company/{id}
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        try
        {
            var company = await _db.Companies.FindAsync(id);
            if (company == null)
                return NotFound(new { message = "Company not found." });

            // Check if still referenced in session posts
            var inUse = await _db.SessionPosts.AnyAsync(p => p.CompanyID == id);
            if (inUse)
                return BadRequest(new { message = "Cannot delete company — it is still referenced in monitoring sessions. Remove it from all sessions first." });

            _db.Companies.Remove(company);
            await _db.SaveChangesAsync();

            return NoContent();
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }
}

public record CreateCompanyRequest(string CompanyName);

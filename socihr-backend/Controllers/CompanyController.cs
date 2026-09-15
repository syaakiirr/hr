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

    // GET /api/company/{id}/performance?from&to — agregat engagement per session
    // untuk satu company (diguna halaman profil company: carta + jadual per-session)
    [HttpGet("{id:guid}/performance")]
    public async Task<IActionResult> GetPerformance(Guid id, [FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var company = await _db.Companies.FindAsync(id);
        if (company == null)
            return NotFound(new { message = "Company not found." });

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
            .Where(e => sessionIds.Contains(e.SessionID) && e.Post!.CompanyID == id)
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

        // Hanya session yang ada engagement company ini (elak noise kosong)
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
            company = new { company.CompanyID, company.CompanyName },
            sessions = result
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

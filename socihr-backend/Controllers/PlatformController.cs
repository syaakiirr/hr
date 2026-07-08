using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using socihr_backend.Data;

namespace socihr_backend.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class PlatformController : ControllerBase
{
    private readonly AppDbContext _db;
    public PlatformController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var platforms = await _db.Platforms.OrderBy(p => p.PlatformName).ToListAsync();
        return Ok(platforms);
    }
}

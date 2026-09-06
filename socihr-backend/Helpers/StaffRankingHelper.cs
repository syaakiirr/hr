
using Microsoft.EntityFrameworkCore;
using socihr_backend.Data;

namespace socihr_backend.Helpers;

public class StaffRankingHelper
{
    public record StaffRankingDto(
        Guid StaffID,
        string FullName,
        string? Department,
        int Completed,
        int Total,
        double CompletionRate
    );

    public static async Task<List<StaffRankingDto>> GetRanking(
        AppDbContext db,
        string order,
        int? limit = null,
        DateTime? from = null,
        DateTime? to = null,
        string? deptName = null
    )
    {
        var query = db.Engagements
            .AsNoTracking()
            .Where(e => !e.Staff!.IsArchived && !e.Session!.IsArchived);

        // DeptAdmin: filter to own department only
        if (deptName != null)
            query = query.Where(e => e.Staff!.Department == deptName);

        if (from.HasValue)
        {
            var fromDate = DateOnly.FromDateTime(from.Value);
            query = query.Where(e => e.Session!.SessionDate >= fromDate);
        }
        if (to.HasValue)
        {
            var toDate = DateOnly.FromDateTime(to.Value);
            query = query.Where(e => e.Session!.SessionDate <= toDate);
        }

        // Aggregate entirely on the server — no client-side materialisation
        var aggregated = await query
            .GroupBy(e => new { e.StaffID, e.Staff!.FullName, e.Staff.Department })
            .Select(g => new StaffRankingDto(
                g.Key.StaffID,
                g.Key.FullName,
                g.Key.Department,
                g.Sum(e => (e.IsLiked ? 1 : 0) + (e.IsCommented ? 1 : 0) + (e.IsShared ? 1 : 0)),
                g.Count() * 3,
                g.Sum(e => (e.IsLiked ? 1 : 0) + (e.IsCommented ? 1 : 0) + (e.IsShared ? 1 : 0)) * 100.0 / (g.Count() * 3)
            ))
            .ToListAsync();

        // Round completion rates to integers
        for (int i = 0; i < aggregated.Count; i++)
            aggregated[i] = aggregated[i] with { CompletionRate = Math.Round(aggregated[i].CompletionRate) };

        // Apply ordering + limit in memory on the small result set
        var ranked = order == "bottom"
            ? aggregated.OrderBy(d => d.CompletionRate).ThenBy(d => d.Completed).ThenBy(d => d.Total).ThenBy(d => d.FullName)
            : aggregated.OrderByDescending(d => d.CompletionRate).ThenByDescending(d => d.Completed).ThenByDescending(d => d.Total).ThenBy(d => d.FullName);

        return limit.HasValue ? ranked.Take(limit.Value).ToList() : ranked.ToList();
    }

    // Multi-department variant: accepts a list of department names (null = all)
    public static async Task<List<StaffRankingDto>> GetRankingMultiDept(
        AppDbContext db,
        string order,
        int? limit = null,
        DateTime? from = null,
        DateTime? to = null,
        List<string>? deptFilter = null
    )
    {
        var query = db.Engagements
            .AsNoTracking()
            .Where(e => !e.Staff!.IsArchived && !e.Session!.IsArchived);

        if (deptFilter != null && deptFilter.Count > 0)
            query = query.Where(e => deptFilter.Contains(e.Staff!.Department));

        if (from.HasValue)
        {
            var fromDate = DateOnly.FromDateTime(from.Value);
            query = query.Where(e => e.Session!.SessionDate >= fromDate);
        }
        if (to.HasValue)
        {
            var toDate = DateOnly.FromDateTime(to.Value);
            query = query.Where(e => e.Session!.SessionDate <= toDate);
        }

        var aggregated = await query
            .GroupBy(e => new { e.StaffID, e.Staff!.FullName, e.Staff.Department })
            .Select(g => new StaffRankingDto(
                g.Key.StaffID,
                g.Key.FullName,
                g.Key.Department,
                g.Sum(e => (e.IsLiked ? 1 : 0) + (e.IsCommented ? 1 : 0) + (e.IsShared ? 1 : 0)),
                g.Count() * 3,
                g.Sum(e => (e.IsLiked ? 1 : 0) + (e.IsCommented ? 1 : 0) + (e.IsShared ? 1 : 0)) * 100.0 / (g.Count() * 3)
            ))
            .ToListAsync();

        for (int i = 0; i < aggregated.Count; i++)
            aggregated[i] = aggregated[i] with { CompletionRate = Math.Round(aggregated[i].CompletionRate) };

        var ranked = order == "bottom"
            ? aggregated.OrderBy(d => d.CompletionRate).ThenBy(d => d.Completed).ThenBy(d => d.Total).ThenBy(d => d.FullName)
            : aggregated.OrderByDescending(d => d.CompletionRate).ThenByDescending(d => d.Completed).ThenByDescending(d => d.Total).ThenBy(d => d.FullName);

        return limit.HasValue ? ranked.Take(limit.Value).ToList() : ranked.ToList();
    }
}


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
        DateTime? to = null
    )
    {
        // Get active staff only
        var activeStaffIds = await db.Staff
            .Where(s => !s.IsArchived)
            .Select(s => s.StaffID)
            .ToListAsync();

        var query = db.Engagements
            .Include(e => e.Staff)
            .Include(e => e.Post).ThenInclude(p => p!.Platform)
            .Where(e => activeStaffIds.Contains(e.StaffID)); // Filter to active staff only

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

        var engagements = await query.ToListAsync();

        var data = engagements
            .GroupBy(e => new { e.StaffID, e.Staff!.FullName, e.Staff.Department })
            .Select(g =>
            {
                var staffEngs = g.ToList();
                var completed = staffEngs.Sum(e => TickHelper.Ticked(e.Post!.Platform!.PlatformName, e.IsLiked, e.IsCommented, e.IsShared));
                var total = staffEngs.Sum(e => TickHelper.Expected(e.Post!.Platform!.PlatformName));
                var completionRate = total > 0 ? Math.Round((double)completed / total * 100, 1) : 0;
                return new StaffRankingDto(
                    g.Key.StaffID,
                    g.Key.FullName,
                    g.Key.Department,
                    completed,
                    total,
                    completionRate
                );
            })
            .ToList();

        // Apply ordering.
        // Tiebreak priority: CompletionRate -> Completed ticks -> Total ticks handled (workload) -> Name (stable fallback only).
        IOrderedEnumerable<StaffRankingDto> ordered = order == "bottom"
            ? data.OrderBy(d => d.CompletionRate).ThenBy(d => d.Completed).ThenBy(d => d.Total).ThenBy(d => d.FullName)
            : data.OrderByDescending(d => d.CompletionRate).ThenByDescending(d => d.Completed).ThenByDescending(d => d.Total).ThenBy(d => d.FullName);

        // Apply limit if specified
        return limit.HasValue ? ordered.Take(limit.Value).ToList() : ordered.ToList();
    }
}

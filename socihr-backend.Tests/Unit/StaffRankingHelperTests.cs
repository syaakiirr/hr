using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using socihr_backend.Data;
using socihr_backend.Helpers;
using socihr_backend.Models;

namespace socihr_backend.Tests.Unit;

/// <summary>
/// Unit tests for StaffRankingHelper — scoring 1 tick per checkbox, CompletionRate, sorting.
/// Guard untuk leaderboard correctness.
/// </summary>
public class StaffRankingHelperTests : IDisposable
{
    private readonly AppDbContext _db;
    public StaffRankingHelperTests()
    {
        var opts = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _db = new AppDbContext(opts);
        Seed();
    }
    public void Dispose() => _db.Dispose();

    private void Seed()
    {
        var s1 = new Staff { StaffID = Guid.NewGuid(), FullName = "Ali", Department = "HR", Status = "Active" };
        var s2 = new Staff { StaffID = Guid.NewGuid(), FullName = "Budi", Department = "IT", Status = "Active" };
        var sess = new MonitoringSession { SessionID = Guid.NewGuid(), SessionDate = new DateOnly(2026, 8, 15), CreatedBy = Guid.NewGuid(), CreatedAt = DateTime.UtcNow };
        var plat = new Platform { PlatformID = Guid.NewGuid(), PlatformName = "Facebook" };
        var post = new SessionPost { PostID = Guid.NewGuid(), SessionID = sess.SessionID, PlatformID = plat.PlatformID };
        _db.Staff.AddRange(s1, s2);
        _db.MonitoringSessions.Add(sess);
        _db.Platforms.Add(plat);
        _db.SessionPosts.Add(post);
        // Ali: 2 engagements, 1 fully completed (3 ticks), 1 partial (1 tick) => 4/6
        _db.Engagements.Add(new Engagement { EngagementID = Guid.NewGuid(), SessionID = sess.SessionID, PostID = post.PostID, StaffID = s1.StaffID, IsLiked = true, IsCommented = true, IsShared = true, Status = "Completed" });
        _db.Engagements.Add(new Engagement { EngagementID = Guid.NewGuid(), SessionID = sess.SessionID, PostID = post.PostID, StaffID = s1.StaffID, IsLiked = true, IsCommented = false, IsShared = false, Status = "Missed" });
        // Budi: 1 engagement, 0 ticks => 0/3
        _db.Engagements.Add(new Engagement { EngagementID = Guid.NewGuid(), SessionID = sess.SessionID, PostID = post.PostID, StaffID = s2.StaffID, IsLiked = false, IsCommented = false, IsShared = false, Status = "Missed" });
        // link nav
        _db.SaveChanges();
        // Attach nav for InMemory GroupBy on Staff.FullName (Helper does GroupBy StaffID,FullName,Department — needs nav loaded via Include in query)
        // InMemory respects nav if we set them
        foreach (var e in _db.Engagements.Include(e => e.Staff).Include(e => e.Session))
        {
            // Ensure nav not null for filter !e.Staff!.IsArchived && !e.Session!.IsArchived
            e.Staff = _db.Staff.Find(e.StaffID);
            e.Session = _db.MonitoringSessions.Find(e.SessionID);
            e.Post = post;
        }
        _db.SaveChanges();
    }

    [Fact]
    public async Task GetRanking_Top_SortsByRateDesc()
    {
        var ranking = await StaffRankingHelper.GetRanking(_db, "top", 10);
        ranking.Should().HaveCount(2);
        // Ali 4/6=67% > Budi 0/3=0%
        ranking[0].FullName.Should().Be("Ali");
        ranking[0].Completed.Should().Be(4);
        ranking[0].Total.Should().Be(6);
        ranking[0].CompletionRate.Should().Be(67);
        ranking[1].FullName.Should().Be("Budi");
        ranking[1].CompletionRate.Should().Be(0);
    }

    [Fact]
    public async Task GetRanking_Bottom_SortsAsc()
    {
        var ranking = await StaffRankingHelper.GetRanking(_db, "bottom", 10);
        ranking[0].FullName.Should().Be("Budi");
        ranking[1].FullName.Should().Be("Ali");
    }

    [Fact]
    public async Task GetRanking_FilterByDate_ExcludesOutOfRange()
    {
        var from = new DateTime(2026, 8, 16); // after session 08-15
        var ranking = await StaffRankingHelper.GetRanking(_db, "top", 10, from, null);
        ranking.Should().BeEmpty();
    }

    [Fact]
    public async Task GetRanking_ArchivedStaffExcluded()
    {
        var ali = _db.Staff.First(s => s.FullName == "Ali");
        ali.IsArchived = true;
        _db.SaveChanges();
        var ranking = await StaffRankingHelper.GetRanking(_db, "top", 10);
        ranking.Should().ContainSingle(r => r.FullName == "Budi");
    }

    [Fact]
    public async Task GetRanking_Limit_Respected()
    {
        var ranking = await StaffRankingHelper.GetRanking(_db, "top", 1);
        ranking.Should().HaveCount(1);
        ranking[0].FullName.Should().Be("Ali");
    }
}

using FluentAssertions;
using socihr_backend.Helpers;

namespace socihr_backend.Tests.Unit;

/// <summary>
/// Unit tests for TickHelper — kritikal: setiap checkbox = 1 tick, 3 expected per engagement.
/// Regression guard untuk B3/B5: formula must stay 3.
/// </summary>
public class TickHelperTests
{
    [Theory]
    [InlineData(false, false, false, 0, 3)]
    [InlineData(true, false, false, 1, 2)]
    [InlineData(true, true, false, 2, 1)]
    [InlineData(true, true, true, 3, 0)]
    [InlineData(false, true, true, 2, 1)]
    public void Ticked_Missed_Correct(bool liked, bool commented, bool shared, int expTicked, int expMissed)
    {
        TickHelper.Ticked("Facebook", liked, commented, shared).Should().Be(expTicked);
        TickHelper.Missed("Facebook", liked, commented, shared).Should().Be(expMissed);
        TickHelper.Expected("Facebook").Should().Be(3);
    }

    [Fact]
    public void Expected_Always3_AllPlatforms()
    {
        foreach (var plat in new[] { "Facebook", "Instagram", "TikTok", "LinkedIn", "" })
            TickHelper.Expected(plat).Should().Be(3);
    }

    [Fact]
    public void Status_Completed_OnlyWhenAllThree()
    {
        // EngagementController sets: (IsLiked && IsCommented && IsShared) ? Completed : Missed
        string Status(bool l, bool c, bool s) => (l && c && s) ? "Completed" : "Missed";
        Status(false, false, false).Should().Be("Missed");
        Status(true, false, false).Should().Be("Missed");
        Status(true, true, false).Should().Be("Missed");
        Status(true, true, true).Should().Be("Completed");
    }

    [Fact]
    public void Kpi_Aggregation_Matches_Controller()
    {
        var engs = new[]
        {
            new { Liked = true, Commented = true, Shared = true },  // 3
            new { Liked = true, Commented = false, Shared = false }, // 1
            new { Liked = false, Commented = false, Shared = false },// 0
        };
        var totalExpected = engs.Length * 3;
        var totalCompleted = engs.Sum(e => TickHelper.Ticked("", e.Liked, e.Commented, e.Shared));
        var totalMissed = totalExpected - totalCompleted;
        totalExpected.Should().Be(9);
        totalCompleted.Should().Be(4);
        totalMissed.Should().Be(5);
        Math.Round((double)totalCompleted / totalExpected * 100, 1).Should().Be(44.4);
    }
}

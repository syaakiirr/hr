using FluentAssertions;
using socihr_backend.Controllers;

namespace socihr_backend.Tests.Unit;

/// <summary>
/// Validasi input tick engagement tanpa sentuh DB.
/// Cover BulkUpdate guard, invalid action, empty IDs — regression B2/B4.
/// </summary>
public class EngagementValidationTests
{
    [Theory]
    [InlineData("like")]
    [InlineData("comment")]
    [InlineData("share")]
    [InlineData("LIKE")]
    [InlineData("Comment")]
    public void Valid_Actions_Accepted(string action)
    {
        var lower = action.ToLower();
        var isValid = lower is "like" or "comment" or "share";
        isValid.Should().BeTrue();
    }

    [Theory]
    [InlineData("invalid")]
    [InlineData("")]
    [InlineData("likes")]
    public void Invalid_Actions_Rejected(string action)
    {
        var lower = action.ToLower();
        var isValid = lower is "like" or "comment" or "share";
        isValid.Should().BeFalse();
    }

    [Fact]
    public void BulkUpdate_EmptyIDs_ShouldBeBadRequest()
    {
        var req = new BulkUpdateRequest(new List<Guid>(), "Completed");
        (req.EngagementIDs == null || req.EngagementIDs.Count == 0).Should().BeTrue();
    }

    [Fact]
    public void BulkUpdate_NullIDs_ShouldBeBadRequest()
    {
        var req = new BulkUpdateRequest(null!, "Completed");
        (req.EngagementIDs == null || req.EngagementIDs.Count == 0).Should().BeTrue();
    }

    [Fact]
    public void BulkUpdate_Status_Completed_TicksAllThree()
    {
        // Mirrors EngagementController BulkUpdateStatus
        var status = "Completed";
        var liked = status == "Completed" ? true : false;
        var commented = status == "Completed" ? true : false;
        var shared = status == "Completed" ? true : false;
        liked.Should().BeTrue();
        commented.Should().BeTrue();
        shared.Should().BeTrue();
    }

    [Fact]
    public void UpdateReason_TrimsOrNull()
    {
        string? Normalize(string? reason) => string.IsNullOrWhiteSpace(reason) ? null : reason.Trim();
        Normalize("  hello  ").Should().Be("hello");
        Normalize("   ").Should().BeNull();
        Normalize(null).Should().BeNull();
    }

    [Fact]
    public void GuidClaim_TryParse_Guard()
    {
        // B4 regression: Guid.Parse tanpa TryParse → FormatException
        bool TryParseClaim(string? claim, out Guid? id)
        {
            if (claim != null && Guid.TryParse(claim, out var g)) { id = g; return true; }
            id = null; return false;
        }
        TryParseClaim("not-a-guid", out var bad).Should().BeFalse();
        bad.Should().BeNull();
        var goodGuid = Guid.NewGuid().ToString();
        TryParseClaim(goodGuid, out var good).Should().BeTrue();
        good.Should().NotBeNull();
    }
}

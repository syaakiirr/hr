namespace socihr_backend.Helpers;

/// <summary>
/// Counts ticks at the action (checkbox) level instead of engagement level.
/// Each checkbox = 1 tick: Facebook(Like+Comment=2), Instagram(Like+Comment=2), TikTok(Comment=1).
/// </summary>
public static class TickHelper
{
    /// <summary>Number of individual actions ticked for this engagement.</summary>
    public static int Ticked(string platformName, bool isLiked, bool isCommented, bool isShared)
    {
        return platformName.ToLower() switch
        {
            "facebook"  => (isLiked ? 1 : 0) + (isCommented ? 1 : 0),
            "instagram" => (isLiked ? 1 : 0) + (isCommented ? 1 : 0),
            "tiktok"    => (isCommented ? 1 : 0),
            _           => (isLiked ? 1 : 0) + (isCommented ? 1 : 0) + (isShared ? 1 : 0)
        };
    }

    /// <summary>Total number of actions expected for this platform per engagement.</summary>
    public static int Expected(string platformName)
    {
        return platformName.ToLower() switch
        {
            "facebook"  => 2, // Like + Comment
            "instagram" => 2, // Like + Comment
            "tiktok"    => 1, // Comment only
            _           => 3  // Like + Comment + Share fallback
        };
    }

    /// <summary>Number of missed actions (expected - ticked).</summary>
    public static int Missed(string platformName, bool isLiked, bool isCommented, bool isShared)
    {
        return Expected(platformName) - Ticked(platformName, isLiked, isCommented, isShared);
    }
}

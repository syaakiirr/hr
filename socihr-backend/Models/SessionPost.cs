namespace socihr_backend.Models;

public class SessionPost
{
    public Guid PostID { get; set; }
    public Guid SessionID { get; set; }
    public Guid PlatformID { get; set; }
    public string PostLink { get; set; } = "";

    // Navigation
    public MonitoringSession? Session { get; set; }
    public Platform? Platform { get; set; }
}

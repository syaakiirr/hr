namespace socihr_backend.Models;

public class Engagement
{
    public Guid EngagementID { get; set; }
    public Guid SessionID { get; set; }
    public Guid PostID { get; set; }
    public Guid StaffID { get; set; }
    public string Status { get; set; } = "Missed"; // Completed | Missed
    public Guid? UpdatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }

    // Navigation
    public MonitoringSession? Session { get; set; }
    public SessionPost? Post { get; set; }
    public Staff? Staff { get; set; }
}

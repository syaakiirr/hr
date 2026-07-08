namespace socihr_backend.Models;

public class DashboardSnapshot
{
    public Guid SnapshotID { get; set; }
    public string SnapshotName { get; set; } = "";
    public DateTime SnapshotDate { get; set; }
    public string SnapshotData { get; set; } = ""; // JSON string of dashboard state
    public Guid CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; }
    public string? Notes { get; set; }
}

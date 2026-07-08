namespace socihr_backend.Models;

public class MonitoringSession
{
    public Guid SessionID { get; set; }
    public DateOnly SessionDate { get; set; }
    public Guid CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; }
    
    // Archive fields
    public bool IsArchived { get; set; } = false;
    public Guid? ArchivedBy { get; set; }
    public DateTime? ArchivedAt { get; set; }
}

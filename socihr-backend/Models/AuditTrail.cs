namespace socihr_backend.Models;

public class AuditTrail
{
    public Guid AuditID { get; set; }
    public Guid EngagementID { get; set; }
    public string PreviousStatus { get; set; } = "";
    public string NewStatus { get; set; } = "";
    public Guid UpdatedBy { get; set; }
    public DateTime UpdatedAt { get; set; }
}

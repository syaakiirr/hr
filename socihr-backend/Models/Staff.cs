namespace socihr_backend.Models;

public class Staff
{
    public Guid StaffID { get; set; }
    public string FullName { get; set; } = "";
    public string? Department { get; set; }
    public string? Position { get; set; }
    public string Status { get; set; } = "Active";
    public DateTime CreatedAt { get; set; }
    
    // Archive fields
    public bool IsArchived { get; set; } = false;
    public Guid? ArchivedBy { get; set; }
    public DateTime? ArchivedAt { get; set; }
}
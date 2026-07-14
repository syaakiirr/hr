namespace socihr_backend.Models;

public class Department
{
    public Guid DepartmentID { get; set; }
    public string DepartmentName { get; set; } = "";
    public DateTime CreatedAt { get; set; }
}

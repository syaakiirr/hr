namespace socihr_backend.Models;

public class Company
{
    public Guid CompanyID { get; set; }
    public string CompanyName { get; set; } = "";
    public DateTime CreatedAt { get; set; }
}

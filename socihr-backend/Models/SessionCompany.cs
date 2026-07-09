namespace socihr_backend.Models;

public class SessionCompany
{
    public Guid SessionCompanyID { get; set; }
    public Guid SessionID { get; set; }
    public Guid CompanyID { get; set; }

    // Navigation
    public MonitoringSession? Session { get; set; }
    public Company? Company { get; set; }
}

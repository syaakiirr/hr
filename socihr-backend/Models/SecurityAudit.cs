namespace socihr_backend.Models;

// Audit keselamatan umum (login, pengurusan pengguna, eksport, archive) —
// berbeza dengan AuditTrail yang khusus untuk perubahan status Engagement.
public class SecurityAudit
{
    public Guid AuditID { get; set; }
    public Guid UserID { get; set; }          // Guid.Empty jika pengguna tidak diketahui (cth login gagal)
    public string Username { get; set; } = "";
    public string Action { get; set; } = "";  // cth "login.success", "user.created"
    public string Details { get; set; } = "";
    public string IpAddress { get; set; } = "";
    public DateTime CreatedAt { get; set; }
}

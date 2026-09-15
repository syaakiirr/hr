using socihr_backend.Data;
using socihr_backend.Models;

namespace socihr_backend.Helpers;

// Penulis audit keselamatan terpusat — simpan bersama SaveChangesAsync pemanggil
// supaya audit dan aksi kekal konsisten dalam satu transaksi.
public static class SecurityAuditLog
{
    public static void Write(
        AppDbContext db,
        Microsoft.AspNetCore.Http.HttpContext http,
        Guid userId,
        string username,
        string action,
        string details)
    {
        var ip = http.Connection.RemoteIpAddress?.ToString() ?? "";
        // Nota: di sebalik proxy/Render, RemoteIpAddress ialah IP proxy melainkan
        // ForwardedHeaders dimajukan — masih berguna sebagai rekod, bukan untuk keputusan.
        db.SecurityAudits.Add(new SecurityAudit
        {
            AuditID = Guid.NewGuid(),
            UserID = userId,
            Username = username ?? "",
            Action = action,
            Details = details ?? "",
            IpAddress = ip,
            CreatedAt = DateTime.UtcNow
        });
    }
}

namespace socihr_backend.Models;

public class AppUser
{
    public Guid UserID { get; set; }
    public string Username { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public string Role { get; set; } = "DeptAdmin";
    public Guid? DepartmentID { get; set; }

    // TOTP 2FA (Odhnées/OtpNet) — rahsia Base32, hanya aktif bila TwoFactorEnabled
    public string? TotpSecret { get; set; }
    public bool TwoFactorEnabled { get; set; } = false;

    // Account lockout — kegagalan login berturut-turut
    public int FailedLoginAttempts { get; set; } = 0;
    public DateTime? LockoutEnd { get; set; }

    // Navigation property (loaded via Join in controllers)
    public Department? Department { get; set; }
}
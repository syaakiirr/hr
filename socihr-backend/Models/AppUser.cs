namespace socihr_backend.Models;

public class AppUser
{
    public Guid UserID { get; set; }
    public string Username { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public string Role { get; set; } = "HR";
}
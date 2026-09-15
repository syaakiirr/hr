using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using socihr_backend.Data;

namespace socihr_backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;

    public AuthController(AppDbContext db, IConfiguration config)
    {
        _db = db;
        _config = config;
    }

    [Authorize(Roles = "SuperAdmin")]
    [HttpGet("schema")]
    public async Task<IActionResult> GetSchema()
    {
        var conn = _db.Database.GetDbConnection();
        if (conn.State != System.Data.ConnectionState.Open)
            await conn.OpenAsync();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, column_name;";
        var list = new System.Collections.Generic.List<object>();
        using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            list.Add(new {
                Table = reader.GetString(0),
                Column = reader.GetString(1),
                Type = reader.GetString(2)
            });
        }
        return Ok(list);
    }

    private const int MaxFailedAttempts = 5;
    private const int LockoutMinutes = 15;
    private const int PendingTokenMinutes = 5;
    private const string PendingPurpose = "2fa-pending";

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        try
        {
            var user = await _db.Users
                .Include(u => u.Department)
                .FirstOrDefaultAsync(u => u.Username == request.Username);

            if (user == null)
            {
                Helpers.SecurityAuditLog.Write(_db, HttpContext, Guid.Empty, request.Username, "login.failed", "unknown username");
                await _db.SaveChangesAsync();
                return Unauthorized(new { message = "Incorrect username or password." });
            }

            // Akaun dikunci sementara selepas terlalu banyak kegagalan
            if (user.LockoutEnd.HasValue && user.LockoutEnd.Value > DateTime.UtcNow)
            {
                var retryAfter = (int)Math.Ceiling((user.LockoutEnd.Value - DateTime.UtcNow).TotalSeconds);
                Helpers.SecurityAuditLog.Write(_db, HttpContext, user.UserID, user.Username, "login.locked", $"retry after {retryAfter}s");
                await _db.SaveChangesAsync();
                Response.Headers["Retry-After"] = retryAfter.ToString();
                return StatusCode(423, new { message = "Account temporarily locked after too many failed attempts. Try again later.", retryAfterSeconds = retryAfter });
            }

            // Check if password is valid (either BCrypt hash or plain text for migration)
            bool isValidPassword;
            bool isPlainTextPassword = false;

            try
            {
                isValidPassword = BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash);
            }
            catch (BCrypt.Net.SaltParseException)
            {
                // If salt is invalid (not a BCrypt hash), check plain text
                isValidPassword = user.PasswordHash == request.Password;
                isPlainTextPassword = isValidPassword;
            }
            catch
            {
                // Any other exception, check plain text
                isValidPassword = user.PasswordHash == request.Password;
                isPlainTextPassword = isValidPassword;
            }

            if (!isValidPassword)
            {
                user.FailedLoginAttempts++;
                var locked = false;
                if (user.FailedLoginAttempts >= MaxFailedAttempts)
                {
                    user.LockoutEnd = DateTime.UtcNow.AddMinutes(LockoutMinutes);
                    locked = true;
                }
                Helpers.SecurityAuditLog.Write(_db, HttpContext, user.UserID, user.Username, "login.failed",
                    locked ? $"locked for {LockoutMinutes}m after {user.FailedLoginAttempts} attempts" : $"attempt {user.FailedLoginAttempts}");
                await _db.SaveChangesAsync();
                return Unauthorized(new { message = "Incorrect username or password." });
            }

            // Berjaya — reset kaunter lockout
            user.FailedLoginAttempts = 0;
            user.LockoutEnd = null;

            // If password was plain text, update it to a hash
            if (isPlainTextPassword)
            {
                user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);
                Console.WriteLine("✅ Updated user password to BCrypt hash!");
            }

            Helpers.SecurityAuditLog.Write(_db, HttpContext, user.UserID, user.Username, "login.success",
                user.TwoFactorEnabled ? "password ok, 2FA required" : "password ok");
            await _db.SaveChangesAsync();

            var jwtKey = _config["Jwt:Key"];
            if (string.IsNullOrWhiteSpace(jwtKey))
                throw new InvalidOperationException(
                    "JWT signing key is not configured. Set the 'JWT__Key' environment variable.");

            // 2FA aktif — keluarkan token SEMENTARA (5 min, hanya laku untuk /2fa/verify;
            // middleware di Program.cs menolaknya di endpoint lain)
            if (user.TwoFactorEnabled && !string.IsNullOrWhiteSpace(user.TotpSecret))
            {
                var pending = IssuePendingToken(user, jwtKey);
                return Ok(new { requires2FA = true, pendingToken = pending, username = user.Username });
            }

            return Ok(FullLoginResponse(user, jwtKey));
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Login error: {ex}");
            return StatusCode(500, new { message = "An error occurred on the server." });
        }
    }

    [HttpPost("2fa/verify")]
    public async Task<IActionResult> Verify2FA([FromBody] Verify2FARequest request)
    {
        try
        {
            var jwtKey = _config["Jwt:Key"];
            if (string.IsNullOrWhiteSpace(jwtKey))
                throw new InvalidOperationException("JWT signing key is not configured.");

            // Sahkan token sementara (tandatangan + tamat tempoh + tujuan)
            var handler = new JwtSecurityTokenHandler();
            ClaimsPrincipal principal;
            try
            {
                principal = handler.ValidateToken(request.PendingToken, new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidateAudience = true,
                    ValidateLifetime = true,
                    ValidateIssuerSigningKey = true,
                    ValidIssuer = _config["Jwt:Issuer"],
                    ValidAudience = _config["Jwt:Audience"],
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
                    ClockSkew = TimeSpan.FromSeconds(30)
                }, out _);
            }
            catch
            {
                return Unauthorized(new { message = "Verification session expired. Please log in again." });
            }

            if (principal.FindFirst("purpose")?.Value != PendingPurpose)
                return Unauthorized(new { message = "Invalid verification session." });

            var userId = Guid.Parse(principal.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            var user = await _db.Users.Include(u => u.Department).FirstOrDefaultAsync(u => u.UserID == userId);
            if (user == null || !user.TwoFactorEnabled || string.IsNullOrWhiteSpace(user.TotpSecret))
                return Unauthorized(new { message = "Two-factor authentication is not enabled for this account." });

            var code = (request.Code ?? "").Replace(" ", "").Trim();
            var totp = new OtpNet.Totp(OtpNet.Base32Encoding.ToBytes(user.TotpSecret));
            if (!totp.VerifyTotp(code, out _, new OtpNet.VerificationWindow(previous: 1, future: 1)))
            {
                Helpers.SecurityAuditLog.Write(_db, HttpContext, user.UserID, user.Username, "login.2fa.failed", "wrong TOTP code");
                await _db.SaveChangesAsync();
                return Unauthorized(new { message = "Invalid verification code." });
            }

            Helpers.SecurityAuditLog.Write(_db, HttpContext, user.UserID, user.Username, "login.2fa.success", "TOTP verified");
            await _db.SaveChangesAsync();
            return Ok(FullLoginResponse(user, jwtKey));
        }
        catch (Exception ex)
        {
            Console.WriteLine($"2FA verify error: {ex}");
            return StatusCode(500, new { message = "An error occurred on the server." });
        }
    }

    // POST /api/auth/2fa/setup — jana rahsia baharu untuk enrolment (perlu login).
    // Pengaktifan hanya berlaku melalui /2fa/enable selepas kod disahkan.
    [Authorize]
    [HttpPost("2fa/setup")]
    public async Task<IActionResult> Setup2FA()
    {
        var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var user = await _db.Users.FindAsync(userId);
        if (user == null) return NotFound(new { message = "User not found." });

        var secretBytes = OtpNet.KeyGeneration.GenerateRandomKey(20);
        var secret = OtpNet.Base32Encoding.ToString(secretBytes);
        user.TotpSecret = secret;
        user.TwoFactorEnabled = false; // kekal mati sehingga disahkan via /2fa/enable
        await _db.SaveChangesAsync();

        var issuer = "SociHR";
        var label = Uri.EscapeDataString(user.Username);
        var otpauthUrl = $"otpauth://totp/{issuer}:{label}?secret={secret}&issuer={issuer}&digits=6&period=30";
        return Ok(new { secret, otpauthUrl });
    }

    // POST /api/auth/2fa/enable — aktifkan selepas kod TOTP disahkan (perlu login)
    [Authorize]
    [HttpPost("2fa/enable")]
    public async Task<IActionResult> Enable2FA([FromBody] TwoFactorCodeRequest request)
    {
        var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var user = await _db.Users.FindAsync(userId);
        if (user == null) return NotFound(new { message = "User not found." });
        if (string.IsNullOrWhiteSpace(user.TotpSecret))
            return BadRequest(new { message = "Run 2FA setup first." });

        var code = (request.Code ?? "").Replace(" ", "").Trim();
        var totp = new OtpNet.Totp(OtpNet.Base32Encoding.ToBytes(user.TotpSecret));
        if (!totp.VerifyTotp(code, out _, new OtpNet.VerificationWindow(previous: 1, future: 1)))
            return BadRequest(new { message = "Invalid verification code. 2FA was not enabled." });

        user.TwoFactorEnabled = true;
        Helpers.SecurityAuditLog.Write(_db, HttpContext, user.UserID, user.Username, "2fa.enabled", "TOTP enrolled");
        await _db.SaveChangesAsync();
        return Ok(new { message = "Two-factor authentication enabled." });
    }

    // POST /api/auth/2fa/disable — lumpuhkan dengan kod TOTP semasa (perlu login + kod)
    [Authorize]
    [HttpPost("2fa/disable")]
    public async Task<IActionResult> Disable2FA([FromBody] TwoFactorCodeRequest request)
    {
        var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var user = await _db.Users.FindAsync(userId);
        if (user == null) return NotFound(new { message = "User not found." });
        if (!user.TwoFactorEnabled)
            return Ok(new { message = "Two-factor authentication is already disabled." });

        var code = (request.Code ?? "").Replace(" ", "").Trim();
        var totp = new OtpNet.Totp(OtpNet.Base32Encoding.ToBytes(user.TotpSecret!));
        if (!totp.VerifyTotp(code, out _, new OtpNet.VerificationWindow(previous: 1, future: 1)))
            return BadRequest(new { message = "Invalid verification code." });

        user.TwoFactorEnabled = false;
        user.TotpSecret = null;
        Helpers.SecurityAuditLog.Write(_db, HttpContext, user.UserID, user.Username, "2fa.disabled", "TOTP removed");
        await _db.SaveChangesAsync();
        return Ok(new { message = "Two-factor authentication disabled." });
    }

    private string IssueToken(IEnumerable<Claim> claims, string jwtKey, int expireMinutes)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"],
            audience: _config["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(expireMinutes),
            signingCredentials: creds);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private string IssuePendingToken(socihr_backend.Models.AppUser user, string jwtKey) =>
        IssueToken(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.UserID.ToString()),
            new Claim("purpose", PendingPurpose)
        }, jwtKey, PendingTokenMinutes);

    private object FullLoginResponse(socihr_backend.Models.AppUser user, string jwtKey)
    {
        var claimsList = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, user.UserID.ToString()),
            new Claim(ClaimTypes.Name, user.Username),
            new Claim(ClaimTypes.Role, user.Role)
        };
        if (user.DepartmentID.HasValue)
            claimsList.Add(new Claim("DepartmentID", user.DepartmentID.Value.ToString()));

        return new
        {
            requires2FA = false,
            token = IssueToken(claimsList, jwtKey, (int)double.Parse(_config["Jwt:ExpireMinutes"]!)),
            username = user.Username,
            role = user.Role,
            departmentId = user.DepartmentID?.ToString(),
            departmentName = user.Department?.DepartmentName
        };
    }
}

public record LoginRequest(string Username, string Password);
public record Verify2FARequest(string PendingToken, string Code);
public record TwoFactorCodeRequest(string Code);

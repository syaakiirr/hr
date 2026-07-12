using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using socihr_backend.Data;
using FluentValidation;
using FluentValidation.AspNetCore;
using AspNetCoreRateLimit;
using BCrypt.Net;

var builder = WebApplication.CreateBuilder(args);

// Database — support both URI format (postgres://...) and key=value format
var rawConnectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException(
        "❌ 'ConnectionStrings:DefaultConnection' is not set. " +
        "Set the environment variable 'ConnectionStrings__DefaultConnection' in Render.");

// Convert postgres:// URI to Npgsql key=value format if needed
string connectionString;
if (rawConnectionString.StartsWith("postgres://") || rawConnectionString.StartsWith("postgresql://"))
{
    // Manual parse — handles passwords containing '@' (e.g. Baesyakir01@)
    // by using the LAST '@' as the credentials/host boundary
    var withoutScheme = rawConnectionString
        .Replace("postgresql://", "")
        .Replace("postgres://", "");

    var lastAt     = withoutScheme.LastIndexOf('@');
    var credentials = withoutScheme[..lastAt];          // everything before last @
    var hostSection = withoutScheme[(lastAt + 1)..];    // everything after last @

    // Split credentials on the FIRST ':' only
    var firstColon = credentials.IndexOf(':');
    var username   = credentials[..firstColon];
    var password   = credentials[(firstColon + 1)..];

    // Split hostSection into host:port / database
    var slashIdx = hostSection.IndexOf('/');
    var database = slashIdx >= 0 ? hostSection[(slashIdx + 1)..] : "postgres";
    var hostPort = slashIdx >= 0 ? hostSection[..slashIdx] : hostSection;
    var colonIdx = hostPort.LastIndexOf(':');
    var host     = colonIdx >= 0 ? hostPort[..colonIdx] : hostPort;
    var port     = colonIdx >= 0 ? hostPort[(colonIdx + 1)..] : "5432";

    connectionString = $"Host={host};Port={port};Database={database};Username={username};Password={password};SSL Mode=Require;Trust Server Certificate=true";
    Console.WriteLine($"✅ Converted URI → Host={host};Port={port};Database={database};Username={username}");
}
else
{
    connectionString = rawConnectionString;
    Console.WriteLine("✅ Using key=value connection string.");
}

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(connectionString)
);


// Controllers — dengan camelCase JSON supaya frontend TypeScript interfaces match
builder.Services.AddControllers()
    .AddJsonOptions(opts =>
    {
        opts.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        opts.JsonSerializerOptions.DictionaryKeyPolicy  = System.Text.Json.JsonNamingPolicy.CamelCase;
    });

// FluentValidation
builder.Services.AddValidatorsFromAssemblyContaining<Program>();
builder.Services.AddFluentValidationAutoValidation();

// JWT Authentication
var jwtKey = builder.Configuration["Jwt:Key"]!;
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
        };
    });

builder.Services.AddAuthorization();

// Add Response Compression
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
});

// Add Memory Caching (we already have AddMemoryCache() for rate limiting, but let's keep it!
builder.Services.AddMemoryCache();

// Rate Limiting
builder.Services.Configure<IpRateLimitOptions>(builder.Configuration.GetSection("IpRateLimit"));
builder.Services.AddSingleton<IRateLimitConfiguration, RateLimitConfiguration>();
builder.Services.AddSingleton<IIpPolicyStore, MemoryCacheIpPolicyStore>();
builder.Services.AddSingleton<IRateLimitCounterStore, MemoryCacheRateLimitCounterStore>();
builder.Services.AddSingleton<IProcessingStrategy, AsyncKeyLockProcessingStrategy>();

// CORS - benarkan frontend React connect ke backend
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins(
                "https://soci-hr.onrender.com",
                "https://socihr.onrender.com",
                "https://syaakiirr.onrender.com",
                "http://localhost:5173",
                "http://localhost:3000"
              )
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var app = builder.Build();

// ── Startup DB connectivity check ──
try
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.CanConnectAsync();
    Console.WriteLine("✅ Database connection: OK");
}
catch (Exception ex)
{
    Console.WriteLine($"❌ Database connection FAILED: {ex.Message}");
    if (ex.InnerException != null)
        Console.WriteLine($"   Inner: {ex.InnerException.Message}");
}


// ── SEED ADMIN USER automatically if not exists ──
await SeedAdminUserAsync(app, args);

async Task SeedAdminUserAsync(WebApplication app, string[] args)
{
    try
    {
        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        
        // Seed admin user
        var admin = await db.Users.FirstOrDefaultAsync(u => u.Username == "admin");
        if (admin == null)
        {
            var adminUser = new socihr_backend.Models.AppUser
            {
                UserID = Guid.NewGuid(),
                Username = "admin",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("admin"),
                Role = "Admin"
            };
            await db.Users.AddAsync(adminUser);
            await db.SaveChangesAsync();
            Console.WriteLine("✅ Admin user created! Username: admin, Password: admin");
        }
        else
        {
            Console.WriteLine("ℹ️ Admin user already exists, skipping password reset.");
        }
        
        // Seed dummy data if --seed is provided
        if (args.Contains("--seed"))
        {
            Console.WriteLine("🌱 Seeding database with dummy data...");
            await socihr_backend.SeedData.SeedDummyData(db);
            Console.WriteLine("✅ Database seeded!");
        }
    }
    catch (Exception ex)
    {
        Console.WriteLine($"❌ Error seeding admin user: {ex}");
        if (ex.InnerException != null)
            Console.WriteLine($"   Inner exception: {ex.InnerException}");
    }
}

// ── Global exception handler — log real errors to terminal ──
app.Use(async (context, next) =>
{
    try
    {
        await next();
    }
    catch (Exception ex)
    {
        Console.ForegroundColor = ConsoleColor.Red;
        Console.WriteLine($"\n[500 ERROR] {context.Request.Method} {context.Request.Path}");
        Console.WriteLine($"  Exception : {ex.GetType().Name}");
        Console.WriteLine($"  Message   : {ex.Message}");
        if (ex.InnerException != null)
            Console.WriteLine($"  Inner     : {ex.InnerException.Message}");
        Console.ResetColor();

        context.Response.StatusCode = 500;
        context.Response.ContentType = "application/json";
        await context.Response.WriteAsJsonAsync(new { message = ex.Message });
    }
});

app.UseCors("AllowFrontend");

// Use Response Compression
app.UseResponseCompression();

// Rate Limiting Middleware
app.UseIpRateLimiting();

// Serve static files and SPA fallback FIRST, before auth, so React can load
app.UseStaticFiles();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapFallbackToFile("index.html");

app.Run();

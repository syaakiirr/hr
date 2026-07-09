using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using socihr_backend.Data;

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

// CORS - benarkan frontend React connect ke backend
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins(
                "https://soci-hr.onrender.com",
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


// ── SEED DATA if --seed argument is provided ──
if (args.Contains("--seed"))
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    
    Console.WriteLine("🌱 Seeding database with dummy data...");
    await socihr_backend.SeedData.SeedDummyData(db);
    Console.WriteLine("✅ Database seeded! You can now login with:");
    Console.WriteLine("   Username: admin");
    Console.WriteLine("   Password: admin");
    return;
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
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();

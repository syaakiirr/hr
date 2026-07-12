using Microsoft.EntityFrameworkCore;
using Npgsql;
using socihr_backend.Data;
using socihr_backend.Models;

namespace socihr_backend;

public static class SeedData
{
    public static async Task SeedDummyData(AppDbContext db)
    {
        // Seed admin user if not exists
        var adminExists = await db.Users.AnyAsync(u => u.Username == "admin");
        if (!adminExists)
        {
            var adminUser = new AppUser
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
        
        // Try to run seed SQL if it exists
        try
        {
            var connectionString = db.Database.GetConnectionString();
            
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync();

            if (File.Exists("seed-dummy-data.sql"))
            {
                var sql = await File.ReadAllTextAsync("seed-dummy-data.sql");
                
                // Split by GO or semicolon and execute
                var commands = sql.Split(new[] { "\r\n\r\n", "\n\n" }, StringSplitOptions.RemoveEmptyEntries);
                
                foreach (var commandText in commands)
                {
                    if (string.IsNullOrWhiteSpace(commandText) || commandText.Trim().StartsWith("--"))
                        continue;
                        
                    try
                    {
                        await using var cmd = new NpgsqlCommand(commandText, conn);
                        cmd.CommandTimeout = 120;
                        await cmd.ExecuteNonQueryAsync();
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"Error executing command: {ex.Message}");
                    }
                }
                
                Console.WriteLine("✅ Dummy data seeded successfully!");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"⚠️ Could not seed dummy data: {ex.Message}");
        }
    }
}

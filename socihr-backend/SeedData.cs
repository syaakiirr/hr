using Microsoft.EntityFrameworkCore;
using Npgsql;
using socihr_backend.Data;

namespace socihr_backend;

public static class SeedData
{
    public static async Task SeedDummyData(AppDbContext db)
    {
        var connectionString = db.Database.GetConnectionString();
        
        await using var conn = new NpgsqlConnection(connectionString);
        await conn.OpenAsync();

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

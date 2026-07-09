using Microsoft.EntityFrameworkCore;
using socihr_backend.Models;

namespace socihr_backend.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Staff> Staff { get; set; }
    public DbSet<AppUser> Users { get; set; }
    public DbSet<MonitoringSession> MonitoringSessions { get; set; }
    public DbSet<Platform> Platforms { get; set; }
    public DbSet<SessionPost> SessionPosts { get; set; }
    public DbSet<Engagement> Engagements { get; set; }
    public DbSet<AuditTrail> AuditTrails { get; set; }
    public DbSet<DashboardSnapshot> DashboardSnapshots { get; set; }
    public DbSet<Company> Companies { get; set; }
    public DbSet<SessionCompany> SessionCompanies { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // ── Staff ── Quote column names to preserve PascalCase in PostgreSQL
        modelBuilder.Entity<Staff>(e =>
        {
            e.ToTable("Staff");
            e.HasKey(x => x.StaffID);
            e.Property(x => x.StaffID).HasColumnName("StaffID");
            e.Property(x => x.FullName).HasColumnName("Fullname");
            e.Property(x => x.Department).HasColumnName("Department");
            e.Property(x => x.Position).HasColumnName("Position");
            e.Property(x => x.Status).HasColumnName("Status");
            e.Property(x => x.CreatedAt).HasColumnName("CreatedAt");
            e.Property(x => x.IsArchived).HasColumnName("IsArchived").HasDefaultValue(false);
            e.Property(x => x.ArchivedBy).HasColumnName("ArchivedBy");
            e.Property(x => x.ArchivedAt).HasColumnName("ArchivedAt");
            e.Property(x => x.CompanyID).HasColumnName("CompanyID");
            e.HasOne(x => x.Company).WithMany().HasForeignKey(x => x.CompanyID).OnDelete(DeleteBehavior.SetNull);
        });

        // ── Users ──
        modelBuilder.Entity<AppUser>(e =>
        {
            e.ToTable("Users");
            e.HasKey(x => x.UserID);
            e.Property(x => x.UserID).HasColumnName("UserID");
            e.Property(x => x.Username).HasColumnName("Username");
            e.Property(x => x.PasswordHash).HasColumnName("PasswordHash");
            e.Property(x => x.Role).HasColumnName("Role");
        });

        // ── MonitoringSession ──
        modelBuilder.Entity<MonitoringSession>(e =>
        {
            e.ToTable("MonitoringSession");
            e.HasKey(x => x.SessionID);
            e.Property(x => x.SessionID).HasColumnName("SessionID");
            e.Property(x => x.SessionDate).HasColumnName("SessionDate");
            e.Property(x => x.CreatedBy).HasColumnName("CreatedBy");
            e.Property(x => x.CreatedAt).HasColumnName("CreatedAt");
            e.Property(x => x.IsArchived).HasColumnName("IsArchived").HasDefaultValue(false);
            e.Property(x => x.ArchivedBy).HasColumnName("ArchivedBy");
            e.Property(x => x.ArchivedAt).HasColumnName("ArchivedAt");
        });

        // ── Platform ──
        modelBuilder.Entity<Platform>(e =>
        {
            e.ToTable("Platform");
            e.HasKey(x => x.PlatformID);
            e.Property(x => x.PlatformID).HasColumnName("PlatformID");
            e.Property(x => x.PlatformName).HasColumnName("PlatformName");
        });

        // ── SessionPost ──
        modelBuilder.Entity<SessionPost>(e =>
        {
            e.ToTable("SessionPost");
            e.HasKey(x => x.PostID);
            e.Property(x => x.PostID).HasColumnName("PostID");
            e.Property(x => x.SessionID).HasColumnName("SessionID");
            e.Property(x => x.PlatformID).HasColumnName("PlatformID");
            e.Property(x => x.PostLink).HasColumnName("PostLink");
            e.HasOne(x => x.Session).WithMany().HasForeignKey(x => x.SessionID).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Platform).WithMany().HasForeignKey(x => x.PlatformID).OnDelete(DeleteBehavior.Restrict);
        });

        // ── Engagement ──
        modelBuilder.Entity<Engagement>(e =>
        {
            e.ToTable("Engagement");
            e.HasKey(x => x.EngagementID);
            e.Property(x => x.EngagementID).HasColumnName("EngagementID");
            e.Property(x => x.SessionID).HasColumnName("SessionID");
            e.Property(x => x.PostID).HasColumnName("PostID");
            e.Property(x => x.StaffID).HasColumnName("StaffID");
            e.Property(x => x.Status).HasColumnName("Status");
            e.Property(x => x.UpdatedBy).HasColumnName("UpdatedBy");
            e.Property(x => x.UpdatedAt).HasColumnName("UpdatedAt");
            e.HasOne(x => x.Session).WithMany().HasForeignKey(x => x.SessionID).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Post).WithMany().HasForeignKey(x => x.PostID).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Staff).WithMany().HasForeignKey(x => x.StaffID).OnDelete(DeleteBehavior.Cascade);
        });

        // ── AuditTrail ──
        modelBuilder.Entity<AuditTrail>(e =>
        {
            e.ToTable("AuditTrail");
            e.HasKey(x => x.AuditID);
            e.Property(x => x.AuditID).HasColumnName("AuditID");
            e.Property(x => x.EngagementID).HasColumnName("EngagementID");
            e.Property(x => x.PreviousStatus).HasColumnName("PreviousStatus");
            e.Property(x => x.NewStatus).HasColumnName("NewStatus");
            e.Property(x => x.UpdatedBy).HasColumnName("UpdatedBy");
            e.Property(x => x.UpdatedAt).HasColumnName("UpdatedAt");
        });

        // ── DashboardSnapshot ──
        modelBuilder.Entity<DashboardSnapshot>(e =>
        {
            e.ToTable("DashboardSnapshot");
            e.HasKey(x => x.SnapshotID);
            e.Property(x => x.SnapshotID).HasColumnName("SnapshotID");
            e.Property(x => x.SnapshotName).HasColumnName("SnapshotName");
            e.Property(x => x.SnapshotDate).HasColumnName("SnapshotDate");
            e.Property(x => x.SnapshotData).HasColumnName("SnapshotData").HasColumnType("text");
            e.Property(x => x.CreatedBy).HasColumnName("CreatedBy");
            e.Property(x => x.CreatedAt).HasColumnName("CreatedAt");
            e.Property(x => x.Notes).HasColumnName("Notes");
        });

        // ── Company ──
        modelBuilder.Entity<Company>(e =>
        {
            e.ToTable("Company");
            e.HasKey(x => x.CompanyID);
            e.Property(x => x.CompanyID).HasColumnName("CompanyID");
            e.Property(x => x.CompanyName).HasColumnName("CompanyName");
            e.Property(x => x.CreatedAt).HasColumnName("CreatedAt");
        });

        // ── SessionCompany ──
        modelBuilder.Entity<SessionCompany>(e =>
        {
            e.ToTable("SessionCompany");
            e.HasKey(x => x.SessionCompanyID);
            e.Property(x => x.SessionCompanyID).HasColumnName("SessionCompanyID");
            e.Property(x => x.SessionID).HasColumnName("SessionID");
            e.Property(x => x.CompanyID).HasColumnName("CompanyID");
            e.HasOne(x => x.Session).WithMany().HasForeignKey(x => x.SessionID).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Company).WithMany().HasForeignKey(x => x.CompanyID).OnDelete(DeleteBehavior.Cascade);
        });
    }
}

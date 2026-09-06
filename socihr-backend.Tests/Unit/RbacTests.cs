using System.Reflection;
using FluentAssertions;
using Microsoft.AspNetCore.Authorization;
using socihr_backend.Controllers;

namespace socihr_backend.Tests.Unit;

/// <summary>
/// RBAC guard: pastikan endpoint kritikal ada [Authorize] dan role check.
/// JANGAN edit controller — test hanya assert via reflection.
/// Regression untuk B1 (GET /api/auth/schema tanpa auth) + audit SEC-AUDIT-001.
/// </summary>
public class RbacTests
{
    [Fact]
    public void EngagementController_HasAuthorize()
    {
        typeof(EngagementController).GetCustomAttribute<AuthorizeAttribute>().Should().NotBeNull("engagement endpoints mesti protected");
    }

    [Fact]
    public void DashboardController_HasAuthorize()
    {
        typeof(DashboardController).GetCustomAttribute<AuthorizeAttribute>().Should().NotBeNull();
    }

    [Fact]
    public void StaffController_HasAuthorize()
    {
        typeof(StaffController).GetCustomAttribute<AuthorizeAttribute>().Should().NotBeNull();
    }

    [Fact]
    public void MonitoringSessionController_HasAuthorize()
    {
        typeof(MonitoringSessionController).GetCustomAttribute<AuthorizeAttribute>().Should().NotBeNull();
    }

    [Fact]
    public void AuthController_GetSchema_MustHaveAuthorize_OrBeRemoved()
    {
        var method = typeof(AuthController).GetMethod("GetSchema");
        if (method == null)
        {
            // Endpoint dibuang = pass (paling selamat)
            Assert.True(true);
            return;
        }
        var hasAuthorize = method.GetCustomAttribute<AuthorizeAttribute>() != null
                        || typeof(AuthController).GetCustomAttribute<AuthorizeAttribute>() != null;
        hasAuthorize.Should().BeTrue("B1 CRITICAL: GET /api/auth/schema mendedahkan information_schema tanpa auth");
    }

    [Fact]
    public void AuthController_Login_AllowsAnonymous()
    {
        var method = typeof(AuthController).GetMethod("Login");
        method.Should().NotBeNull();
        method!.GetCustomAttribute<AllowAnonymousAttribute>().Should().NotBeNull("login mesti anonymous");
    }
}

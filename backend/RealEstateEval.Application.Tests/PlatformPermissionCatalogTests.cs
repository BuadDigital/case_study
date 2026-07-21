using RealEstateEval.Application.Authorization;
using RealEstateEval.Infrastructure.Permissions;

namespace RealEstateEval.Application.Tests;

public class PlatformPermissionCatalogTests
{
    [Fact]
    public void AllCapabilities_matches_PlatformCapabilities_All()
    {
        Assert.Equal(
            PlatformCapabilities.All.OrderBy(c => c),
            PlatformPermissionCatalog.AllCapabilities.OrderBy(c => c));
    }

    [Theory]
    [InlineData("case-specialist", "manage-work-orders")]
    [InlineData("case-specialist", "submit-party-work")]
    [InlineData("case-specialist", "manage-attachments")]
    [InlineData("field-inspector", "submit-party-work")]
    [InlineData("financial-officer", "manage-financial")]
    [InlineData("government-reviewer", "manage-operations")]
    [InlineData("real-estate-appraiser", "submit-valuation-report")]
    public void Prototype_role_grants_expected_capability(string role, string capability)
    {
        var pages = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var capabilities = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        PlatformPermissionCatalog.ApplyPrototypeRole(role, pages, capabilities);
        Assert.Contains(capability, capabilities);
    }

    [Fact]
    public void Case_specialist_does_not_grant_manage_users()
    {
        var pages = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var capabilities = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        PlatformPermissionCatalog.ApplyPrototypeRole("case-specialist", pages, capabilities);
        Assert.DoesNotContain(PlatformCapabilities.ManageUsers, capabilities);
    }

    [Theory]
    [InlineData("government-reviewer", "failures")]
    [InlineData("government-reviewer", "party-fees")]
    [InlineData("government-reviewer", "po")]
    [InlineData("section-supervisor", "failures")]
    [InlineData("financial-officer", "financial")]
    public void Prototype_role_grants_expected_page(string role, string page)
    {
        var pages = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var capabilities = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        PlatformPermissionCatalog.ApplyPrototypeRole(role, pages, capabilities);
        Assert.Contains(page, pages);
    }

    [Fact]
    public void Case_specialist_excludes_all_transactions()
    {
        var pages = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var capabilities = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        PlatformPermissionCatalog.ApplyPrototypeRole("case-specialist", pages, capabilities);
        Assert.DoesNotContain("all-transactions", pages);
    }

    [Theory]
    [InlineData("government-reviewer")]
    [InlineData("section-supervisor")]
    public void Role_excludes_all_transactions(string role)
    {
        var pages = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var capabilities = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        PlatformPermissionCatalog.ApplyPrototypeRole(role, pages, capabilities);
        Assert.DoesNotContain("all-transactions", pages);
    }

    [Theory]
    [InlineData("field-inspector")]
    [InlineData("section-supervisor")]
    [InlineData("general-manager")]
    [InlineData("government-reviewer")]
    [InlineData("case-specialist")]
    public void Prototype_roles_except_cdo_exclude_dashboard(string role)
    {
        var pages = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var capabilities = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        PlatformPermissionCatalog.ApplyPrototypeRole(role, pages, capabilities);
        Assert.DoesNotContain("dashboard", pages);
    }

    [Fact]
    public void Cdo_includes_dashboard()
    {
        var pages = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var capabilities = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        PlatformPermissionCatalog.ApplyPrototypeRole("cdo", pages, capabilities);
        Assert.Contains("dashboard", pages);
    }
}

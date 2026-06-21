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
}

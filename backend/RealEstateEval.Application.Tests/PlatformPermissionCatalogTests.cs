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
    [InlineData("case-specialist", "manage-operations")]
    [InlineData("case-specialist", "courts.manage")]
    [InlineData("section-supervisor", "manage-operations")]
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

    [Fact]
    public void Case_specialist_matches_section_supervisor_pages_and_capabilities()
    {
        var supervisorPages = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var supervisorCaps = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        PlatformPermissionCatalog.ApplyPrototypeRole(
            "section-supervisor", supervisorPages, supervisorCaps);

        var specialistPages = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var specialistCaps = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        PlatformPermissionCatalog.ApplyPrototypeRole(
            "case-specialist", specialistPages, specialistCaps);

        Assert.Equal(
            supervisorPages.OrderBy(p => p, StringComparer.OrdinalIgnoreCase),
            specialistPages.OrderBy(p => p, StringComparer.OrdinalIgnoreCase));
        Assert.Equal(
            supervisorCaps.OrderBy(c => c, StringComparer.OrdinalIgnoreCase),
            specialistCaps.OrderBy(c => c, StringComparer.OrdinalIgnoreCase));
        Assert.Contains("fee-pricing", specialistPages);
        Assert.DoesNotContain("financial", specialistPages);
        Assert.DoesNotContain("manage-financial", specialistCaps);
    }

    [Theory]
    [InlineData("government-reviewer", "failures")]
    [InlineData("government-reviewer", "party-fees")]
    [InlineData("government-reviewer", "po")]
    [InlineData("government-reviewer", "operations-tasks")]
    [InlineData("general-manager", "operations-tasks")]
    [InlineData("engineering-office", "operations-tasks")]
    [InlineData("section-supervisor", "failures")]
    [InlineData("section-supervisor", "fee-pricing")]
    [InlineData("section-supervisor", "party-fees")]
    [InlineData("case-specialist", "fee-pricing")]
    [InlineData("case-specialist", "party-fees")]
    [InlineData("financial-officer", "financial")]
    public void Prototype_role_grants_expected_page(string role, string page)
    {
        var pages = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var capabilities = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        PlatformPermissionCatalog.ApplyPrototypeRole(role, pages, capabilities);
        Assert.Contains(page, pages);
    }

    [Fact]
    public void Government_reviewer_uses_operations_tasks_not_government_review_page()
    {
        var pages = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var capabilities = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        PlatformPermissionCatalog.ApplyPrototypeRole("government-reviewer", pages, capabilities);
        Assert.DoesNotContain("government-review", pages);
        Assert.Contains("operations-tasks", pages);
        Assert.Contains("keys", pages);
        Assert.Contains("manage-operations", capabilities);
        Assert.Contains("submit-party-work", capabilities);
    }

    [Fact]
    public void AllPages_includes_operations_tasks()
    {
        Assert.Contains("operations-tasks", PlatformPermissionCatalog.AllPages);
    }

    [Theory]
    [InlineData("case-specialist")]
    [InlineData("section-supervisor")]
    [InlineData("government-reviewer")]
    [InlineData("general-manager")]
    [InlineData("real-estate-appraiser")]
    [InlineData("field-inspector")]
    [InlineData("engineering-office")]
    [InlineData("financial-officer")]
    public void Non_cdo_roles_exclude_all_transactions(string role)
    {
        var pages = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var capabilities = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        PlatformPermissionCatalog.ApplyPrototypeRole(role, pages, capabilities);
        Assert.DoesNotContain("all-transactions", pages);
    }

    [Fact]
    public void Cdo_includes_all_transactions()
    {
        var pages = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var capabilities = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        PlatformPermissionCatalog.ApplyPrototypeRole("cdo", pages, capabilities);
        Assert.Contains("all-transactions", pages);
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

    [Fact]
    public void Cdo_includes_orphan_survey_page()
    {
        var pages = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var capabilities = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        PlatformPermissionCatalog.ApplyPrototypeRole("cdo", pages, capabilities);
        Assert.Contains("survey", pages);
    }

    [Fact]
    public void General_manager_excludes_orphan_survey_page()
    {
        var pages = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var capabilities = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        PlatformPermissionCatalog.ApplyPrototypeRole("general-manager", pages, capabilities);
        Assert.DoesNotContain("survey", pages);
    }

    [Fact]
    public void Cdo_includes_system_screen_catalog()
    {
        var pages = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var capabilities = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        PlatformPermissionCatalog.ApplyPrototypeRole("cdo", pages, capabilities);
        Assert.Contains("system-screen-catalog", pages);
    }

    [Theory]
    [InlineData("case-specialist")]
    [InlineData("section-supervisor")]
    [InlineData("government-reviewer")]
    [InlineData("general-manager")]
    [InlineData("real-estate-appraiser")]
    [InlineData("field-inspector")]
    [InlineData("engineering-office")]
    [InlineData("financial-officer")]
    public void Non_cdo_roles_exclude_system_screen_catalog(string role)
    {
        var pages = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var capabilities = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        PlatformPermissionCatalog.ApplyPrototypeRole(role, pages, capabilities);
        Assert.DoesNotContain("system-screen-catalog", pages);
    }
}

using RealEstateEval.Application.Authorization;
using RealEstateEval.Identity.Infrastructure.Permissions;
using RealEstateEval.Domain;

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

    /// <summary>
    /// The specialist shares the supervisor's operational pages but not fees or pricing (ruling of
    /// 2026-10-26): party outputs are accepted inside the transaction, and fee money is the
    /// supervisor's decision.
    /// </summary>
    [Fact]
    public void Case_specialist_matches_section_supervisor_pages_except_fees_and_pricing()
    {
        var supervisorPages = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var supervisorCaps = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        PlatformPermissionCatalog.ApplyPrototypeRole(
            "section-supervisor", supervisorPages, supervisorCaps);

        var specialistPages = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var specialistCaps = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        PlatformPermissionCatalog.ApplyPrototypeRole(
            "case-specialist", specialistPages, specialistCaps);
        // A specialist holding all three sub-roles (the launch state) has the pre-split pages.
        PlatformPermissionCatalog.ApplyCaseSpecialistSubRoles(CaseSpecialistSubRoles.All, specialistPages);

        Assert.Equal(
            supervisorCaps.OrderBy(c => c, StringComparer.OrdinalIgnoreCase),
            specialistCaps.OrderBy(c => c, StringComparer.OrdinalIgnoreCase));
        Assert.Contains("all-transactions", specialistPages);
        Assert.Contains("all-transactions", supervisorPages);
        Assert.DoesNotContain("party-fees", specialistPages);
        Assert.DoesNotContain("fee-pricing", specialistPages);
        supervisorPages.Remove("party-fees");
        supervisorPages.Remove("fee-pricing");
        Assert.Equal(
            supervisorPages.OrderBy(p => p, StringComparer.OrdinalIgnoreCase),
            specialistPages.OrderBy(p => p, StringComparer.OrdinalIgnoreCase));
        Assert.DoesNotContain("financial", specialistPages);
        Assert.DoesNotContain("manage-financial", specialistCaps);
    }

    /// <summary>
    /// Ruling 2026-11-02: the queue pages follow the held sub-roles — coordination the intake,
    /// bourse, distribution, operations, keys and failure follow-up pages; study the case-study
    /// queue; review the Enfaz upload queue. The common pages stay for everyone.
    /// </summary>
    [Theory]
    [InlineData("coordination", "active-primary-data", true)]
    [InlineData("coordination", "active-distribution", true)]
    [InlineData("coordination", "keys", true)]
    [InlineData("coordination", "suspended-transactions", true)]
    [InlineData("coordination", "active-case-study", false)]
    [InlineData("coordination", "system-upload", false)]
    [InlineData("study", "active-case-study", true)]
    [InlineData("study", "bourse-inquiry", false)]
    [InlineData("study", "system-upload", false)]
    [InlineData("review", "system-upload", true)]
    [InlineData("review", "active-case-study", false)]
    [InlineData("review", "operations-tasks", false)]
    public void Case_specialist_queue_pages_follow_the_sub_role(string subRole, string page, bool expected)
    {
        var pages = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var capabilities = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        PlatformPermissionCatalog.ApplyPrototypeRole("case-specialist", pages, capabilities);
        PlatformPermissionCatalog.ApplyCaseSpecialistSubRoles([subRole], pages);

        Assert.Equal(expected, pages.Contains(page));
        Assert.Contains("po", pages);
        Assert.Contains("all-transactions", pages);
        Assert.Contains("failures", pages);
    }

    [Theory]
    [InlineData("government-reviewer", "failures")]
    [InlineData("government-reviewer", "party-fees")]
    [InlineData("government-reviewer", "po")]
    [InlineData("government-reviewer", "operations-tasks")]
    [InlineData("general-manager", "operations-tasks")]
    [InlineData("engineering-office", "operations-tasks")]
    [InlineData("engineering-office", "po")]
    [InlineData("field-inspector", "po")]
    [InlineData("field-inspector", "active-inspection")]
    [InlineData("section-supervisor", "failures")]
    [InlineData("section-supervisor", "fee-pricing")]
    [InlineData("section-supervisor", "party-fees")]
    [InlineData("case-specialist", "property-map")]
    [InlineData("case-specialist", "all-transactions")]
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
    [InlineData("government-reviewer")]
    [InlineData("real-estate-appraiser")]
    [InlineData("field-inspector")]
    [InlineData("engineering-office")]
    [InlineData("financial-officer")]
    public void Other_non_cdo_roles_exclude_all_transactions(string role)
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

    [Fact]
    public void Supervisor_and_general_manager_follow_active_transactions()
    {
        // «المعاملات النشطة» (2026-11-05): the follow-up page of every live transaction.
        foreach (var role in new[] { "section-supervisor", "general-manager" })
        {
            var pages = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var capabilities = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            PlatformPermissionCatalog.ApplyPrototypeRole(role, pages, capabilities);
            Assert.Contains("all-transactions", pages);
        }
    }

    [Fact]
    public void Case_specialist_includes_all_transactions()
    {
        var pages = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var capabilities = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        PlatformPermissionCatalog.ApplyPrototypeRole("case-specialist", pages, capabilities);
        Assert.Contains("all-transactions", pages);
    }

    [Theory]
    [InlineData("section-supervisor")]
    [InlineData("general-manager")]
    [InlineData("government-reviewer")]
    [InlineData("case-specialist")]
    [InlineData("real-estate-appraiser")]
    [InlineData("engineering-office")]
    [InlineData("financial-officer")]
    [InlineData("field-inspector")]
    public void Only_the_cdo_has_the_dashboard(string role)
    {
        // Omar 2026-11-09: «لوحة التحكم» for the system owner (CDO / المدير التنفيذي) only.
        var pages = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var capabilities = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        PlatformPermissionCatalog.ApplyPrototypeRole(role, pages, capabilities);
        Assert.DoesNotContain("dashboard", pages);

        var cdoPages = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        PlatformPermissionCatalog.ApplyPrototypeRole("cdo", cdoPages, capabilities);
        Assert.Contains("dashboard", cdoPages);
    }




}

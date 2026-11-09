using RealEstateEval.Domain;

namespace RealEstateEval.Identity.Infrastructure.Permissions;

/// <summary>Server-side page + capability catalog (aligned with prototype <c>ROLES</c> in app-shared).</summary>
public static class PlatformPermissionCatalog
{
    public static readonly IReadOnlyList<string> AllPages =
    [
        "dashboard", "my-work", "active-primary-data", "active-distribution", "active-receipt", "active-case-study",
        "system-upload",
        "po", "all-transactions", "property-map", "favorites", "bourse-inquiry", "keys", "failures", "suspended-transactions",
        "comparable-properties", "property-inspection", "active-inspection", "operations-tasks",
        "property-appraisal", "active-survey", "party-fees",
        "system-fields-catalog", "attachment-print-dictionary", "financial",
        "users", "courts", "failure-types", "case-study-info-roles",
        "audit-log", "fee-pricing", "organization-settings", "field-sync-board", "admin-panel",
    ];

    public static readonly IReadOnlyList<string> AllCapabilities =
    [
        "manage-users",
        "manage-system-config",
        "reset-system-data",
        "manage-valuation-requests",
        "manage-failures",
        "submit-valuation-report",
        "manage-work-orders",
        "submit-party-work",
        "manage-attachments",
        "manage-financial",
        "manage-operations",
        "courts.manage",
    ];

    public static bool IsSuperAdminIdentityRole(string role) =>
        string.Equals(role, "CDO", StringComparison.OrdinalIgnoreCase)
        || string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase);

    private static readonly Dictionary<string, string[]> IdentityRolePages = new(StringComparer.OrdinalIgnoreCase)
    {
        ["CDO"] = AllPages.ToArray(),
    };

    /// <remarks>
    /// «لوحة التحكم» (dashboard) is the system owner's only (Omar 2026-11-09): the CDO / المدير التنفيذي
    /// prototype role and the super-admin identity roles get it through <see cref="AllPages"/>; no other
    /// role lists it, so it is gone from their sidebar and their landing.
    /// </remarks>
    private static readonly Dictionary<string, string[]> PrototypeRolePages = new(StringComparer.OrdinalIgnoreCase)
    {
        ["cdo"] = AllPages.ToArray(),
        ["general-manager"] =
        [
            "my-work", "all-transactions", "po", "property-map", "favorites", "active-primary-data", "bourse-inquiry", "active-distribution", "active-receipt",
            "active-case-study", "system-upload", "operations-tasks", "keys", "failures", "suspended-transactions",
            "comparable-properties",
            "financial", "courts", "failure-types", "case-study-info-roles",
        ],
        ["section-supervisor"] =
        [
            "my-work", "all-transactions", "po", "property-map", "favorites", "active-primary-data", "bourse-inquiry", "active-distribution", "active-receipt",
            "active-case-study", "system-upload", "operations-tasks", "keys", "field-sync-board", "failures", "suspended-transactions", "failure-types",
            "party-fees",
            "fee-pricing",
        ],
 // The pages every case specialist sees whatever sub-roles he holds; the queue pages come from
 // the sub-roles (CaseSpecialistSubRolePages). No fees or pricing: party outputs are accepted
 // inside the transaction, and fee money is the supervisor's decision.
        ["case-specialist"] =
        [
            "my-work", "po", "all-transactions", "property-map", "favorites", "failures",
        ],
        ["real-estate-appraiser"] =
        [
            "po", "property-map", "favorites", "operations-tasks", "property-appraisal",
            "comparable-properties",
            "failures", "suspended-transactions",
        ],
        ["field-inspector"] =
        [
            "po", "favorites", "operations-tasks", "active-inspection", "party-fees", "failures",
        ],
        ["government-reviewer"] =
        [
            "po", "favorites", "operations-tasks", "party-fees", "keys", "failures",
        ],
        ["engineering-office"] =
        [
            "po", "operations-tasks", "favorites", "active-survey", "party-fees", "failures",
        ],
        ["financial-officer"] =
        [
            "financial",
        ],
    };

    private static readonly Dictionary<string, string[]> IdentityRoleCapabilities = new(StringComparer.OrdinalIgnoreCase)
    {
        ["CDO"] = AllCapabilities.ToArray(),
    };

    private static readonly Dictionary<string, string[]> PrototypeRoleCapabilities = new(StringComparer.OrdinalIgnoreCase)
    {
        ["cdo"] = AllCapabilities.ToArray(),
        ["general-manager"] =
        [
            "manage-valuation-requests", "manage-failures", "manage-work-orders",
            "submit-party-work", "manage-attachments", "manage-financial", "manage-operations",
        ],
        ["section-supervisor"] =
        [
            "manage-failures", "manage-work-orders", "submit-party-work",
            "manage-attachments", "manage-operations", "courts.manage",
        ],
 // Match admin capabilities without manage-financial
        ["case-specialist"] =
        [
            "manage-failures", "manage-work-orders", "submit-party-work",
            "manage-attachments", "manage-operations", "courts.manage",
        ],
        ["real-estate-appraiser"] =
        [
            "submit-valuation-report", "submit-party-work", "manage-attachments",
        ],
        ["field-inspector"] = ["submit-party-work", "manage-attachments"],
        ["government-reviewer"] =
        [
            "submit-party-work", "manage-attachments", "manage-operations",
        ],
        ["engineering-office"] = ["submit-party-work", "manage-attachments"],
        ["financial-officer"] = ["manage-financial", "manage-attachments"],
    };

    public static void ApplyIdentityRole(string role, ISet<string> pages, ISet<string> capabilities)
    {
        if (IdentityRolePages.TryGetValue(role, out var p))
            foreach (var page in p) pages.Add(page);
        if (IdentityRoleCapabilities.TryGetValue(role, out var c))
            foreach (var cap in c) capabilities.Add(cap);
    }

    public static void ApplyPrototypeRole(string role, ISet<string> pages, ISet<string> capabilities)
    {
        if (PrototypeRolePages.TryGetValue(role, out var p))
            foreach (var page in p) pages.Add(page);
        if (PrototypeRoleCapabilities.TryGetValue(role, out var c))
            foreach (var cap in c) capabilities.Add(cap);
    }

    /// <summary>
    /// Queue pages per case-specialist sub-role (ruling 2026-11-02): coordination owns intake,
    /// bourse, distribution, operations, keys and failure follow-up; study owns the case-study
    /// queue; review owns the Enfaz upload queue.
    /// </summary>
    private static readonly Dictionary<string, string[]> CaseSpecialistSubRolePages = new(StringComparer.OrdinalIgnoreCase)
    {
        [CaseSpecialistSubRoles.Coordination] =
        [
            "active-primary-data", "bourse-inquiry", "active-distribution", "active-receipt", "operations-tasks", "keys",
            "field-sync-board", "suspended-transactions", "failure-types",
        ],
        [CaseSpecialistSubRoles.Study] = ["active-case-study"],
        [CaseSpecialistSubRoles.Review] = ["system-upload"],
    };

    /// <summary>
    /// Adds the union of the pages of the held sub-roles. How it works: unknown words add nothing;
    /// a specialist holding all three gets exactly the pages the role had before the split.
    /// </summary>
    public static void ApplyCaseSpecialistSubRoles(IEnumerable<string> subRoles, ISet<string> pages)
    {
        foreach (var subRole in subRoles)
            if (CaseSpecialistSubRolePages.TryGetValue(subRole, out var p))
                foreach (var page in p) pages.Add(page);
    }

    public static void ApplySuperAdminGrant(ISet<string> pages, ISet<string> capabilities)
    {
        foreach (var page in AllPages) pages.Add(page);
        foreach (var cap in AllCapabilities) capabilities.Add(cap);
    }
}

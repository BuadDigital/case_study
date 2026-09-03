namespace RealEstateEval.Identity.Infrastructure.Permissions;

/// <summary>Server-side page + capability catalog (aligned with prototype <c>ROLES</c> in app-shared).</summary>
public static class PlatformPermissionCatalog
{
    public static readonly IReadOnlyList<string> AllPages =
    [
        "dashboard", "active-primary-data", "active-distribution", "active-case-study",
        "system-upload",
        "po", "all-transactions", "property-map", "favorites", "bourse-inquiry", "survey", "keys", "failures", "suspended-transactions",
        "valuation-requests", "comparable-properties", "property-inspection", "active-inspection", "operations-tasks",
        "property-appraisal", "active-survey", "party-fees",
        "system-fields-catalog", "attachment-print-dictionary", "difference-factor-catalog", "system-screen-catalog", "financial",
        "users", "courts", "failure-types", "case-study-info-roles",
        "audit-log", "fee-pricing", "organization-settings", "field-sync-board",
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

    private static readonly Dictionary<string, string[]> PrototypeRolePages = new(StringComparer.OrdinalIgnoreCase)
    {
        ["cdo"] = AllPages.ToArray(),
        ["general-manager"] =
        [
            "po", "property-map", "favorites", "active-primary-data", "bourse-inquiry", "active-distribution",
            "active-case-study", "system-upload", "operations-tasks", "keys", "failures", "suspended-transactions",
            "valuation-requests",
            "comparable-properties",
            "financial", "courts", "failure-types", "case-study-info-roles",
        ],
        ["section-supervisor"] =
        [
            "po", "property-map", "favorites", "active-primary-data", "bourse-inquiry", "active-distribution",
            "active-case-study", "system-upload", "operations-tasks", "keys", "field-sync-board", "failures", "suspended-transactions", "failure-types",
            "party-fees",
            "fee-pricing",
        ],
 // Supervisor matching (pages + fees + Pricing) — none financial / manage-financial
        ["case-specialist"] =
        [
            "po", "property-map", "favorites", "active-primary-data", "bourse-inquiry", "active-distribution",
            "active-case-study", "system-upload", "operations-tasks", "keys", "field-sync-board", "failures", "suspended-transactions", "failure-types",
            "party-fees",
            "fee-pricing",
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

    public static void ApplySuperAdminGrant(ISet<string> pages, ISet<string> capabilities)
    {
        foreach (var page in AllPages) pages.Add(page);
        foreach (var cap in AllCapabilities) capabilities.Add(cap);
    }
}

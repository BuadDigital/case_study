namespace RealEstateEval.Infrastructure.Permissions;

/// <summary>Server-side page + capability catalog (aligned with prototype <c>ROLES</c> in app-shared).</summary>
public static class PlatformPermissionCatalog
{
    public static readonly IReadOnlyList<string> AllPages =
    [
        "dashboard", "active-primary-data", "active-distribution", "active-case-study",
        "po", "all-transactions", "bourse-inquiry", "survey", "keys", "failures", "suspended-transactions",
        "valuation-requests", "property-inspection", "government-review",
        "valuation-coordination", "property-appraisal", "active-survey", "party-fees",
        "system-fields-catalog", "system-screen-catalog", "financial", "kpi",
        "users", "courts", "failure-types", "case-study-info-roles",
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
        ["HrAdmin"] = ["users", "system-fields-catalog", "system-screen-catalog"],
        ["ProcAdmin"] = ["financial", "users", "system-fields-catalog", "system-screen-catalog"],
        ["CrmAdmin"] = ["users", "system-fields-catalog", "system-screen-catalog"],
        ["HR"] = ["users"],
        ["PROC"] = ["users"],
        ["CRM"] = ["users"],
    };

    private static readonly Dictionary<string, string[]> PrototypeRolePages = new(StringComparer.OrdinalIgnoreCase)
    {
        ["cdo"] = AllPages.ToArray(),
        ["hr-admin"] = ["users", "system-fields-catalog", "system-screen-catalog"],
        ["proc-admin"] = ["financial", "users", "system-fields-catalog", "system-screen-catalog"],
        ["crm-admin"] = ["users", "system-fields-catalog", "system-screen-catalog"],
        ["general-manager"] =
        [
            "po", "all-transactions", "active-primary-data", "bourse-inquiry", "active-distribution",
            "active-case-study", "survey", "keys", "failures", "suspended-transactions",
            "valuation-requests", "system-fields-catalog", "system-screen-catalog",
            "financial", "kpi", "users", "courts", "failure-types", "case-study-info-roles",
        ],
        ["section-supervisor"] =
        [
            "po", "active-primary-data", "bourse-inquiry", "active-distribution",
            "active-case-study", "keys", "failures", "suspended-transactions", "failure-types",
            "party-fees",
            "system-fields-catalog", "system-screen-catalog",
        ],
        ["case-specialist"] =
        [
            "po", "active-primary-data", "bourse-inquiry", "active-distribution",
            "active-case-study", "failures", "suspended-transactions",
            "system-fields-catalog", "system-screen-catalog",
        ],
        ["valuation-coordinator"] =
        [
            "all-transactions", "valuation-coordination",
            "system-fields-catalog", "system-screen-catalog",
        ],
        ["real-estate-appraiser"] =
        [
            "po", "all-transactions", "property-appraisal", "failures", "suspended-transactions",
            "system-fields-catalog", "system-screen-catalog",
        ],
        ["field-inspector"] =
        [
            "all-transactions", "property-inspection", "party-fees", "failures",
            "system-fields-catalog", "system-screen-catalog",
        ],
        ["government-reviewer"] =
        [
            "po", "government-review", "party-fees", "keys", "failures",
            "system-fields-catalog", "system-screen-catalog",
        ],
        ["engineering-office"] =
        [
            "all-transactions", "active-survey", "party-fees", "failures",
            "system-fields-catalog", "system-screen-catalog",
        ],
        ["financial-officer"] =
        [
            "financial",
            "system-fields-catalog", "system-screen-catalog",
        ],
    };

    private static readonly Dictionary<string, string[]> IdentityRoleCapabilities = new(StringComparer.OrdinalIgnoreCase)
    {
        ["CDO"] = AllCapabilities.ToArray(),
        ["HrAdmin"] = ["manage-users"],
        ["ProcAdmin"] = ["manage-users", "manage-financial", "manage-attachments"],
        ["CrmAdmin"] = ["manage-users"],
    };

    private static readonly Dictionary<string, string[]> PrototypeRoleCapabilities = new(StringComparer.OrdinalIgnoreCase)
    {
        ["cdo"] = AllCapabilities.ToArray(),
        ["hr-admin"] = ["manage-users"],
        ["proc-admin"] = ["manage-users", "manage-financial", "manage-attachments"],
        ["crm-admin"] = ["manage-users"],
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
        ["case-specialist"] =
        [
            "manage-failures", "manage-work-orders", "submit-party-work", "manage-attachments",
        ],
        ["valuation-coordinator"] = ["submit-party-work", "manage-attachments"],
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

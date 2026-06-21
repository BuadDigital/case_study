namespace RealEstateEval.Infrastructure.Permissions;

/// <summary>Server-side page + capability catalog (aligned with prototype <c>ROLES</c> in app-shared).</summary>
public static class PlatformPermissionCatalog
{
    public static readonly IReadOnlyList<string> AllPages =
    [
        "dashboard", "active-primary-data", "active-distribution", "active-case-study",
        "po", "bourse-inquiry", "survey", "keys", "failures", "suspended-transactions",
        "valuation-requests", "property-inspection", "government-review",
        "valuation-coordination", "property-appraisal", "active-survey",
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
    ];

    public static bool IsSuperAdminIdentityRole(string role) =>
        string.Equals(role, "CDO", StringComparison.OrdinalIgnoreCase)
        || string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase);

    private static readonly Dictionary<string, string[]> IdentityRolePages = new(StringComparer.OrdinalIgnoreCase)
    {
        ["CDO"] = AllPages.ToArray(),
        ["HrAdmin"] = ["dashboard", "users", "system-fields-catalog", "system-screen-catalog"],
        ["ProcAdmin"] = ["dashboard", "users", "system-fields-catalog", "system-screen-catalog"],
        ["CrmAdmin"] = ["dashboard", "users", "system-fields-catalog", "system-screen-catalog"],
        ["HR"] = ["dashboard", "users"],
        ["PROC"] = ["dashboard", "users"],
        ["CRM"] = ["dashboard", "users"],
    };

    private static readonly Dictionary<string, string[]> PrototypeRolePages = new(StringComparer.OrdinalIgnoreCase)
    {
        ["cdo"] = AllPages.ToArray(),
        ["hr-admin"] = ["dashboard", "users", "system-fields-catalog", "system-screen-catalog"],
        ["proc-admin"] = ["dashboard", "users", "system-fields-catalog", "system-screen-catalog"],
        ["crm-admin"] = ["dashboard", "users", "system-fields-catalog", "system-screen-catalog"],
        ["general-manager"] =
        [
            "dashboard", "po", "active-primary-data", "bourse-inquiry", "active-distribution",
            "active-case-study", "survey", "keys", "failures", "suspended-transactions",
            "valuation-requests", "system-fields-catalog", "system-screen-catalog",
            "financial", "kpi", "users", "courts", "failure-types", "case-study-info-roles",
        ],
        ["section-supervisor"] =
        [
            "dashboard", "po", "active-primary-data", "bourse-inquiry", "active-distribution",
            "active-case-study", "keys", "failures", "suspended-transactions", "failure-types",
            "system-fields-catalog", "system-screen-catalog",
        ],
        ["case-specialist"] =
        [
            "dashboard", "po", "active-primary-data", "bourse-inquiry", "active-distribution",
            "active-case-study", "failures", "suspended-transactions",
            "system-fields-catalog", "system-screen-catalog",
        ],
        ["valuation-coordinator"] =
        [
            "dashboard", "valuation-coordination",
            "system-fields-catalog", "system-screen-catalog",
        ],
        ["real-estate-appraiser"] =
        [
            "dashboard", "po", "property-appraisal", "suspended-transactions",
            "system-fields-catalog", "system-screen-catalog",
        ],
        ["field-inspector"] =
        [
            "dashboard", "property-inspection",
            "system-fields-catalog", "system-screen-catalog",
        ],
        ["government-reviewer"] =
        [
            "dashboard", "government-review", "keys",
            "system-fields-catalog", "system-screen-catalog",
        ],
        ["engineering-office"] =
        [
            "dashboard", "active-survey",
            "system-fields-catalog", "system-screen-catalog",
        ],
        ["financial-officer"] =
        [
            "dashboard", "financial",
            "system-fields-catalog", "system-screen-catalog",
        ],
    };

    private static readonly Dictionary<string, string[]> IdentityRoleCapabilities = new(StringComparer.OrdinalIgnoreCase)
    {
        ["CDO"] = AllCapabilities.ToArray(),
        ["HrAdmin"] = ["manage-users"],
        ["ProcAdmin"] = ["manage-users"],
        ["CrmAdmin"] = ["manage-users"],
    };

    private static readonly Dictionary<string, string[]> PrototypeRoleCapabilities = new(StringComparer.OrdinalIgnoreCase)
    {
        ["cdo"] = AllCapabilities.ToArray(),
        ["hr-admin"] = ["manage-users"],
        ["proc-admin"] = ["manage-users"],
        ["crm-admin"] = ["manage-users"],
        ["general-manager"] =
        [
            "manage-valuation-requests", "manage-failures", "manage-work-orders",
            "submit-party-work", "manage-attachments", "manage-financial", "manage-operations",
        ],
        ["section-supervisor"] =
        [
            "manage-failures", "manage-work-orders", "submit-party-work",
            "manage-attachments", "manage-operations",
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

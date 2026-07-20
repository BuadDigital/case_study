using RealEstateEval.Domain;

namespace RealEstateEval.Infrastructure.Permissions;

/// <summary>
/// Maps identity roles + HR job titles to English prototype role ids (RoleId).
/// Job-title mapping is an exact allowlist from seeded prototype users only — no fuzzy matching.
/// </summary>
public static class PrototypeRoleResolver
{
    /// <summary>
    /// Exact JobTitle values from DataSeeder / login user switcher → English RoleId.
    /// </summary>
    private static readonly Dictionary<string, string> ExactJobTitleToRoleId = new(StringComparer.Ordinal)
    {
        ["مسؤول التحول الرقمي (CDO)"] = "cdo",
        ["أخصائية موارد بشرية"] = "hr-admin",
        ["مدير المالية والعقود"] = "proc-admin",
        ["مدير علاقات العملاء"] = "crm-admin",
        ["مدير إدارة التقييم العقاري"] = "general-manager",
        ["مشرف قسم دراسة الحالة"] = "section-supervisor",
        ["أخصائي دراسة حالة"] = "case-specialist",
        ["مراجع حكومي"] = "government-reviewer",
        ["منسق عمليات التقييم"] = "valuation-coordinator",
        ["مقيم عقاري"] = "real-estate-appraiser",
        ["معاين ميداني"] = "field-inspector",
        ["موظف الشؤون المالية"] = "financial-officer",
        ["مقدم خدمة — جهة"] = "engineering-office",
    };

    public static string? Resolve(UserProfile? profile, IReadOnlyList<string> identityRoles)
    {
        if (identityRoles.Any(PlatformPermissionCatalog.IsSuperAdminIdentityRole))
            return "cdo";

        foreach (var role in identityRoles)
        {
            if (string.Equals(role, OrgRoles.HrAdmin, StringComparison.OrdinalIgnoreCase))
                return "hr-admin";
            if (string.Equals(role, OrgRoles.ProcAdmin, StringComparison.OrdinalIgnoreCase))
                return "proc-admin";
            if (string.Equals(role, OrgRoles.CrmAdmin, StringComparison.OrdinalIgnoreCase))
                return "crm-admin";
        }

        var level = profile?.PermissionLevel?.Trim().ToLowerInvariant();
        if (level == "cdo")
            return "cdo";

        return ResolveFromJobTitle(profile?.JobTitle);
    }

    private static string? ResolveFromJobTitle(string? jobTitle)
    {
        if (string.IsNullOrWhiteSpace(jobTitle))
            return null;

        return ExactJobTitleToRoleId.TryGetValue(jobTitle.Trim(), out var roleId)
            ? roleId
            : null;
    }
}

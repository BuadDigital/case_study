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

    /// <summary>Prototype roles the CDO can assign when creating staff.</summary>
    public static readonly IReadOnlyList<string> CreatableStaffRoleIds =
    [
        "cdo",
        "general-manager",
        "section-supervisor",
        "case-specialist",
        "government-reviewer",
        "valuation-coordinator",
        "real-estate-appraiser",
        "field-inspector",
        "financial-officer",
    ];

    public static bool IsCreatableStaffRoleId(string? roleId) =>
        !string.IsNullOrWhiteSpace(roleId)
        && CreatableStaffRoleIds.Contains(roleId.Trim(), StringComparer.Ordinal);

    public static string? JobTitleForRoleId(string? roleId)
    {
        if (string.IsNullOrWhiteSpace(roleId))
            return null;

        var trimmed = roleId.Trim();
        foreach (var (jobTitle, mappedRoleId) in ExactJobTitleToRoleId)
        {
            if (string.Equals(mappedRoleId, trimmed, StringComparison.Ordinal))
                return jobTitle;
        }

        return null;
    }

    public static string? Resolve(UserProfile? profile, IReadOnlyList<string> identityRoles)
    {
        if (identityRoles.Any(PlatformPermissionCatalog.IsSuperAdminIdentityRole))
            return "cdo";

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

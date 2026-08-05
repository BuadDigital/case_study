using RealEstateEval.Domain;

namespace RealEstateEval.Infrastructure.Permissions;

/// <summary>
/// Resolves the one canonical product role stored on the user profile.
/// Job titles are display metadata and never grant permissions.
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
        "real-estate-appraiser",
        "field-inspector",
        "financial-officer",
        "engineering-office",
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

    /// <summary>Seed/migration compatibility only; authorization never calls this method.</summary>
    public static string? LegacyRoleIdForJobTitle(string? jobTitle) =>
        string.IsNullOrWhiteSpace(jobTitle)
            ? null
            : ExactJobTitleToRoleId.GetValueOrDefault(jobTitle.Trim());

    public static string? Resolve(UserProfile? profile, IReadOnlyList<string> identityRoles)
    {
        if (identityRoles.Any(PlatformPermissionCatalog.IsSuperAdminIdentityRole))
            return "cdo";

        var roleId = profile?.RoleId?.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(roleId))
            return null;

        return ExactJobTitleToRoleId.Values.Contains(roleId, StringComparer.Ordinal)
            ? roleId
            : null;
    }
}

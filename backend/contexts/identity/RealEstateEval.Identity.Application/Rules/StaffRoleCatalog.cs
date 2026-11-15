using RealEstateEval.Domain;

namespace RealEstateEval.Identity.Application.Rules;

/// <summary>
/// The staff role catalog: the canonical product role ids an administrator may assign and the
/// Arabic job title each one displays. Pure data with no permission or persistence dependency,
/// so the registration use case can validate and label a role without leaving Application.
/// <c>PrototypeRoleResolver</c> in Infrastructure forwards to this catalog, which keeps the
/// seed/authorization callers on one list (solid-scorecard finding 3).
/// </summary>
public static class StaffRoleCatalog
{
 /// <summary>
 /// Exact JobTitle values from DataSeeder / login user switcher → English RoleId.
 /// </summary>
    private static readonly Dictionary<string, string> ExactJobTitleToRoleId =
        new(StringComparer.Ordinal)
        {
            ["مسؤول التحول الرقمي (CDO)"] = StaffRoleIds.Cdo,
            ["المدير التنفيذي"] = StaffRoleIds.Cdo,
            ["مدير إدارة التقييم العقاري"] = StaffRoleIds.GeneralManager,
            ["مشرف قسم دراسة الحالة"] = StaffRoleIds.SectionSupervisor,
            ["أخصائي دراسة حالة"] = StaffRoleIds.CaseSpecialist,
            ["مراجع حكومي"] = StaffRoleIds.GovernmentReviewer,
            ["مقيم عقاري"] = StaffRoleIds.RealEstateAppraiser,
            ["معاين ميداني"] = StaffRoleIds.FieldInspector,
            ["موظف الشؤون المالية"] = StaffRoleIds.FinancialOfficer,
            ["مقدم خدمة — جهة"] = StaffRoleIds.EngineeringOffice,
        };

 /// <summary>Prototype roles the CDO can assign when creating staff.</summary>
    public static readonly IReadOnlyList<string> CreatableStaffRoleIds =
    [
        StaffRoleIds.Cdo,
        StaffRoleIds.GeneralManager,
        StaffRoleIds.SectionSupervisor,
        StaffRoleIds.CaseSpecialist,
        StaffRoleIds.GovernmentReviewer,
        StaffRoleIds.RealEstateAppraiser,
        StaffRoleIds.FieldInspector,
        StaffRoleIds.FinancialOfficer,
        StaffRoleIds.EngineeringOffice,
    ];

    public static bool IsCreatableStaffRoleId(string? roleId) =>
        !string.IsNullOrWhiteSpace(roleId)
        && CreatableStaffRoleIds.Contains(roleId.Trim(), StringComparer.Ordinal);

 /// <summary>True when the id is one this catalog maps to a job title.</summary>
    public static bool IsKnownRoleId(string roleId) =>
        ExactJobTitleToRoleId.Values.Contains(roleId, StringComparer.Ordinal);

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
    public static string? RoleIdForJobTitle(string? jobTitle) =>
        string.IsNullOrWhiteSpace(jobTitle)
            ? null
            : ExactJobTitleToRoleId.GetValueOrDefault(jobTitle.Trim());
}

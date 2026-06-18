using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Permissions;

namespace RealEstateEval.Infrastructure.Permissions;

/// <summary>
/// Maps identity roles + HR profile fields to prototype role ids (aligned with app-shared ROLES).
/// </summary>
public static class PrototypeRoleResolver
{
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

        var fromTitle = ResolveFromJobTitle(profile?.JobTitle);
        if (fromTitle is not null)
            return fromTitle;

        if (profile?.RegistrationSource == RegistrationSource.Proc
            && identityRoles.Any(r => string.Equals(r, DepartmentRoles.Proc, StringComparison.OrdinalIgnoreCase)))
        {
            var serviceType = profile.ProcProvider?.ServiceType ?? "";
            if (serviceType.Contains("مسح", StringComparison.Ordinal)
                || serviceType.Contains("مساح", StringComparison.Ordinal))
                return "engineering-office";
        }

        return null;
    }

    private static string? ResolveFromJobTitle(string? jobTitle)
    {
        if (string.IsNullOrWhiteSpace(jobTitle))
            return null;

        var t = jobTitle.Trim();

        if (t.Contains("مسؤول التحول الرقمي", StringComparison.Ordinal)
            || t.Contains("CDO", StringComparison.OrdinalIgnoreCase))
            return "cdo";
        if (t.Contains("موارد بشرية", StringComparison.Ordinal))
            return "hr-admin";
        if (t.Contains("المالية والعقود", StringComparison.Ordinal))
            return "proc-admin";
        if (t.Contains("علاقات العملاء", StringComparison.Ordinal))
            return "crm-admin";
        if (t.Contains("مدير إدارة التقييم العقاري", StringComparison.Ordinal))
            return "general-manager";
        if (t.Contains("مشرف قسم دراسة الحالة", StringComparison.Ordinal))
            return "section-supervisor";
        if (t.Contains("أخصائي دراسة حالة", StringComparison.Ordinal))
            return "case-specialist";
        if (t.Contains("مراجع حكومي", StringComparison.Ordinal))
            return "government-reviewer";
        if (t.Contains("منسق عمليات التقييم", StringComparison.Ordinal))
            return "valuation-coordinator";
        if (t.Contains("مقيم عقاري", StringComparison.Ordinal))
            return "real-estate-appraiser";
        if (t.Contains("معاين ميداني", StringComparison.Ordinal))
            return "field-inspector";
        if (t.Contains("الشؤون المالية", StringComparison.Ordinal)
            || t.Contains("موظف الشؤون المالية", StringComparison.Ordinal))
            return "financial-officer";
        if (t.Contains("مساحة", StringComparison.Ordinal)
            || t.Contains("مسح ميداني", StringComparison.Ordinal)
            || t.Contains("مكتب", StringComparison.Ordinal) && t.Contains("مساح", StringComparison.Ordinal))
            return "engineering-office";

        return null;
    }
}

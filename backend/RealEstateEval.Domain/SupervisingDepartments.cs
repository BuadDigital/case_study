namespace RealEstateEval.Domain;

/// <summary>
/// Canonical department ids used by financial items and supervisor authority.
/// User profiles historically mixed free-text Arabic admin labels with section names; every
/// identity boundary normalizes those into one of these codes before authorization.
/// </summary>
public static class SupervisingDepartments
{
    public const string CaseStudy = "case_study";
    public const string Valuation = "valuation";
    public const string Finance = "finance_dept";
    public const string External = "external";

    /// <summary>
    /// Sentinel used only for fail-closed filtering when a section supervisor has no department.
    /// It never appears on a stamped ledger.
    /// </summary>
    public const string Unassigned = "__unassigned__";

    public static readonly IReadOnlySet<string> All = new HashSet<string>(StringComparer.Ordinal)
    {
        CaseStudy,
        Valuation,
        Finance,
        External,
    };

    public static readonly IReadOnlySet<string> SupervisorSelectable = new HashSet<string>(
        StringComparer.Ordinal)
    {
        CaseStudy,
        Valuation,
    };

    public static string ForTaskKind(WorkflowTaskKind taskKind) => taskKind switch
    {
        WorkflowTaskKind.FieldInspection
            or WorkflowTaskKind.EngineeringSurvey
            or WorkflowTaskKind.PropertyAppraisal
            or WorkflowTaskKind.ValuationCoordination => Valuation,
        _ => CaseStudy,
    };

    /// <summary>Department derived solely from a product role. Supervisors must choose explicitly.</summary>
    public static string? DeriveForRole(string? roleId) => roleId switch
    {
        "case-specialist" or "government-reviewer" => CaseStudy,
        "valuation-coordinator" or "real-estate-appraiser" or "field-inspector" => Valuation,
        "financial-officer" => Finance,
        "engineering-office" => External,
        "section-supervisor" => null,
        _ => null,
    };

    public static string? NormalizeProfileValue(string? value)
    {
        var normalized = value?.Trim();
        if (string.IsNullOrEmpty(normalized)) return null;

        return normalized.ToLowerInvariant() switch
        {
            CaseStudy or "قسم دراسة الحالة" => CaseStudy,
            Valuation or "قسم تقييم الأفراد" or "قسم التقييم" => Valuation,
            Finance or "قسم المحاسبة" or "المالية والعقود" or "الإدارة المالية" => Finance,
            External or "المكاتب الهندسية" or "الجهات الخارجية" => External,
            _ => null,
        };
    }

    /// <summary>
    /// Resolves the department a staff profile is allowed to hold. Section supervisors must pick
    /// <see cref="CaseStudy"/> or <see cref="Valuation"/>; every other role is derived server-side
    /// so a free-text override cannot invent authority.
    /// </summary>
    public static (string? Department, string? Error) ResolveForStaff(
        string roleId,
        string? requestedDepartment,
        string? fallbackSection = null)
    {
        if (roleId == "section-supervisor")
        {
            var selected = NormalizeProfileValue(requestedDepartment)
                ?? NormalizeProfileValue(fallbackSection);
            if (selected is null || !SupervisorSelectable.Contains(selected))
            {
                return (null, "يجب اختيار قسم المشرف: دراسة الحالة أو التقييم.");
            }

            return (selected, null);
        }

        return (DeriveForRole(roleId), null);
    }

    public static bool CanManage(
        string itemDepartment,
        string? actorDepartment,
        bool canManageAllDepartments)
    {
        if (canManageAllDepartments) return true;
        var normalizedActor = NormalizeProfileValue(actorDepartment);
        return normalizedActor is not null
               && string.Equals(itemDepartment, normalizedActor, StringComparison.Ordinal);
    }

    public static string DisplayLabel(string? department) =>
        NormalizeProfileValue(department) switch
        {
            CaseStudy => "قسم دراسة الحالة",
            Valuation => "قسم تقييم الأفراد",
            Finance => "قسم المحاسبة",
            External => "الجهات الخارجية",
            _ => department?.Trim() ?? "",
        };
}

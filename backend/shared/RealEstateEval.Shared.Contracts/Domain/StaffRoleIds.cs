namespace RealEstateEval.Domain;

/// <summary>
/// معرّفات الأدوار المعتمدة (ق٢: أسماء الكود هي القانونية — لا إعادة تسمية).
/// كانت الحرفيات متناثرة ومجموعة «المشرف فما فوق» منسوخة في ملفين.
/// ملاحظة: هذه معرّفات الأدوار — لا تُخلط بأبجدية أطراف مصفوفة المعلومات
/// (specA/insp/gov/val/eng/sup) ولا ببادئات معرّفات التوزيع (fi-/eo-/cs-…)،
/// فهي مفردات لمجالات مختلفة عمداً.
/// </summary>
public static class StaffRoleIds
{
    public const string Cdo = "cdo";
    public const string GeneralManager = "general-manager";
    public const string SectionSupervisor = "section-supervisor";
    public const string CaseSpecialist = "case-specialist";
    public const string GovernmentReviewer = "government-reviewer";
    public const string RealEstateAppraiser = "real-estate-appraiser";
    public const string FieldInspector = "field-inspector";
    public const string FinancialOfficer = "financial-officer";
    public const string EngineeringOffice = "engineering-office";

 /// <summary>مشرف القسم فما فوق — كانت منسوخة في أوامر التوزيع ودورة الحياة.</summary>
    public static readonly IReadOnlyList<string> SectionSupervisorOrAbove =
    [
        SectionSupervisor,
        GeneralManager,
        Cdo,
    ];
}

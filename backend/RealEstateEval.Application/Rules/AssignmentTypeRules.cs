namespace RealEstateEval.Application.Rules;

using RealEstateEval.Domain;

/// <summary>
/// قواعد أنواع الإسناد حسب مواصفة v2 (وسوم مركّبة على قيمة AssignmentType الحالية):
/// تنفيذ = تنفيذ/تنفيذ، تركات = تنفيذ/تركات، قطاع خاص = خاص/خاص.
/// </summary>
public static class AssignmentTypeRules
{
    /// <summary>مسار المحكمة: رقم الطلب + محكمة/دائرة + قرار إسناد + زيارات/مفاتيح.</summary>
    public static bool IsCourtPath(AssignmentType type) =>
        type == AssignmentType.Execution;

    public static bool RequiresRequestNumber(AssignmentType type) =>
        IsCourtPath(type);

    public static bool RequiresAssignmentDecree(AssignmentType type) =>
        IsCourtPath(type);

    public static bool RequiresCourtAndCircuit(AssignmentType type) =>
        IsCourtPath(type);

    /// <summary>ضابط الاتصال إجباري في التنفيذ والتركات، اختياري في الخاص.</summary>
    public static bool RequiresContacts(AssignmentType type) =>
        type != AssignmentType.PrivateSector;

    public static int BusinessDaysRequired(AssignmentType type) =>
        BusinessDaysRequired(
            type,
            BusinessDueDateCalculator.DefaultBusinessDays,
            BusinessDueDateCalculator.PrivateSectorBusinessDays);

    public static int BusinessDaysRequired(
        AssignmentType type,
        int defaultBusinessDays,
        int privateSectorBusinessDays) =>
        type == AssignmentType.PrivateSector
            ? Math.Max(1, privateSectorBusinessDays)
            : Math.Max(1, defaultBusinessDays);

    public static string PrimaryLabel(AssignmentType type) =>
        type == AssignmentType.PrivateSector ? "خاص" : "تنفيذ";

    public static string SecondaryLabel(AssignmentType type) => type switch
    {
        AssignmentType.Estates => "تركات",
        AssignmentType.PrivateSector => "خاص",
        _ => "تنفيذ",
    };

    public static string CompositeTag(AssignmentType type) =>
        $"{PrimaryLabel(type)} / {SecondaryLabel(type)}";
}

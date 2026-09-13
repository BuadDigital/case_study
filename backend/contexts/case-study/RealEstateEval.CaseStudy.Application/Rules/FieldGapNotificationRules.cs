using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Application.Rules;

/// <summary>
/// Who is asked about a field the valuation report prints empty: the person who supplies that
/// information — the work order's assignment specialist for «البيانات الأولية», the property's
/// field inspector, or its engineering office — never a system-wide role.
/// </summary>
public static class FieldGapNotificationRules
{
    public const string Intake = "intake";
    public const string Inspector = "inspector";
    public const string Survey = "survey";

    /// <summary>Normalized source (empty means intake), or null when the source is unknown.</summary>
    public static string? NormalizeSource(string? source) =>
        (source ?? "").Trim().ToLowerInvariant() switch
        {
            "" or Intake => Intake,
            Inspector => Inspector,
            Survey => Survey,
            _ => null,
        };

    /// <summary>Party task that supplied the source's data; null for intake (work-order header).</summary>
    public static WorkflowTaskKind? TaskKind(string source) =>
        source switch
        {
            Inspector => WorkflowTaskKind.FieldInspection,
            Survey => WorkflowTaskKind.EngineeringSurvey,
            _ => null,
        };

    public static string RoleLabel(string source) =>
        source switch
        {
            Inspector => "المعاين",
            Survey => "المكتب الهندسي",
            _ => "أخصائي الإسناد",
        };

    public static string Title(string source) =>
        source switch
        {
            Inspector => "نقص في بيانات المعاينة",
            Survey => "نقص في بيانات الرفع المساحي",
            _ => "نقص في البيانات الأولية",
        };

    public static string NoRecipientsError(string source) =>
        $"لا يوجد {RoleLabel(source)} مسند لهذه المعلومة يمكن إشعاره.";

    /// <summary>
    /// Latest non-cancelled task of <paramref name="kind"/> that has an assignee. A completed
    /// task keeps its owner — the inspector who submitted is still the one to ask.
    /// </summary>
    public static WorkflowTask? ResponsibleTask(IEnumerable<WorkflowTask> tasks, WorkflowTaskKind kind) =>
        tasks
            .Where(t => t.Kind == kind
                && t.Status != WorkflowTaskStatus.Cancelled
                && !string.IsNullOrWhiteSpace(t.AssigneeId))
            .OrderByDescending(t => t.UpdatedAtUtc)
            .FirstOrDefault();

    public static string SourceEvent(string source, Guid propertyId, string fieldKey) =>
        $"{source}-field-gap:{propertyId:N}:{fieldKey}";
}

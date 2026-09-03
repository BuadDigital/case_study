namespace RealEstateEval.Domain;

/// <summary>
/// Arabic surfaces for <see cref="WorkflowTaskKind"/> labels — four maps were scattered around
/// In both case study and financial contexts. Surfaces are intended to be different (designation title ≠ financial classification),
/// But adding a new task type becomes an edit in one file.
/// </summary>
public static class WorkflowTaskKindLabels
{
 /// <summary>Title of the Party Assigned event in the transaction timeline.</summary>
    public static string AssignedTitleAr(WorkflowTaskKind kind) => kind switch
    {
        WorkflowTaskKind.FieldInspection => "تعيين المعاين الميداني",
        WorkflowTaskKind.EngineeringSurvey => "تعيين المكتب الهندسي",
        WorkflowTaskKind.PropertyAppraisal => "تعيين المقيّم العقاري",
 // Legacy government-review child tasks (no longer spawned).
        WorkflowTaskKind.GovernmentReview => "تعيين المراجع الحكومي",
        _ => "تعيين طرف",
    };

 /// <summary>“Party Work Complete” event title — wire keys as stored in submissions.</summary>
    public static string SubmittedTitleAr(string kind) => kind switch
    {
        WorkflowTaskKindValues.FieldInspection => "إتمام المعاينة الميدانية",
        WorkflowTaskKindValues.EngineeringSurvey => "إتمام الرفع المساحي",
        WorkflowTaskKindValues.PropertyAppraisal => "إتمام التقييم العقاري",
 // Legacy government-review submissions (product surface removed).
        WorkflowTaskKindValues.GovernmentReview => "إتمام المراجعة الحكومية",
        _ => "إتمام عمل الطرف",
    };

 /// <summary>Task name in distribution notifications.</summary>
    public static string NotificationLabelAr(WorkflowTaskKind kind) => kind switch
    {
        WorkflowTaskKind.FieldInspection => "معاينة العقار",
        WorkflowTaskKind.EngineeringSurvey => "الرفع المساحي",
        WorkflowTaskKind.PropertyAppraisal => "تقييم العقار",
        _ => "مهمة جديدة",
    };

 /// <summary>Brief classification in financial reports.</summary>
    public static string CategoryLabelAr(WorkflowTaskKind? kind) => kind switch
    {
        WorkflowTaskKind.FieldInspection => "معاينة",
        WorkflowTaskKind.EngineeringSurvey => "رفع مساحي",
        WorkflowTaskKind.GovernmentReview => "مراجعة حكومية",
        WorkflowTaskKind.PropertyAppraisal => "تقييم",
        _ => "أخرى",
    };
}

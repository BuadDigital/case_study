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

 /// <summary>Timeline title when the final valuation report is issued and the appraisal task completes.</summary>
    public const string AppraisalCompletedTitleAr = "إتمام التقييم العقاري";

 /// <summary>“Party Work Complete” event title — wire keys as stored in submissions.</summary>
    public static string SubmittedTitleAr(string kind) => kind switch
    {
        WorkflowTaskKindValues.FieldInspection => "إتمام المعاينة الميدانية",
        WorkflowTaskKindValues.EngineeringSurvey => "إتمام الرفع المساحي",
        // The appraiser hands the package to the case specialist; the task completes later, at the
        // final issuance of the valuation report (see <see cref="AppraisalCompletedTitleAr"/>).
        WorkflowTaskKindValues.PropertyAppraisal => "تسليم التقييم للأخصائي",
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

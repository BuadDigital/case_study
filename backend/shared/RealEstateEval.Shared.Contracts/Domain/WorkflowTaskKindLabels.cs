namespace RealEstateEval.Domain;

/// <summary>
/// الأسطح العربية لتسميات <see cref="WorkflowTaskKind"/> — كانت أربع خرائط متناثرة
/// في سياقي دراسة الحالة والمالية. السطوح مقصودة الاختلاف (عنوان تعيين ≠ تصنيف مالي)،
/// لكن إضافة نوع مهمة جديد صارت تحريراً في ملف واحد.
/// </summary>
public static class WorkflowTaskKindLabels
{
 /// <summary>عنوان حدث «تعيين الطرف» في الجدول الزمني للمعاملة.</summary>
    public static string AssignedTitleAr(WorkflowTaskKind kind) => kind switch
    {
        WorkflowTaskKind.FieldInspection => "تعيين المعاين الميداني",
        WorkflowTaskKind.EngineeringSurvey => "تعيين المكتب الهندسي",
        WorkflowTaskKind.PropertyAppraisal => "تعيين المقيّم العقاري",
 // Legacy government-review child tasks (no longer spawned).
        WorkflowTaskKind.GovernmentReview => "تعيين المراجع الحكومي",
        _ => "تعيين طرف",
    };

 /// <summary>عنوان حدث «إتمام عمل الطرف» — مفاتيح wire كما تُخزَّن في الإرسالات.</summary>
    public static string SubmittedTitleAr(string kind) => kind switch
    {
        WorkflowTaskKindValues.FieldInspection => "إتمام المعاينة الميدانية",
        WorkflowTaskKindValues.EngineeringSurvey => "إتمام الرفع المساحي",
        WorkflowTaskKindValues.PropertyAppraisal => "إتمام التقييم العقاري",
 // Legacy government-review submissions (product surface removed).
        WorkflowTaskKindValues.GovernmentReview => "إتمام المراجعة الحكومية",
        _ => "إتمام عمل الطرف",
    };

 /// <summary>اسم المهمة في إشعارات التوزيع.</summary>
    public static string NotificationLabelAr(WorkflowTaskKind kind) => kind switch
    {
        WorkflowTaskKind.FieldInspection => "معاينة العقار",
        WorkflowTaskKind.EngineeringSurvey => "الرفع المساحي",
        WorkflowTaskKind.PropertyAppraisal => "تقييم العقار",
        _ => "مهمة جديدة",
    };

 /// <summary>تصنيف مختصر في التقارير المالية.</summary>
    public static string CategoryLabelAr(WorkflowTaskKind? kind) => kind switch
    {
        WorkflowTaskKind.FieldInspection => "معاينة",
        WorkflowTaskKind.EngineeringSurvey => "رفع مساحي",
        WorkflowTaskKind.GovernmentReview => "مراجعة حكومية",
        WorkflowTaskKind.PropertyAppraisal => "تقييم",
        _ => "أخرى",
    };
}

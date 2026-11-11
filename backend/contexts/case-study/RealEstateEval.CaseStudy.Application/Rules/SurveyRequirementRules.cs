using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Rules;

/// <summary>
/// When an engineering survey (cadastral survey) is required for a property.
/// Infath circular: no survey for lots inside an approved organizational plan
/// (plan number + plot number); survey is only for properties outside those plans.
/// </summary>
public static class SurveyRequirementRules
{
    public const string UnitInsideBuildingClassification = "وحدة داخل مبنى";

    /// <summary>
    /// Asked of whoever adds the engineering office to a property this rule asks no survey for
    /// (Omar 2026-11-11: the exception is allowed after the distribution, with its reason on record).
    /// </summary>
    public const string ExceptionReasonRequiredAr =
        "العقار لا يحتاج رفعاً مساحياً بحسب القاعدة — اذكر سبب طلب الرفع المساحي لإسناد المكتب استثناءً";

    public static bool ClassificationRequiresSurvey(string? classification) =>
        !string.Equals(
            classification?.Trim(),
            UnitInsideBuildingClassification,
            StringComparison.Ordinal);

    /// <summary>Registered title — identifier, registration number, or registered-title deed kind.</summary>
    public static bool HasRegisteredTitle(WorkOrderProperty prop) =>
        prop.IdentifierType == PropertyIdentifierType.RealEstateRegistration
        || !string.IsNullOrWhiteSpace(prop.RealEstateRegNumber)
        || prop.DeedKind == DeedKind.RegisteredTitle;

    /// <summary>
    /// Both plan and plot are present — the property sits on an approved subdivision.
    /// </summary>
    public static bool HasApprovedOrganizationalPlan(string? planNumber, string? plotNumber) =>
        PartyTaskSubmissionPayloadRules.HasPlanAndPlot(planNumber, plotNumber);

    /// <summary>
    /// The classification the survey rule reads: the inspector's corrected type's classification
    /// (2026-10-29), else the bourse classification.
    /// </summary>
    public static string? EffectiveClassification(WorkOrderProperty prop) =>
        PropertyTypeCatalog.ClassificationOf(prop.InspectedPropertyType) ?? prop.Classification;

    public static bool PropertyRequiresSurvey(WorkOrderProperty prop) =>
        ClassificationRequiresSurvey(EffectiveClassification(prop))
        && !HasRegisteredTitle(prop)
        && !HasApprovedOrganizationalPlan(prop.PlanNumber, prop.PlotNumber);

    /// <summary>
    /// The inspector's type differs from the bourse type (2026-10-29: he corrects it on site).
    /// How it works: a non-empty inspected type that is not the bourse <c>PropertyType</c> (trimmed, ordinal).
    /// Edge cases: an inspector who picked the bourse type again has made no change.
    /// </summary>
    public static bool InspectorChangedType(WorkOrderProperty prop) =>
        !string.IsNullOrWhiteSpace(prop.InspectedPropertyType)
        && !string.Equals(
            prop.InspectedPropertyType.Trim(),
            (prop.PropertyType ?? "").Trim(),
            StringComparison.Ordinal);

    /// <summary>
    /// The inspector's corrected type needs a survey and no survey task is live — the timeline says «بانتظار
    /// إضافة المكتب الهندسي» and the specialist is notified; it never blocks issuing the study (Omar
    /// 2026-11-04). The office is added from «مهمة جديدة», type «رفع مساحي» (Omar 2026-11-11), which is
    /// offered whenever the property needs a survey and none is live — not only after a type change.
    /// How it works: the inspector changed the type (<see cref="InspectorChangedType"/>), the property under
    /// that type needs a survey (<see cref="PropertyRequiresSurvey"/>), and no survey task is live.
    /// Edge cases: fixed A→Z 2026-11-02 #74 — this used to skip a property whose bourse type already needed a
    /// survey («left to the distribution»), while the submit still asked the specialist for the office (a land
    /// changed to «استراحة» showed no note). Now the ask and the note read this one rule. No type change, or a
    /// property that needs no survey (registered title / approved plan / unit), asks nothing.
    /// </summary>
    public static bool SurveyMissingAfterTypeChange(WorkOrderProperty prop, bool hasLiveSurveyTask) =>
        !hasLiveSurveyTask
        && InspectorChangedType(prop)
        && PropertyRequiresSurvey(prop);
}

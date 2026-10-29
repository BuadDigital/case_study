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
    /// The inspector's corrected type made a survey necessary that the bourse type did not need, and no
    /// survey task is live — the study waits for the specialist to add the engineering office.
    /// Edge cases: a property the bourse type already required a survey for is left to the distribution
    /// as before (the office may have been left out there on purpose).
    /// </summary>
    public static bool SurveyMissingAfterTypeChange(WorkOrderProperty prop, bool hasLiveSurveyTask) =>
        !hasLiveSurveyTask
        && PropertyRequiresSurvey(prop)
        && !ClassificationRequiresSurvey(prop.Classification);
}

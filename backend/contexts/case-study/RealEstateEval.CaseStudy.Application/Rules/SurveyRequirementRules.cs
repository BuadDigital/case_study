using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Rules;

/// <summary>
/// When an engineering survey (cadastral survey) is required for a property.
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

    public static bool PropertyRequiresSurvey(WorkOrderProperty prop) =>
        ClassificationRequiresSurvey(prop.Classification) && !HasRegisteredTitle(prop);
}

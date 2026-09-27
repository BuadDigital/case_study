using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Rules;

/// <summary>
/// «مكونات العقار» is the case specialist's: a report text written from the inspector's
/// description (text or photo) plus the components table the appraiser's direct costs start
/// from. Both must be in place before the specialist accepts the field inspection.
/// </summary>
public static class SpecialistComponentsRules
{
    public const int TextMaxLength = 8000;

    public const string TextRequired = "اكتب «مكونات العقار» للتقرير قبل قبول المعاينة";
    public const string LinesRequired = "أضف بنود جدول المكونات قبل قبول المعاينة";

    /// <summary>
    /// First reason the field inspection cannot be accepted yet; null when ready. The table is
    /// optional on land (a fence or a guard room is listed when present).
    /// </summary>
    public static string? MissingForAcceptance(WorkOrderProperty property)
    {
        if (string.IsNullOrWhiteSpace(property.SpecialistComponentsText))
            return TextRequired;

        var isLand = InspectedPropertyTypeRules.IsLand(
            string.IsNullOrWhiteSpace(property.InspectedPropertyType)
                ? property.PropertyType
                : property.InspectedPropertyType);
        return !isLand && property.BuildingInventoryLines.Count == 0 ? LinesRequired : null;
    }
}

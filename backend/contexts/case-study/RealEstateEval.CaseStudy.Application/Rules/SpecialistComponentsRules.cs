using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Rules;

/// <summary>
/// «مكونات العقار» is the case specialist's: a report text written from the inspector's
/// description (text or photo), plus an optional components table the appraiser's direct
/// costs can start from. The report text is required before accepting the field inspection;
/// the table is optional — listed when present, and the appraiser decides what enters value.
/// </summary>
public static class SpecialistComponentsRules
{
    public const int TextMaxLength = 8000;

    public const string TextRequired = "اكتب «مكونات العقار» للتقرير قبل قبول المعاينة";

    /// <summary>
    /// First reason the field inspection cannot be accepted yet; null when ready.
    /// The components table is optional on buildings and land alike.
    /// </summary>
    public static string? MissingForAcceptance(WorkOrderProperty property)
    {
        if (string.IsNullOrWhiteSpace(property.SpecialistComponentsText))
            return TextRequired;

        return null;
    }
}

namespace RealEstateEval.Domain;

/// <summary>
/// Routes property-library uploads onto valuation-report sections from the upload scope.
/// </summary>
public static class AttachmentPrintRules
{
    public static string? TypeKeyFromScope(string? scope)
    {
        var s = (scope ?? "").Trim().ToLowerInvariant();
        return s switch
        {
            "property-decree" or "property-deed-ownership" or "property-registry"
                or "property-delegation" or "property-bourse-deed" => "deed",
            "engineering-survey-report" or "property-boundaries" => "survey",
            "field-inspection-photo" => "photo",
            "engineering-site-letter" => "site-map",
            _ when s.Contains("photo", StringComparison.Ordinal) => "photo",
            _ when s.Contains("deed", StringComparison.Ordinal)
                || s.Contains("decree", StringComparison.Ordinal)
                || s.Contains("registry", StringComparison.Ordinal) => "deed",
            _ when s.Contains("survey", StringComparison.Ordinal)
                || s.Contains("boundar", StringComparison.Ordinal) => "survey",
            _ when s.Contains("map", StringComparison.Ordinal)
                || s.Contains("permit", StringComparison.Ordinal)
                || s.Contains("zoning", StringComparison.Ordinal) => "site-map",
            _ => null,
        };
    }

    /// <summary>
    /// Maps type key → approved report section number (22–25).
    /// Unknown keys return null.
    /// </summary>
    public static int? ReportSectionNumber(string? typeKey)
    {
        var key = (typeKey ?? "").Trim().ToLowerInvariant();
        return key switch
        {
            "deed" => 25,
            "survey" => 24,
            "photo" or "photos" or "property-photo" => 23,
            "zoning-sketch" or "building-permit" or "site-map" or "map" => 22,
            _ => null,
        };
    }

    public static int PhotoBudget(bool hasStructuresToValue) =>
        hasStructuresToValue ? 12 : 6;

    public static string LabelArForTypeKey(string? typeKey) =>
        (typeKey ?? "").Trim().ToLowerInvariant() switch
        {
            "deed" => "الصك",
            "survey" => "الرفع المساحي",
            "photo" or "photos" or "property-photo" => "صور العقار",
            "zoning-sketch" => "الكروكي التنظيمي",
            "building-permit" => "رخصة المباني",
            "site-map" or "map" => "خريطة الموقع",
            _ => string.IsNullOrWhiteSpace(typeKey) ? "مرفق" : typeKey.Trim(),
        };
}

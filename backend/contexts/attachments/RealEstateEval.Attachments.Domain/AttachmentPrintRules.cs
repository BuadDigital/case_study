using RealEstateEval.Domain;

namespace RealEstateEval.Attachments.Domain;

/// <summary>
/// Routes property-library uploads onto valuation-report sections — from the stored document
/// type when there is one, else from the upload scope.
/// </summary>
public static class AttachmentPrintRules
{
    /// <summary>Print type of an upload whose document type may not be stored yet.</summary>
    public static string? TypeKeyFromScope(string? scope) => TypeKeyFor(scope, null);

    /// <summary>
    /// Registry types decide first: an assignment or delegation letter is never printed as the
    /// deed. Scopes the registry does not know keep the older name-based routing.
    /// </summary>
    public static string? TypeKeyFor(string? scope, string? documentTypeKey, string? scopeKey = null)
    {
        var type = PropertyDocumentTypes.Resolve(documentTypeKey, scope, scopeKey);
        return type is not null ? PrintTypeKey(type.Key) : LegacyTypeKeyFromScope(scope);
    }

    /// <summary>Report section family of a registry document type; null when it is not printed.</summary>
    public static string? PrintTypeKey(string? documentTypeKey) =>
        (documentTypeKey ?? "").Trim().ToLowerInvariant() switch
        {
            "deed" or "bourse-deed" or "real-estate-registry" => "deed",
            "survey" => "survey",
            "inspection-photo" => "photo",
            "site-letter" => "site-map",
            "building-permit" => "building-permit",
            "zoning-sketch" => "zoning-sketch",
            _ => null,
        };

    private static string? LegacyTypeKeyFromScope(string? scope)
    {
        var s = (scope ?? "").Trim().ToLowerInvariant();
        return s switch
        {
            _ when s.Contains("photo", StringComparison.Ordinal) => "photo",
            _ when s.Contains("deed", StringComparison.Ordinal)
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

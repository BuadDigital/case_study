namespace RealEstateEval.Domain;

/// <summary>
/// Report-print eligibility: library ≠ report. Only classified + print-marked attachments print.
/// </summary>
public static class AttachmentPrintRules
{
    public static bool IsPrintable(string? dictionaryTypeKey, bool printInReport) =>
        printInReport && !string.IsNullOrWhiteSpace(dictionaryTypeKey);

    /// <summary>
    /// Maps dictionary type key → approved report section number (22–25).
    /// Unknown keys return null (library/print-marked but not routed).
    /// </summary>
    public static int? ReportSectionNumber(string? dictionaryTypeKey)
    {
        var key = (dictionaryTypeKey ?? "").Trim().ToLowerInvariant();
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

    public static string LabelArForTypeKey(string? dictionaryTypeKey) =>
        (dictionaryTypeKey ?? "").Trim().ToLowerInvariant() switch
        {
            "deed" => "الصك",
            "survey" => "الرفع المساحي",
            "photo" or "photos" or "property-photo" => "صور العقار",
            "zoning-sketch" => "الكروكي التنظيمي",
            "building-permit" => "رخصة المباني",
            "site-map" or "map" => "خريطة الموقع",
            _ => string.IsNullOrWhiteSpace(dictionaryTypeKey) ? "مرفق" : dictionaryTypeKey.Trim(),
        };
}

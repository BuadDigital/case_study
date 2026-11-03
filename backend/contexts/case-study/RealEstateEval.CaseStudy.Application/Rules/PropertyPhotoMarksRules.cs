using System.Text.Json;
using RealEstateEval.Application.Contracts;

namespace RealEstateEval.CaseStudy.Application.Rules;

/// <summary>
/// The case specialist's marks on the inspector's photos (2026-11-01 ruling): one main photo, the
/// electricity and water meters, the movables (2026-11-02), and the photos the report prints with
/// their section (1 exterior, 2 interior, 3 other), in the specialist's board order since 2026-11-03.
/// </summary>
public static class PropertyPhotoMarksRules
{
    /// <summary>
    /// The most the report can print: four pages of six, the settings' highest «صفحات الصور». The
    /// page count the settings hold today is the screen's to apply.
    /// </summary>
    public const int ReportPhotoLimit = 24;

    /// <summary>The report's «صور المنقولات» section prints one page of six (2026-11-03).</summary>
    public const int MovablesPhotoLimit = 6;

    /// <summary>The report's photo sections: 1 exterior, 2 interior, 3 other.</summary>
    public const int FirstReportSection = 1;
    public const int LastReportSection = 3;

    private const int IdMaxLength = 64;
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    /// <summary>
    /// The stored marks.
    /// How it works: reads the jsonb column and drops blank or repeated ids.
    /// Edge cases: an empty or broken column reads as no marks, so the automatic order applies.
    /// </summary>
    public static PropertyPhotoMarksDto Parse(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new PropertyPhotoMarksDto();
        try
        {
            return Clean(JsonSerializer.Deserialize<PropertyPhotoMarksDto>(json, Json));
        }
        catch (JsonException)
        {
            return new PropertyPhotoMarksDto();
        }
    }

    /// <summary>The column value; marks with nothing in them store null.</summary>
    public static string? Serialize(PropertyPhotoMarksDto marks)
    {
        var clean = Clean(marks);
        var empty = clean.Main is null
            && clean.Electricity.Count == 0
            && clean.Water.Count == 0
            && clean.Movables.Count == 0
            && clean.Report.Count == 0;
        return empty ? null : JsonSerializer.Serialize(clean, Json);
    }

    /// <summary>
    /// Why these marks cannot be saved; empty when they can.
    /// How it works: a photo holds one role (main, electricity, water or movables); being in the
    /// report is separate from the role, so a meter can still print. A section is 1, 2 or 3.
    /// Edge cases: blank and repeated ids are cleaned first and never count as errors; a section
    /// for a photo outside the report is dropped, not refused, so unticking a photo never fails.
    /// </summary>
    public static Dictionary<string, string> Validate(PropertyPhotoMarksDto marks)
    {
        var clean = Clean(marks);
        var errors = new Dictionary<string, string>();
        var roles = clean.Electricity.Concat(clean.Water).Concat(clean.Movables).ToList();
        if (clean.Main is not null) roles.Add(clean.Main);

        if (roles.Concat(clean.Report).Any(id => id.Length > IdMaxLength))
            errors["_"] = "رقم الصورة غير صالح";
        if (roles.Count != roles.Distinct(StringComparer.Ordinal).Count())
            errors["_"] = "الصورة الواحدة تحمل تمييزاً واحداً: رئيسية أو عداد كهرباء أو عداد ماء أو منقولات";
        if (clean.Report.Count > ReportPhotoLimit)
            errors["report"] = $"التقرير يطبع {ReportPhotoLimit} صورة كحد أقصى";
        if (clean.Movables.Count > MovablesPhotoLimit)
            errors["movables"] = $"قسم صور المنقولات يطبع {MovablesPhotoLimit} صور كحد أقصى";
        if ((marks.ReportSections ?? []).Values.Any(n => n is < FirstReportSection or > LastReportSection))
            errors["reportSections"] = "قسم الصورة في التقرير: 1 خارجية أو 2 داخلية أو 3 أخرى";
        return errors;
    }

    private static PropertyPhotoMarksDto Clean(PropertyPhotoMarksDto? marks) => new()
    {
        Main = string.IsNullOrWhiteSpace(marks?.Main) ? null : marks.Main.Trim(),
        Electricity = CleanIds(marks?.Electricity),
        Water = CleanIds(marks?.Water),
        Movables = CleanIds(marks?.Movables),
        Report = CleanIds(marks?.Report),
        ReportSections = CleanSections(marks?.ReportSections, CleanIds(marks?.Report)),
        // An order needs photos to order.
        ReportOrdered = marks?.ReportOrdered == true && CleanIds(marks.Report).Count > 0,
    };

    private static Dictionary<string, int> CleanSections(
        Dictionary<string, int>? sections,
        List<string> report) =>
        (sections ?? [])
            .Where(pair => report.Contains(pair.Key.Trim(), StringComparer.Ordinal)
                && pair.Value is >= FirstReportSection and <= LastReportSection)
            .GroupBy(pair => pair.Key.Trim(), StringComparer.Ordinal)
            .ToDictionary(group => group.Key, group => group.First().Value, StringComparer.Ordinal);

    private static List<string> CleanIds(IEnumerable<string>? ids) =>
        (ids ?? [])
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Select(id => id.Trim())
            .Distinct(StringComparer.Ordinal)
            .ToList();
}

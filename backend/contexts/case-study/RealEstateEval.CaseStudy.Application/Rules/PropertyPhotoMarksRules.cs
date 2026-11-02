using System.Text.Json;
using RealEstateEval.Application.Contracts;

namespace RealEstateEval.CaseStudy.Application.Rules;

/// <summary>
/// The case specialist's marks on the inspector's photos (2026-11-01 ruling): one main photo, the
/// electricity and water meters, and up to twelve photos for the report.
/// </summary>
public static class PropertyPhotoMarksRules
{
    /// <summary>The report's photo section has twelve slots.</summary>
    public const int ReportPhotoLimit = 12;

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
            && clean.Report.Count == 0;
        return empty ? null : JsonSerializer.Serialize(clean, Json);
    }

    /// <summary>
    /// Why these marks cannot be saved; empty when they can.
    /// How it works: a photo holds one role (main, electricity or water); being in the report is
    /// separate from the role, so a meter can still print.
    /// Edge cases: blank and repeated ids are cleaned first and never count as errors.
    /// </summary>
    public static Dictionary<string, string> Validate(PropertyPhotoMarksDto marks)
    {
        var clean = Clean(marks);
        var errors = new Dictionary<string, string>();
        var roles = clean.Electricity.Concat(clean.Water).ToList();
        if (clean.Main is not null) roles.Add(clean.Main);

        if (roles.Concat(clean.Report).Any(id => id.Length > IdMaxLength))
            errors["_"] = "رقم الصورة غير صالح";
        if (roles.Count != roles.Distinct(StringComparer.Ordinal).Count())
            errors["_"] = "الصورة الواحدة تحمل تمييزاً واحداً: رئيسية أو عداد كهرباء أو عداد ماء";
        if (clean.Report.Count > ReportPhotoLimit)
            errors["report"] = $"التقرير يطبع {ReportPhotoLimit} صورة كحد أقصى";
        return errors;
    }

    private static PropertyPhotoMarksDto Clean(PropertyPhotoMarksDto? marks) => new()
    {
        Main = string.IsNullOrWhiteSpace(marks?.Main) ? null : marks.Main.Trim(),
        Electricity = CleanIds(marks?.Electricity),
        Water = CleanIds(marks?.Water),
        Report = CleanIds(marks?.Report),
    };

    private static List<string> CleanIds(IEnumerable<string>? ids) =>
        (ids ?? [])
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Select(id => id.Trim())
            .Distinct(StringComparer.Ordinal)
            .ToList();
}

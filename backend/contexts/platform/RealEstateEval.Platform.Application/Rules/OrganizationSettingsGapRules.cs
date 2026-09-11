using System.Text.Json;
using System.Text.Json.Nodes;
using RealEstateEval.Domain;

namespace RealEstateEval.Platform.Application.Rules;

/// <summary>
/// An organization-settings value the valuation report prints empty is asked of whoever last
/// changed the settings section that holds it. Each ORGANIZATION_SETTINGS_SAVED audit row keeps
/// the whole settings document before and after the save, so the section diff names the editor.
/// </summary>
public static class OrganizationSettingsGapRules
{
    public const string SavedAction = "ORGANIZATION_SETTINGS_SAVED";
    public const string AuditEntityType = "organization_settings";

    /// <summary>Recent saves scanned for the last editor of each section.</summary>
    public const int HistoryWindow = 60;

    /// <summary>Holders of the settings page when a section was never saved by a person.</summary>
    public const string FallbackRole = "cdo";

    private static readonly Dictionary<string, (string Label, string[] Keys)> SectionMap = new()
    {
        ["company"] = ("بيانات المنشأة", ["company"]),
        ["evaluator"] = ("المقيّمون", ["evaluator", "valuers"]),
        ["report"] = ("تقرير التقييم المهني", ["valuationReport"]),
    };

    public static IReadOnlyCollection<string> Sections => SectionMap.Keys;

    public static string? NormalizeSection(string? section)
    {
        var key = (section ?? "").Trim().ToLowerInvariant();
        return SectionMap.ContainsKey(key) ? key : null;
    }

    public static string SectionLabel(string section) =>
        SectionMap.TryGetValue(section, out var map) ? map.Label : section;

    public static bool ChangedSection(AuditLog row, string section)
    {
        if (!SectionMap.TryGetValue(section, out var map)) return false;
        JsonObject? before;
        JsonObject? after;
        try
        {
            before = JsonNode.Parse(row.BeforeJson) as JsonObject;
            after = JsonNode.Parse(row.AfterJson) as JsonObject;
        }
        catch (JsonException)
        {
            return false;
        }

        return map.Keys.Any(key => !JsonNode.DeepEquals(before?[key], after?[key]));
    }

    /// <summary>Newest save by a person that changed <paramref name="section"/>, or null.</summary>
    public static AuditLog? LastEditor(IEnumerable<AuditLog> rowsNewestFirst, string section) =>
        rowsNewestFirst.FirstOrDefault(row => IsPerson(row.ActorId) && ChangedSection(row, section));

    private static bool IsPerson(string? actorId)
    {
        var actor = (actorId ?? "").Trim();
        return actor.Length > 0 && actor != "system" && actor != "unknown";
    }
}

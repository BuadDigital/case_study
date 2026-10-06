using System.Text.Json;
using System.Text.Json.Nodes;

namespace RealEstateEval.Valuation.Application.Rules;

/// <summary>
/// The report choices the case specialist owns — ESG and the print attachments. They are the
/// appraiser's report-choice keys (<c>reportChoices</c> in his package); the specialist's copy
/// overlays them when the report is rendered. Everything else stays the appraiser's.
/// </summary>
public static class ReportDraftChoiceRules
{
    public const int MaxJsonLength = 256 * 1024;
    public const string EmptyJson = "{}";

    public static readonly IReadOnlyList<string> AllowedKeys =
    [
        "esgEnv",
        "esgSoc",
        "esgGov",
        "printAttachmentKeys",
        "printAttachmentOrder",
        "printAttachmentDocIds",
        "reportSlotAssignments",
        "reportSlotFrames",
    ];

    /// <summary>
    /// Validates the posted choices (a JSON object, allow-listed keys, bounded size) and returns the
    /// normalized JSON text, or the field error to answer with.
    /// </summary>
    public static (string? Json, Dictionary<string, string>? Errors) Normalize(JsonElement choices)
    {
        if (choices.ValueKind != JsonValueKind.Object)
            return (null, Error("خيارات التقرير يجب أن تكون كائناً"));

        var raw = choices.GetRawText();
        if (raw.Length > MaxJsonLength)
            return (null, Error("حجم خيارات التقرير أكبر من المسموح"));

        JsonNode? node;
        try
        {
            node = JsonNode.Parse(raw);
        }
        catch (JsonException)
        {
            return (null, Error("صيغة خيارات التقرير غير صالحة"));
        }

        if (node is not JsonObject obj)
            return (null, Error("خيارات التقرير يجب أن تكون كائناً"));

        foreach (var (key, _) in obj)
        {
            if (!AllowedKeys.Contains(key, StringComparer.Ordinal))
                return (null, Error($"خيار غير معروف في مسودة التقرير: {key}"));
        }

        return (obj.ToJsonString(), null);
    }

    private static Dictionary<string, string> Error(string message) => new() { ["choices"] = message };
}

/// <summary>Error keys of the report-draft use cases that carry a meaning beyond a field message.</summary>
public static class ReportDraftErrorKeys
{
    /// <summary>The caller's role / assignment does not allow the action (the controller answers 403).</summary>
    public const string Forbidden = "_forbidden";
}

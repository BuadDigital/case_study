using System.Text.Json;
using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Rules;

/// <summary>
/// Diffs answer/remark maps and stamps provenance only for keys that changed.
/// Existing keys retain their prior attribution (reassignment-safe).
/// </summary>
public static class CaseStudyAnswerProvenance
{
    public const string DeedRemarksKey = "__deedRemarks";
    public const string SurveyRemarksKey = "__surveyRemarks";
    public const string ComponentsRemarksKey = "__componentsRemarks";
    public const string OccupancyRemarksKey = "__occupancyRemarks";

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    public static Dictionary<string, AnswerProvenanceEntryDto> Parse(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
            return new(StringComparer.Ordinal);

        try
        {
            return JsonSerializer.Deserialize<Dictionary<string, AnswerProvenanceEntryDto>>(json, JsonOpts)
                   ?? new(StringComparer.Ordinal);
        }
        catch
        {
            return new(StringComparer.Ordinal);
        }
    }

    public static string Serialize(Dictionary<string, AnswerProvenanceEntryDto> map) =>
        JsonSerializer.Serialize(map, JsonOpts);

    public static Dictionary<string, AnswerProvenanceEntryDto> MergeChanged(
        Dictionary<string, AnswerProvenanceEntryDto> existing,
        IReadOnlyDictionary<string, string?> previousValues,
        IReadOnlyDictionary<string, string?> nextValues,
        CaseStudyFormActor actor,
        Guid workflowTaskId,
        Guid? formId,
        string? sourcePartyId,
        DateTime answeredAtUtc)
    {
        var result = new Dictionary<string, AnswerProvenanceEntryDto>(existing, StringComparer.Ordinal);

        foreach (var (key, next) in nextValues)
        {
            previousValues.TryGetValue(key, out var prev);
            var prevNorm = Normalize(prev);
            var nextNorm = Normalize(next);
            if (string.Equals(prevNorm, nextNorm, StringComparison.Ordinal))
                continue;

 // Clearing a value keeps the last non-empty provenance snapshot.
            if (string.IsNullOrEmpty(nextNorm))
                continue;

            result[key] = new AnswerProvenanceEntryDto
            {
                Value = nextNorm,
                SourcePartyId = sourcePartyId,
                SourceRole = actor.PrototypeRole,
                WorkflowTaskId = workflowTaskId.ToString(),
                FormId = formId?.ToString(),
                AnsweredByUserId = string.IsNullOrWhiteSpace(actor.UserId) ? null : actor.UserId,
                AnsweredByName = string.IsNullOrWhiteSpace(actor.DisplayName) ? null : actor.DisplayName.Trim(),
                AnsweredAtUtc = answeredAtUtc.ToString("O"),
            };
        }

        return result;
    }

    public static string? NormalizeAnswerValue(object? value)
    {
        if (value is null) return null;
        if (value is JsonElement el)
        {
            return el.ValueKind switch
            {
                JsonValueKind.String => el.GetString(),
                JsonValueKind.True => "true",
                JsonValueKind.False => "false",
                JsonValueKind.Number => el.ToString(),
                JsonValueKind.Null => null,
                _ => el.GetRawText(),
            };
        }

        return value.ToString();
    }

    static string Normalize(string? value) => value?.Trim() ?? "";
}

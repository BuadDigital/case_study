using System.Text.Json;
using System.Text.Json.Nodes;
using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Application.Rules;

/// <summary>
/// Promotes the field inspector's closed-list «الأصل محل التقييم» answer into
/// the operational property type. The intake type remains unchanged for audit.
/// </summary>
public static class InspectedPropertyTypeRules
{
    private static readonly string[] LandHiddenFeatureKeys =
    [
        "facade",
        "buildState",
        "occupancyState",
        "carEntrance",
        "hasBasement",
        "hasElevator",
        "hasPool",
        "hasCentralAc",
        "hasTanks",
        "hasLandscaping",
        "kitchen",
        "occupancyDescription",
    ];

    // The system's full type list (PropertyTypeCatalog) plus the six short values of old payloads.

    public static string? FromPayload(string? payloadJson)
    {
        if (string.IsNullOrWhiteSpace(payloadJson)) return null;
        try
        {
            using var doc = JsonDocument.Parse(payloadJson);
            return FromRoot(doc.RootElement);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    /// <summary>The closed-list «الأصل محل التقييم» answer from a parsed inspector payload root.</summary>
    public static string? FromRoot(JsonElement root)
    {
        if (root.ValueKind != JsonValueKind.Object
            || !root.TryGetProperty("featureValues", out var features)
            || features.ValueKind != JsonValueKind.Object
            || !features.TryGetProperty("assetSubject", out var subject)
            || subject.ValueKind != JsonValueKind.String)
        {
            return null;
        }

        var value = subject.GetString()?.Trim() ?? "";
        return PropertyTypeCatalog.IsInspectorValue(value) ? value : null;
    }

    public static bool IsLand(string? propertyType)
    {
        var value = (propertyType ?? "")
            .Replace("أ", "ا")
            .Replace("إ", "ا")
            .Replace("آ", "ا")
            .Replace("ٱ", "ا")
            .Trim();
        return value.Contains("ارض", StringComparison.Ordinal)
            || value.Equals("land", StringComparison.OrdinalIgnoreCase);
    }

    public static string NormalizePayloadForSubmission(
        string payloadJson,
        string inspectedPropertyType)
    {
        var root = JsonNode.Parse(payloadJson)?.AsObject()
            ?? throw new JsonException("Inspection payload must be a JSON object.");
        var isLand = IsLand(inspectedPropertyType);
        root["vacantLand"] = isLand;
        if (!isLand) return root.ToJsonString();

        var values = root["featureValues"] as JsonObject;
        var photos = root["featurePhotoAttachments"] as JsonObject;
        foreach (var key in LandHiddenFeatureKeys)
        {
            if (values is not null) values[key] = "";
            photos?.Remove(key);
        }

        return root.ToJsonString();
    }

    public static string Effective(string? initial, string? inspected) =>
        string.IsNullOrWhiteSpace(inspected)
            ? (initial ?? "").Trim()
            : inspected.Trim();

    /// <summary>
    /// The inspector's type against the one the property had (2026-10-29: he corrects the bourse type
    /// on site). Null when it is the same type. The survey flags let the submit add or withdraw the
    /// engineering survey the new type needs.
    /// </summary>
    public static InspectedTypeChange? ChangeOf(
        string? previousType,
        string? newType,
        bool surveyRequiredBefore,
        bool surveyRequiredAfter)
    {
        var before = (previousType ?? "").Trim();
        var after = (newType ?? "").Trim();
        if (after.Length == 0 || string.Equals(before, after, StringComparison.Ordinal)) return null;
        return new InspectedTypeChange(before, after, surveyRequiredBefore, surveyRequiredAfter);
    }
}

/// <summary>A property type the inspector changed on submit, and what it does to the survey requirement.</summary>
public sealed record InspectedTypeChange(
    string PreviousType,
    string NewType,
    bool SurveyRequiredBefore,
    bool SurveyRequiredAfter)
{
    /// <summary>
    /// The new type is not the bourse type — the survey ask follows
    /// <see cref="SurveyRequirementRules.SurveyMissingAfterTypeChange"/>, which only asks for a changed type.
    /// Edge cases: an inspector who goes back to the bourse type is not asked for an office (the note
    /// would not show either). Defaults to true for callers that do not know the bourse type.
    /// </summary>
    public bool DiffersFromBourseType { get; init; } = true;

    /// <summary>
    /// The change itself took the survey need away — the open survey is withdrawn.
    /// How it works: the property needed a survey under the previous type and needs none under the new.
    /// Edge cases: a property that needed none before either keeps its survey — that one was added by
    /// exception with a reason (Omar 2026-11-11), and a type change is not what would end it. Until
    /// then any change on such a property withdrew the survey.
    /// </summary>
    public bool WithdrawsSurvey => SurveyRequiredBefore && !SurveyRequiredAfter;
}

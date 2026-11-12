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

    /// <summary>A staff change of the type states why, in at least this many characters.</summary>
    public const int StaffChangeReasonMinLength = 10;

    public const string StaffChangeReasonRequiredAr =
        "اذكر سبب تعديل نوع العقار (10 أحرف على الأقل)";

    public const string StaffChangeTypeInvalidAr = "اختر نوع العقار من القائمة";

    /// <summary>The reason a staff change of the type must carry (Omar 2026-11-12), trimmed; null when too short.</summary>
    public static string? StaffChangeReason(string? reason)
    {
        var trimmed = (reason ?? "").Trim();
        return trimmed.Length >= StaffChangeReasonMinLength ? trimmed : null;
    }

    /// <summary>
    /// Writes case staff's corrected type and / or usage into a submitted inspection payload (Omar
    /// 2026-11-12: the study specialist changes the type too, not only the inspector).
    /// </summary>
    /// <remarks>
    /// How it works: a non-blank type becomes <c>featureValues.assetSubject</c> and sets <c>vacantLand</c>
    /// from it; a non-blank usage becomes <c>featureValues.propertyUsage</c>. A blank value leaves its
    /// field as it is.
    /// Edge cases: unlike the inspector's own submit (<see cref="NormalizePayloadForSubmission"/>), a
    /// change to land does NOT empty the building-only answers — the screens and the reports hide them
    /// by the type, and they show again if the type goes back. A payload with no <c>featureValues</c>
    /// gets one.
    /// </remarks>
    public static string ApplyStaffCorrection(string payloadJson, string? propertyType, string? propertyUsage)
    {
        var root = JsonNode.Parse(payloadJson)?.AsObject()
            ?? throw new JsonException("Inspection payload must be a JSON object.");
        if (root["featureValues"] is not JsonObject values)
        {
            values = new JsonObject();
            root["featureValues"] = values;
        }

        if (!string.IsNullOrWhiteSpace(propertyType))
        {
            values["assetSubject"] = propertyType.Trim();
            root["vacantLand"] = IsLand(propertyType);
        }
        if (!string.IsNullOrWhiteSpace(propertyUsage))
            values["propertyUsage"] = propertyUsage.Trim();

        return root.ToJsonString();
    }

    /// <summary>An apartment records no facade (2026-10-20) — the one answer its type hides.</summary>
    private static bool IsApartment(string? propertyType)
    {
        var value = (propertyType ?? "").Trim();
        return !IsLand(value)
            && (value.Contains("شقة", StringComparison.Ordinal)
                || value.Contains("شقه", StringComparison.Ordinal)
                || value.Contains("شقق", StringComparison.Ordinal));
    }

    /// <summary>The feature answers the type does not record: the building-only ones on land, the facade on an apartment.</summary>
    private static IReadOnlyList<string> HiddenFeatureKeysFor(string? propertyType) =>
        IsLand(propertyType) ? [.. LandHiddenFeatureKeys, "propertyCondition"]
        : IsApartment(propertyType) ? ["facade"]
        : [];

    /// <summary>
    /// Keeps the inspector's answers the current type hides when case staff save a correction of a
    /// submitted package.
    /// </summary>
    /// <remarks>
    /// How it works: the screens never show (and so never send back) the answers the type hides, so
    /// every staff save would blank them. For each hidden answer the incoming payload leaves blank
    /// while the stored payload has it, the stored value and its proof photo are put back.
    /// Edge cases: a type that hides nothing, or a payload that is not a JSON object, returns the
    /// incoming payload untouched (same string). Needed since 2026-11-12: staff may change a villa to
    /// land and back, and the inspector's building answers must still be there. The inspector's own
    /// saves never pass through here — his form stays the judge of his package.
    /// </remarks>
    public static string KeepHiddenValuesOnStaffCorrection(string storedPayloadJson, string incomingPayloadJson)
    {
        JsonObject? stored;
        JsonObject? incoming;
        try
        {
            stored = JsonNode.Parse(storedPayloadJson) as JsonObject;
            incoming = JsonNode.Parse(incomingPayloadJson) as JsonObject;
        }
        catch (JsonException)
        {
            return incomingPayloadJson;
        }
        if (stored is null || incoming is null) return incomingPayloadJson;

        var hidden = HiddenFeatureKeysFor(
            (incoming["featureValues"] as JsonObject)?["assetSubject"] is JsonValue subject
            && subject.TryGetValue<string>(out var type)
                ? type
                : null);
        if (hidden.Count == 0) return incomingPayloadJson;

        var kept = KeepStoredEntries(stored, incoming, "featureValues", hidden)
            | KeepStoredEntries(stored, incoming, "featurePhotoAttachments", hidden);
        return kept ? incoming.ToJsonString() : incomingPayloadJson;
    }

    /// <summary>
    /// Copies the stored entries of one payload section into the incoming one where the incoming entry
    /// is missing, null or a blank string. Returns whether anything was copied.
    /// </summary>
    private static bool KeepStoredEntries(
        JsonObject stored,
        JsonObject incoming,
        string section,
        IReadOnlyList<string> keys)
    {
        if (stored[section] is not JsonObject storedSection) return false;
        var kept = false;
        foreach (var key in keys)
        {
            var storedValue = storedSection[key];
            if (IsBlankNode(storedValue)) continue;
            if (incoming[section] is not JsonObject incomingSection)
            {
                incomingSection = new JsonObject();
                incoming[section] = incomingSection;
            }
            if (!IsBlankNode(incomingSection[key])) continue;
            incomingSection[key] = storedValue!.DeepClone();
            kept = true;
        }
        return kept;
    }

    private static bool IsBlankNode(JsonNode? node) =>
        node is null
        || (node is JsonValue value && value.TryGetValue<string>(out var text) && string.IsNullOrWhiteSpace(text));

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

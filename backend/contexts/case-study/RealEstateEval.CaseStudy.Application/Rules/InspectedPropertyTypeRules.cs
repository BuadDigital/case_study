using System.Text.Json;
using System.Text.Json.Nodes;

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

    private static readonly HashSet<string> Allowed = new(StringComparer.Ordinal)
    {
        "فيلا",
        "أرض",
        "شقة",
        "عمارة",
        "محل تجاري",
        "مستودع",
    };

    public static string? FromPayload(string? payloadJson)
    {
        if (string.IsNullOrWhiteSpace(payloadJson)) return null;
        try
        {
            using var doc = JsonDocument.Parse(payloadJson);
            var root = doc.RootElement;
            if (!root.TryGetProperty("featureValues", out var features)
                || features.ValueKind != JsonValueKind.Object
                || !features.TryGetProperty("assetSubject", out var subject)
                || subject.ValueKind != JsonValueKind.String)
            {
                return null;
            }

            var value = subject.GetString()?.Trim() ?? "";
            return Allowed.Contains(value) ? value : null;
        }
        catch (JsonException)
        {
            return null;
        }
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
}

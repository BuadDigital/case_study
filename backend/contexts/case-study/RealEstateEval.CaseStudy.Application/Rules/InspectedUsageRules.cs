using System.Text.Json;
using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Application.Rules;

/// <summary>Reads the inspector's «استخدام العقار» out of an inspection payload.</summary>
public static class InspectedUsageRules
{
    public const int MaxLength = 150;

    /// <summary>
    /// The usage the payload states, or null when it states none.
    /// How it works: reads <c>featureValues.propertyUsage</c> as free text, because a name the list
    /// does not have is a valid answer.
    /// Edge cases: a classification («مبنى مفرد») is what the field held before 2026-11-01, copied from
    /// the bourse, so it reads as no answer rather than as a use. Bad JSON reads as no answer too.
    /// </summary>
    public static string? FromPayload(string? payloadJson)
    {
        if (string.IsNullOrWhiteSpace(payloadJson)) return null;
        try
        {
            using var doc = JsonDocument.Parse(payloadJson);
            var root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object
                || !root.TryGetProperty("featureValues", out var features)
                || features.ValueKind != JsonValueKind.Object
                || !features.TryGetProperty("propertyUsage", out var usage)
                || usage.ValueKind != JsonValueKind.String)
            {
                return null;
            }

            var value = usage.GetString()?.Trim() ?? "";
            if (value.Length == 0 || PropertyTypeCatalog.IsClassification(value)) return null;
            return value.Length > MaxLength ? value[..MaxLength] : value;
        }
        catch (JsonException)
        {
            return null;
        }
    }
}

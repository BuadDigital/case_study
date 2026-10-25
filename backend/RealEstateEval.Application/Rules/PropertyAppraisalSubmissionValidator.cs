using System.Text.Json;
using RealEstateEval.Domain;

namespace RealEstateEval.Application.Rules;

/// <summary>
/// Server-side validation for property-appraisal party task payloads —
/// mirrors <c>validateEvaluatorSubmission</c> Infath gates in the MFE.
/// Report participants are derived (fixed roster + assigned appraiser), not a submit field.
/// </summary>
public static class PropertyAppraisalSubmissionValidator
{
    public const string PriceRequiredAr = "سعر التقييم مطلوب";
    public const string PriceNotANumberAr = "سعر التقييم رقم أكبر من صفر — بالأرقام فقط";

    /// <summary>Same ceiling as a value document — beyond it the entry is a typo, not a property value.</summary>
    public const decimal MaxPriceSar = 1_000_000_000_000m;

    public static Dictionary<string, string> Validate(JsonElement root)
    {
        var errors = new Dictionary<string, string>();

        if (!HasNonEmpty(root, "evaluatorPrice") && !IsNumber(root, "evaluatorPrice"))
            errors["evaluatorPrice"] = PriceRequiredAr;
        else if (ReadPrice(root) is not { } price || price <= 0m || price > MaxPriceSar)
            errors["evaluatorPrice"] = PriceNotANumberAr;

        return errors;
    }

    /// <summary>
    /// The handed-over price as a number — a JSON number, or text in Latin or Arabic digits (thousands
    /// separators allowed). Null when it is not a number («abc»).
    /// </summary>
    public static decimal? ReadPrice(JsonElement root)
    {
        if (root.ValueKind != JsonValueKind.Object || !root.TryGetProperty("evaluatorPrice", out var value))
            return null;
        return value.ValueKind switch
        {
            JsonValueKind.Number => value.TryGetDecimal(out var number) ? number : null,
            JsonValueKind.String => LocaleNumber.ParseOrNull(value.GetString()),
            _ => null,
        };
    }

    private static bool IsNumber(JsonElement element, string name) =>
        element.ValueKind == JsonValueKind.Object
        && element.TryGetProperty(name, out var value)
        && value.ValueKind == JsonValueKind.Number;

    private static bool HasNonEmpty(JsonElement element, string name) =>
        JsonElementReader.HasNonEmptyString(element, name);
}

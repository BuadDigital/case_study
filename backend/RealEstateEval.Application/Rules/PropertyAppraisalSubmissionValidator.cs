using System.Text.Json;

namespace RealEstateEval.Application.Rules;

/// <summary>
/// Server-side validation for property-appraisal party task payloads —
/// mirrors <c>validateEvaluatorSubmission</c> Infath gates in the MFE.
/// </summary>
public static class PropertyAppraisalSubmissionValidator
{
    public static Dictionary<string, string> Validate(JsonElement root)
    {
        var errors = new Dictionary<string, string>();

        if (!HasNonEmpty(root, "evaluatorPrice"))
            errors["evaluatorPrice"] = "سعر التقييم مطلوب";
        if (!HasNonEmpty(root, "reportFileName"))
            errors["reportFileName"] = "تقرير PDF مطلوب";

        var assetConfirmed = GetBool(root, "assetDataConfirmed");
        var hasVarianceNotes = HasNonEmpty(root, "assetDataVarianceNotes");
        if (!assetConfirmed && !hasVarianceNotes)
        {
            errors["asset_data_confirmed"] =
                "أكّد مراجعة بيانات الأصل، أو دوّن ملاحظات التباين إن وُجدت.";
        }

        return errors;
    }

    private static bool HasNonEmpty(JsonElement element, string name)
    {
        if (!element.TryGetProperty(name, out var prop))
            return false;
        return prop.ValueKind == JsonValueKind.String
            && !string.IsNullOrWhiteSpace(prop.GetString());
    }

    private static bool GetBool(JsonElement element, string name)
    {
        if (!element.TryGetProperty(name, out var prop))
            return false;
        return prop.ValueKind == JsonValueKind.True;
    }
}

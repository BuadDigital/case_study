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

        if (!GetBool(root, "independenceDeclared"))
        {
            errors["independence_declared"] =
                "يجب تأكيد إقرار الاستقلالية وعدم تضارب المصالح.";
        }

        if (!HasNamedReportWorker(root))
        {
            errors["report_workers"] =
                "أضف عاملاً واحداً على الأقل على التقرير (الدور والاسم).";
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

    private static bool HasNamedReportWorker(JsonElement root)
    {
        if (!root.TryGetProperty("reportWorkers", out var workers) ||
            workers.ValueKind != JsonValueKind.Array)
        {
            return false;
        }

        foreach (var worker in workers.EnumerateArray())
        {
            if (worker.ValueKind != JsonValueKind.Object) continue;
            if (!worker.TryGetProperty("name", out var nameProp)) continue;
            if (nameProp.ValueKind == JsonValueKind.String &&
                !string.IsNullOrWhiteSpace(nameProp.GetString()))
            {
                return true;
            }
        }

        return false;
    }
}

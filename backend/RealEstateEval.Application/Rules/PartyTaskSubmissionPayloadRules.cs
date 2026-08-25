using System.Text.Json;
using RealEstateEval.Domain;

namespace RealEstateEval.Application.Rules;

/// <summary>
/// Payload validation and status patch helpers for party task submissions.
/// </summary>
public static class PartyTaskSubmissionPayloadRules
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
    };

    public static Dictionary<string, string> ValidateForSubmit(PartyTaskSubmission entity)
    {
        var errors = new Dictionary<string, string>();
        try
        {
            using var doc = JsonDocument.Parse(entity.PayloadJson);
            var root = doc.RootElement;

            switch (entity.Kind)
            {
                case "engineering-survey":
                    if (!HasNonEmpty(root, "latitude") || !HasNonEmpty(root, "longitude"))
                        errors["coordinates"] = "الإحداثيات مطلوبة";
                    if (!HasNonEmpty(root, "surveyReportFileName"))
                        errors["surveyReportFileName"] = "تقرير الرفع المساحي مطلوب";
                    if (!GetBool(root, "siteConfirmed"))
                        errors["siteConfirmed"] = "يجب تأكيد الموقع";
                    break;

                case "property-appraisal":
                    foreach (var (key, message) in PropertyAppraisalSubmissionValidator.Validate(root))
                        errors[key] = message;
                    break;

                case "government-review":
 // Legacy kind — product surface removed; reject new submits.
                    errors["_"] = "مسار المراجعة الحكومية لم يعد مدعوماً";
                    break;

                case "field-inspection":
                    foreach (var (key, message) in FieldInspectionSubmissionValidator.Validate(root))
                        errors[key] = message;
                    break;
            }
        }
        catch
        {
            errors["_"] = "بيانات الإرسال غير صالحة";
        }

        return errors;
    }

    public static bool HasNonEmpty(JsonElement root, string name)
    {
        if (!root.TryGetProperty(name, out var prop)) return false;
        return prop.ValueKind switch
        {
            JsonValueKind.String => !string.IsNullOrWhiteSpace(prop.GetString()),
            JsonValueKind.Number => true,
            JsonValueKind.True => true,
            _ => false,
        };
    }

    public static bool GetBool(JsonElement root, string name)
    {
        if (!root.TryGetProperty(name, out var prop)) return false;
        return prop.ValueKind == JsonValueKind.True;
    }

    public static string? GetString(JsonElement root, string name)
    {
        if (!root.TryGetProperty(name, out var prop)) return null;
        return prop.ValueKind == JsonValueKind.String ? prop.GetString() : prop.ToString();
    }

    public static bool HasPlanAndPlot(string? planNumber, string? plotNumber)
    {
        return !string.IsNullOrWhiteSpace(planNumber)
            && !string.IsNullOrWhiteSpace(plotNumber);
    }

    /// <summary>
    /// Site-validity letter is optional when the property is on a subdivision plan
    /// and has a plot number.
    /// </summary>
    public static void RequireSiteLetterUnlessPlatted(
        Dictionary<string, string> errors,
        JsonElement root,
        string? planNumber,
        string? plotNumber)
    {
        if (HasPlanAndPlot(planNumber, plotNumber))
            return;
        if (!HasNonEmpty(root, "siteLetterFileName"))
            errors["siteLetterFileName"] = "خطاب الموقع مطلوب";
    }

    public static string? ExtractStatus(string payloadJson)
    {
        try
        {
            using var doc = JsonDocument.Parse(payloadJson);
            if (doc.RootElement.TryGetProperty("status", out var status))
                return status.GetString();
        }
        catch
        {
 // ignore
        }

        return null;
    }

    public static string SetPayloadStatus(string payloadJson, string status, DateTime submittedAt)
    {
        try
        {
            var dict = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(payloadJson, JsonOpts)
                       ?? new Dictionary<string, JsonElement>();
            var mutable = dict.ToDictionary(
                kv => kv.Key,
                kv => (object?)DeserializeElement(kv.Value));
            mutable["status"] = status;
            mutable["submittedAtUtc"] = submittedAt.ToString("O");
            mutable["updatedAtUtc"] = submittedAt.ToString("O");
            return JsonSerializer.Serialize(mutable, JsonOpts);
        }
        catch
        {
            return payloadJson;
        }
    }

    public static string SetPayloadReopened(string payloadJson, string returnNote, DateTime now)
    {
        try
        {
            var dict = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(payloadJson, JsonOpts)
                       ?? new Dictionary<string, JsonElement>();
            var mutable = dict.ToDictionary(
                kv => kv.Key,
                kv => (object?)DeserializeElement(kv.Value));
            mutable["status"] = PartyTaskSubmissionStatus.Reopened;
            mutable["returnNote"] = returnNote;
            mutable["submittedAtUtc"] = null;
            mutable["updatedAtUtc"] = now.ToString("O");
            return JsonSerializer.Serialize(mutable, JsonOpts);
        }
        catch
        {
            return payloadJson;
        }
    }

    public static object? DeserializeElement(JsonElement element) =>
        element.ValueKind switch
        {
            JsonValueKind.String => element.GetString(),
            JsonValueKind.Number => element.TryGetInt64(out var l) ? l : element.GetDouble(),
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.Null => null,
            _ => JsonSerializer.Deserialize<object>(element.GetRawText(), JsonOpts),
        };
}

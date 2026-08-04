using System.Text.Json;
using RealEstateEval.Domain;

namespace RealEstateEval.Application.Rules;

/// <summary>
/// Server-side validation for government-review party task payloads —
/// mirrors <c>validateGovernmentReviewSubmission</c> finalize path in the MFE.
/// </summary>
public static class GovernmentReviewSubmissionValidator
{
    public static Dictionary<string, string> Validate(JsonElement root)
    {
        var errors = new Dictionary<string, string>();

        var visitStatus = ReadString(root, "visitStatus");
        var keysStatus = ReadString(root, "keysStatus");
        var keyHanded = ReadString(root, "keyHandedToInspector");

        if (string.IsNullOrWhiteSpace(visitStatus))
        {
            errors["visitStatus"] = "حدّد حالة زيارة المحكمة";
            return errors;
        }

        if (!CanFinalize(visitStatus, keysStatus, keyHanded))
        {
            if (!string.Equals(visitStatus, GovernmentReviewVisitStatuses.Completed, StringComparison.Ordinal))
            {
                errors["visitStatus"] =
                    "لا يمكن إتمام المراجعة قبل تأكيد «تمت الزيارة» — احفظ كمسودة بالانتظار";
            }
            else
            {
                errors["keyHandedToInspector"] =
                    "لإتمام المعاملة اختر «نعم» بعد تسليم المفتاح للمعاين — أو احفظ كقيد التنفيذ (أو اختر مفاتيح غير مطلوبة)";
            }
            return errors;
        }

        ValidateKeysAndVisitBasics(root, visitStatus, keysStatus, errors);

        if (!GetBool(root, "confirmed"))
            errors["confirmed"] = "يجب تأكيد اكتمال المراجعة قبل الإرسال";

        return errors;
    }

    private static bool CanFinalize(string visitStatus, string keysStatus, string keyHanded)
    {
        if (!string.Equals(visitStatus, GovernmentReviewVisitStatuses.Completed, StringComparison.Ordinal))
            return false;
        if (string.Equals(keysStatus, "not_required", StringComparison.Ordinal))
            return true;
        return string.Equals(keyHanded, "yes", StringComparison.Ordinal);
    }

    private static void ValidateKeysAndVisitBasics(
        JsonElement root,
        string visitStatus,
        string keysStatus,
        Dictionary<string, string> errors)
    {
        if (string.Equals(visitStatus, GovernmentReviewVisitStatuses.Completed, StringComparison.Ordinal)
            && string.IsNullOrWhiteSpace(ReadString(root, "visitDate")))
        {
            errors["visitDate"] = "أدخل تاريخ الزيارة";
        }

        if (string.Equals(visitStatus, GovernmentReviewVisitStatuses.Blocked, StringComparison.Ordinal)
            && string.IsNullOrWhiteSpace(ReadString(root, "accessBlockReason")))
        {
            errors["accessBlockReason"] = "اذكر سبب تعذر الوصول";
        }

        if (string.IsNullOrWhiteSpace(keysStatus))
            errors["keysStatus"] = "حدّد حالة استلام المفاتيح";

        if (string.Equals(keysStatus, "received", StringComparison.Ordinal))
        {
            if (string.IsNullOrWhiteSpace(ReadString(root, "keysDescription")))
                errors["keysDescription"] = "صف المفاتيح المستلمة أو موقع حفظها";

            if (!HasKeysProof(root))
                errors["keysProofFiles"] = "ارفع إثبات استلام المفتاح (صورة أو خطاب)";
        }

        if (string.Equals(keysStatus, "pending", StringComparison.Ordinal)
            && string.Equals(visitStatus, "completed", StringComparison.Ordinal)
            && string.IsNullOrWhiteSpace(ReadString(root, "accessBlockReason")))
        {
            errors["accessBlockReason"] =
                "اذكر سبب عدم استلام المفاتيح أو الخطوة التالية";
        }
    }

    private static bool HasKeysProof(JsonElement root)
    {
        if (root.TryGetProperty("keysProofFiles", out var files)
            && files.ValueKind == JsonValueKind.Array
            && files.GetArrayLength() > 0)
        {
            return true;
        }

        // Legacy single-file field still accepted if present.
        return !string.IsNullOrWhiteSpace(ReadString(root, "keysProofFileName"));
    }

    private static string ReadString(JsonElement element, string name)
    {
        if (!element.TryGetProperty(name, out var prop))
            return "";
        return prop.ValueKind == JsonValueKind.String
            ? prop.GetString()?.Trim() ?? ""
            : "";
    }

    private static bool GetBool(JsonElement element, string name)
    {
        if (!element.TryGetProperty(name, out var prop))
            return false;
        return prop.ValueKind == JsonValueKind.True;
    }
}

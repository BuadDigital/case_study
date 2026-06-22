using System.Globalization;
using System.Text.Json;

namespace RealEstateEval.Application.Rules;

/// <summary>
/// Server-side validation for field-inspection party task payloads —
/// mirrors <c>validateInspectorWorkspace</c> / <c>listInspectorPhotoValidationIssues</c> in the MFE.
/// </summary>
public static class FieldInspectionSubmissionValidator
{
    private const double SaudiLatMin = 16;
    private const double SaudiLatMax = 33;
    private const double SaudiLngMin = 34;
    private const double SaudiLngMax = 56;

    private static readonly HashSet<string> LegacySeaCoords = new(StringComparer.Ordinal)
    {
        "21.5433,39.1728",
        "21.543300,39.172800",
    };

    private static readonly (string Id, bool Required, bool AnnexOnly)[] DefinedPhotoSlots =
    [
        ("front", true, false),
        ("sides", true, false),
        ("water", true, false),
        ("elec", true, false),
        ("inside", true, false),
        ("floor", false, false),
        ("annexup", true, true),
        ("annexdn", true, true),
    ];

    private static readonly (string Key, string Label)[] FeaturePhotoFields =
    [
        ("assetSubject", "الأصل محل التقييم"),
        ("facade", "الواجهة"),
        ("propertyUsage", "استخدام العقار"),
        ("buildState", "حالة البناء"),
        ("movables", "يوجد منقولات"),
        ("carEntrance", "مدخل السيارة"),
        ("hasBasement", "يوجد قبو"),
        ("hasElevator", "يوجد مصعد"),
        ("hasPool", "يوجد مسبح"),
        ("kitchen", "مطبخ"),
    ];

    private static readonly HashSet<string> FeaturePhotoYesNoOnlyKeys = new(StringComparer.Ordinal)
    {
        "movables",
        "carEntrance",
        "hasBasement",
        "hasElevator",
        "hasPool",
        "kitchen",
    };

    public static Dictionary<string, string> Validate(JsonElement root)
    {
        var errors = new Dictionary<string, string>();

        if (!HasNonEmptyString(root, "inspectionDate"))
            errors["inspectionDate"] = "تاريخ المعاينة مطلوب";

        if (!HasNonEmptyString(root, "inspectionTime"))
            errors["inspectionTime"] = "وقت المعاينة مطلوب";

        if (!ValidateGps(root))
            errors["mapLatitude"] = "يجب تحديد موقع العقار (GPS)";

        if (!GetBool(root, "inspectionConfirmed"))
            errors["inspectionConfirmed"] = "يجب التأشير على إقرار المعاينة";

        if (HasIncompleteObservations(root))
            errors["observations"] = "كل ملاحظة موثّقة يجب أن تتضمن شرحاً وصورة توثيقية";

        var photoIssues = ListPhotoValidationIssues(root);
        if (photoIssues.Count > 0)
        {
            errors["definedPhotos"] = photoIssues[0];
            var featureIssue = photoIssues.Find(i => i.Contains("توثيقية", StringComparison.Ordinal));
            if (featureIssue is not null)
                errors["featurePhotos"] = featureIssue;
            var componentIssue = photoIssues.Find(i =>
                i.Contains("المعرض", StringComparison.Ordinal) ||
                i.Contains("البئر", StringComparison.Ordinal));
            if (componentIssue is not null)
                errors["componentPhotos"] = componentIssue;
        }

        return errors;
    }

    private static bool ValidateGps(JsonElement root)
    {
        var latRaw = ReadString(root, "mapLatitude");
        var lngRaw = ReadString(root, "mapLongitude");
        if (string.IsNullOrWhiteSpace(latRaw) || string.IsNullOrWhiteSpace(lngRaw))
            return false;

        if (LegacySeaCoords.Contains($"{latRaw.Trim()},{lngRaw.Trim()}"))
            return false;

        if (!TryParseCoord(latRaw, out var lat) || !TryParseCoord(lngRaw, out var lng))
            return false;

        return lat >= SaudiLatMin && lat <= SaudiLatMax &&
               lng >= SaudiLngMin && lng <= SaudiLngMax;
    }

    private static bool HasIncompleteObservations(JsonElement root)
    {
        if (!root.TryGetProperty("observations", out var observations) ||
            observations.ValueKind != JsonValueKind.Array)
        {
            return false;
        }

        foreach (var obs in observations.EnumerateArray())
        {
            var text = ReadString(obs, "text");
            if (string.IsNullOrWhiteSpace(text))
                return true;
            if (!HasPhotoFileName(obs, "photo"))
                return true;
        }

        return false;
    }

    private static List<string> ListPhotoValidationIssues(JsonElement root)
    {
        var issues = new List<string>();

        if (root.TryGetProperty("featureValues", out var featureValues) &&
            featureValues.ValueKind == JsonValueKind.Object)
        {
            foreach (var (key, label) in FeaturePhotoFields)
            {
                if (!TryReadFeatureValue(featureValues, key, out var value) ||
                    !FeatureValueRequiresPhoto(key, value))
                {
                    continue;
                }

                if (!HasFeaturePhotoAttachment(root, key))
                    issues.Add($"يجب إرفاق صورة توثيقية: {label}");
            }
        }

        var showroomCount = ParsePositiveCount(ReadString(root, "showroomCount"));
        if (showroomCount > 0 && !HasComponentPhotoAttachment(root, "showroom"))
            issues.Add("يجب إرفاق صورة المعرض");

        var wellCount = ParsePositiveCount(ReadString(root, "wellCount"));
        if (wellCount > 0 && !HasComponentPhotoAttachment(root, "well"))
            issues.Add("يجب إرفاق صورة البئر");

        var showAnnex = ReadString(root, "hasAnnex") == "نعم";
        var (requiredTotal, requiredDone, pendingApproval) = ComputeDefinedPhotoCoverage(root, showAnnex);

        if (requiredDone < requiredTotal)
        {
            issues.Add(
                "أكمل صور العقار الموثّقة المطلوبة (رفع صورة معتمدة أو تفعيل «لا يوجد»)");
        }

        if (pendingApproval > 0)
            issues.Add($"{pendingApproval} صورة بانتظار الاعتماد");

        var untagged = CountUntaggedFreePhotos(root);
        if (untagged > 0)
            issues.Add($"{untagged} صورة إضافية بحاجة لتعريف");

        if (HasPhotosWithoutServerAttachment(root))
            issues.Add("يجب رفع الصور إلى الخادم قبل الإرسال");

        return issues;
    }

    private static bool HasPhotosWithoutServerAttachment(JsonElement root) =>
        FieldInspectionPayloadAttachments.HasPhotosWithoutServerAttachment(root);

    private static (int RequiredTotal, int RequiredDone, int PendingApproval) ComputeDefinedPhotoCoverage(
        JsonElement root,
        bool showAnnex)
    {
        var requiredTotal = 0;
        var requiredDone = 0;
        var pendingApproval = 0;

        root.TryGetProperty("definedPhotos", out var definedPhotos);
        if (definedPhotos.ValueKind != JsonValueKind.Object)
            definedPhotos = default;

        foreach (var slot in DefinedPhotoSlots)
        {
            if (!slot.Required || (slot.AnnexOnly && !showAnnex))
                continue;

            requiredTotal++;
            if (IsDefinedSlotComplete(definedPhotos, slot.Id))
                requiredDone++;
        }

        if (definedPhotos.ValueKind == JsonValueKind.Object)
        {
            foreach (var slotProp in definedPhotos.EnumerateObject())
            {
                if (!slotProp.Value.TryGetProperty("photos", out var photos) ||
                    photos.ValueKind != JsonValueKind.Array)
                {
                    continue;
                }

                foreach (var photo in photos.EnumerateArray())
                {
                    if (!GetBool(photo, "approved"))
                        pendingApproval++;
                }
            }
        }

        if (root.TryGetProperty("freePhotos", out var freePhotos) &&
            freePhotos.ValueKind == JsonValueKind.Array)
        {
            foreach (var photo in freePhotos.EnumerateArray())
            {
                var category = ReadString(photo, "category");
                if (!string.IsNullOrWhiteSpace(category) && !GetBool(photo, "approved"))
                    pendingApproval++;
            }
        }

        return (requiredTotal, requiredDone, pendingApproval);
    }

    private static bool IsDefinedSlotComplete(JsonElement definedPhotos, string slotId)
    {
        if (definedPhotos.ValueKind != JsonValueKind.Object ||
            !definedPhotos.TryGetProperty(slotId, out var slot) ||
            slot.ValueKind != JsonValueKind.Object)
        {
            return false;
        }

        if (GetBool(slot, "none"))
            return true;

        if (!slot.TryGetProperty("photos", out var photos) || photos.ValueKind != JsonValueKind.Array)
            return false;

        foreach (var photo in photos.EnumerateArray())
        {
            if (GetBool(photo, "approved") && HasPhotoFileName(photo))
                return true;
        }

        return false;
    }

    private static int CountUntaggedFreePhotos(JsonElement root)
    {
        if (!root.TryGetProperty("freePhotos", out var freePhotos) ||
            freePhotos.ValueKind != JsonValueKind.Array)
        {
            return 0;
        }

        var count = 0;
        foreach (var photo in freePhotos.EnumerateArray())
        {
            if (string.IsNullOrWhiteSpace(ReadString(photo, "category")))
                count++;
        }

        return count;
    }

    private static bool FeatureValueRequiresPhoto(string key, string value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return false;
        if (FeaturePhotoYesNoOnlyKeys.Contains(key))
            return value == "نعم";
        return true;
    }

    private static bool TryReadFeatureValue(JsonElement featureValues, string key, out string value)
    {
        value = "";
        if (!featureValues.TryGetProperty(key, out var prop))
            return false;
        if (prop.ValueKind != JsonValueKind.String)
            return false;
        value = prop.GetString()?.Trim() ?? "";
        return true;
    }

    private static bool HasFeaturePhotoAttachment(JsonElement root, string key)
    {
        if (!root.TryGetProperty("featurePhotoAttachments", out var attachments) ||
            attachments.ValueKind != JsonValueKind.Object ||
            !attachments.TryGetProperty(key, out var attachment))
        {
            return false;
        }

        return HasPhotoFileName(attachment);
    }

    private static bool HasComponentPhotoAttachment(JsonElement root, string key)
    {
        if (!root.TryGetProperty("componentPhotoAttachments", out var attachments) ||
            attachments.ValueKind != JsonValueKind.Object ||
            !attachments.TryGetProperty(key, out var attachment))
        {
            return false;
        }

        if (attachment.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined)
            return false;

        return HasPhotoFileName(attachment);
    }

    private static bool HasPhotoFileName(JsonElement element, string? propertyName = null)
    {
        if (propertyName is not null)
        {
            if (!element.TryGetProperty(propertyName, out var nested))
                return false;
            if (nested.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined)
                return false;
            return HasPhotoFileName(nested);
        }

        return HasNonEmptyString(element, "fileName");
    }

    private static int ParsePositiveCount(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return 0;
        return int.TryParse(value.Trim(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var n) && n > 0
            ? n
            : 0;
    }

    private static bool TryParseCoord(string raw, out double value)
    {
        return double.TryParse(
            raw.Trim(),
            NumberStyles.Float,
            CultureInfo.InvariantCulture,
            out value);
    }

    private static string ReadString(JsonElement element, string name)
    {
        if (!element.TryGetProperty(name, out var prop))
            return "";
        return prop.ValueKind == JsonValueKind.String ? prop.GetString()?.Trim() ?? "" : "";
    }

    private static bool HasNonEmptyString(JsonElement element, string name) =>
        !string.IsNullOrWhiteSpace(ReadString(element, name));

    private static bool GetBool(JsonElement element, string name)
    {
        if (!element.TryGetProperty(name, out var prop))
            return false;
        return prop.ValueKind == JsonValueKind.True;
    }
}

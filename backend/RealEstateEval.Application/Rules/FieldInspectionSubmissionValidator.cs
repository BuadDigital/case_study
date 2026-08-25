using System.Globalization;
using System.Text.Json;

namespace RealEstateEval.Application.Rules;

/// <summary>
/// Server-side validation for field-inspection party task payloads —
/// mirrors <c>validateInspectorWorkspace</c> / <c>listInspectorPhotoValidationIssues</c> in the MFE.
/// Proof photos (feature table, showroom/well, services/amenities) are required
/// when the corresponding value or slot is selected.
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
            errors["observations"] = "كل ملاحظة يجب أن تتضمن شرحاً";

        if (RequiresMovablesDescription(root))
            errors["movablesDescription"] = "وصف المنقولات مطلوب عند اختيار «نعم»";

        var photoIssues = ListPhotoValidationIssues(root);
        foreach (var issue in photoIssues)
        {
            if (issue.Contains("توثيقية", StringComparison.Ordinal))
                errors["featurePhotos"] = issue;
            else if (issue.Contains("المعرض", StringComparison.Ordinal)
                     || issue.Contains("البئر", StringComparison.Ordinal))
                errors["componentPhotos"] = issue;
            else
                errors["definedPhotos"] = issue;
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

    private static bool RequiresMovablesDescription(JsonElement root)
    {
        if (!root.TryGetProperty("featureValues", out var features) ||
            features.ValueKind != JsonValueKind.Object)
        {
            return false;
        }

        var movables = ReadString(features, "movables");
        if (movables != "نعم") return false;
        return string.IsNullOrWhiteSpace(ReadString(features, "movablesDescription"));
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
        }

        return false;
    }

    private static List<string> ListPhotoValidationIssues(JsonElement root)
    {
        var issues = new List<string>();

        root.TryGetProperty("featureValues", out var featureValues);
        root.TryGetProperty("featurePhotoAttachments", out var featurePhotos);
        foreach (var (key, label, photoOnYes, yesNo) in FeaturePhotoFields)
        {
            var value = featureValues.ValueKind == JsonValueKind.Object
                ? ReadString(featureValues, key)
                : "";
            if (!FeatureRequiresPhoto(photoOnYes, yesNo, value))
                continue;
            if (!HasBoundAttachment(featurePhotos, key))
                issues.Add($"يجب إرفاق صورة توثيقية: {label}");
        }

        if (ParsePositiveCount(root, "showroomCount") > 0
            && !HasBoundAttachment(GetObject(root, "componentPhotoAttachments"), "showroom"))
        {
            issues.Add("يجب إرفاق صورة المعرض");
        }

        if (ParsePositiveCount(root, "wellCount") > 0
            && !HasBoundAttachment(GetObject(root, "componentPhotoAttachments"), "well"))
        {
            issues.Add("يجب إرفاق صورة البئر");
        }

        var (requiredTotal, requiredDone, pendingApproval) = ComputeDefinedPhotoCoverage(root);
        if (requiredDone < requiredTotal)
            issues.Add("وثّق بالصورة كل خدمة/مرفق اخترته في «الخدمات والمرافق المحيطة»");
        if (pendingApproval > 0)
            issues.Add($"{pendingApproval} صورة بانتظار الاعتماد");

        var untagged = CountUntaggedFreePhotos(root);
        if (untagged > 0)
            issues.Add($"{untagged} صورة إضافية بحاجة لتعريف");

        if (HasPhotosWithoutServerAttachment(root))
            issues.Add("يجب رفع الصور إلى الخادم قبل الإرسال");

        return issues;
    }

    private static readonly (string Key, string Label, bool PhotoOnYes, bool YesNo)[] FeaturePhotoFields =
    [
        ("assetSubject", "الأصل محل التقييم", true, false),
        ("facade", "الواجهة", true, false),
        ("propertyUsage", "استخدام العقار", true, false),
        ("zoneStatus", "حالة منطقة العقار", false, false),
        ("buildState", "حالة البناء", true, false),
        ("occupancyState", "حالة الإشغال", false, false),
        ("districtState", "حالة الحي", false, false),
        ("movables", "يوجد منقولات", true, true),
        ("carEntrance", "مدخل السيارة", true, true),
        ("hasBasement", "يوجد قبو", true, true),
        ("hasElevator", "يوجد مصعد", true, true),
        ("hasPool", "يوجد مسبح", true, true),
        ("kitchen", "مطبخ", true, true),
    ];

    private static bool FeatureRequiresPhoto(bool photoOnYes, bool yesNo, string value)
    {
        if (!photoOnYes) return false;
        var trimmed = value.Trim();
        if (trimmed.Length == 0) return false;
        if (yesNo) return trimmed == "نعم";
        return true;
    }

    private static JsonElement GetObject(JsonElement root, string name) =>
        root.TryGetProperty(name, out var el) && el.ValueKind == JsonValueKind.Object
            ? el
            : default;

    private static int ParsePositiveCount(JsonElement root, string name)
    {
        var raw = ReadString(root, name);
        return int.TryParse(raw, out var n) && n > 0 ? n : 0;
    }

    private static bool HasBoundAttachment(JsonElement map, string key)
    {
        if (map.ValueKind != JsonValueKind.Object || !map.TryGetProperty(key, out var el))
            return false;
        if (el.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined)
            return false;
        return (HasNonEmptyString(el, "fileName") || HasNonEmptyString(el, "fileName"))
            && (HasNonEmptyString(el, "attachmentId") || HasNonEmptyString(el, "attachmentId"));
    }

    private static bool HasPhotosWithoutServerAttachment(JsonElement root) =>
        FieldInspectionPayloadAttachments.HasPhotosWithoutServerAttachment(root);

    private static List<string> ListServiceAmenitySlotIds(JsonElement root)
    {
        var slots = new List<string>();

        void Append(string arrayName, string kind)
        {
            if (!root.TryGetProperty(arrayName, out var arr) || arr.ValueKind != JsonValueKind.Array)
                return;

            foreach (var item in arr.EnumerateArray())
            {
                var label = item.ValueKind == JsonValueKind.String
                    ? item.GetString()?.Trim()
                    : null;
                if (string.IsNullOrWhiteSpace(label))
                    continue;
                slots.Add($"{kind}:{label}");
            }
        }

        Append("services", "service");
        Append("amenities", "amenity");
        return slots;
    }

    private static (int RequiredTotal, int RequiredDone, int PendingApproval) ComputeDefinedPhotoCoverage(
        JsonElement root)
    {
        var requiredTotal = 0;
        var requiredDone = 0;
        var pendingApproval = 0;

        root.TryGetProperty("definedPhotos", out var definedPhotos);
        if (definedPhotos.ValueKind != JsonValueKind.Object)
            definedPhotos = default;

        foreach (var slotId in ListServiceAmenitySlotIds(root))
        {
            requiredTotal++;
            if (IsDefinedSlotComplete(definedPhotos, slotId))
                requiredDone++;
        }

        if (definedPhotos.ValueKind == JsonValueKind.Object)
        {
            foreach (var slotId in ListServiceAmenitySlotIds(root))
            {
                if (!definedPhotos.TryGetProperty(slotId, out var slot) ||
                    slot.ValueKind != JsonValueKind.Object)
                {
                    continue;
                }

                if (!slot.TryGetProperty("photos", out var photos) ||
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

    private static bool HasPhotoFileName(JsonElement element) =>
        HasNonEmptyString(element, "fileName") || HasNonEmptyString(element, "fileName");

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

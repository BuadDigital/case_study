using System.Globalization;
using System.Text.Json;
using RealEstateEval.Domain;

namespace RealEstateEval.Application.Rules;

/// <summary>
/// Server-side validation for field-inspection party task payloads —
/// mirrors <c>validateInspectorWorkspace</c> / <c>listInspectorPhotoValidationIssues</c> in the MFE.
/// Proof photos (feature table, showroom/well) are required when the corresponding
/// value is selected; services/amenities proof photos are optional.
/// Building-only rows and component counts are skipped for vacant land.
/// </summary>
public static class FieldInspectionSubmissionValidator
{
    /// <summary>`featurePhotoAttachments` slot of the «وصف العقار» alternative photo.</summary>
    public const string PropertyDescriptionPhotoKey = "propertyDescription";

    private const double SaudiLatMin = 16;
    private const double SaudiLatMax = 33;
    private const double SaudiLngMin = 34;
    private const double SaudiLngMax = 56;

    private static readonly HashSet<string> LegacySeaCoords = new(StringComparer.Ordinal)
    {
        "21.5433,39.1728",
        "21.543300,39.172800",
    };

    private static readonly HashSet<string> LandHiddenFeatureKeys = new(StringComparer.Ordinal)
    {
        "facade",
        "propertyCondition",
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
    };

    /// <param name="today">Riyadh's date; tests pin it, the server reads the clock.</param>
    public static Dictionary<string, string> Validate(JsonElement root, DateOnly? today = null)
    {
        var errors = new Dictionary<string, string>();

        if (!HasNonEmptyString(root, "inspectionDate"))
            errors["inspectionDate"] = "تاريخ المعاينة مطلوب";
        // A visit cannot have happened tomorrow — a typed future date was printed on the photo stamp
        // and in the report (2026-10-28 A→Z).
        else if (DateOnly.TryParse(ReadString(root, "inspectionDate"), CultureInfo.InvariantCulture, out var visited)
            && visited > (today ?? RiyadhClock.Today(TimeProvider.System)))
            errors["inspectionDate"] = "تاريخ المعاينة لا يكون في المستقبل";

        if (!HasNonEmptyString(root, "inspectionTime"))
            errors["inspectionTime"] = "وقت المعاينة مطلوب";

        if (!ValidateGps(root))
            errors["mapLatitude"] = "يجب تحديد موقع العقار (GPS)";

        if (!HasNonEmptyString(root, "accessContactName"))
            errors["accessContactName"] = "الاسم مطلوب";
        if (!HasNonEmptyString(root, "accessContactPhone"))
            errors["accessContactPhone"] = "رقم الجوال مطلوب";
        if (!HasNonEmptyString(root, "accessContactRole"))
            errors["accessContactRole"] = "الصلة مطلوبة";
        if (errors.ContainsKey("accessContactName")
            || errors.ContainsKey("accessContactPhone")
            || errors.ContainsKey("accessContactRole"))
        {
            errors["accessRouteDescription"] = "أكمل بيانات من سهّل الوصول (الاسم، رقم الجوال، الصلة)";
        }

        if (!GetBool(root, "inspectionConfirmed"))
            errors["inspectionConfirmed"] = "يجب التأشير على إقرار المعاينة";

        if (HasIncompleteObservations(root))
            errors["observations"] = "كل ملاحظة يجب أن تتضمن شرحاً";

        if (RequiresMovablesDescription(root))
            errors["movablesDescription"] = "وصف المنقولات مطلوب عند اختيار «نعم»";

        if (RequiresOccupancyDescription(root))
            errors["occupancyDescription"] = "سبب الإشغال مطلوب عند اختيار «مشغول»";

        // «وصف العقار»: a written description or a photo of the components' details — at least one.
        if (string.IsNullOrWhiteSpace(ReadString(root, "propertyDescription"))
            && !HasBoundAttachment(GetObject(root, "featurePhotoAttachments"), PropertyDescriptionPhotoKey))
            errors["propertyDescription"] = "أدخل وصف العقار أو أرفق صورة لتفاصيل المكونات";

        foreach (var (key, label) in WholeCountFields)
        {
            if (!IsBlankOrWholeCount(ReadString(root, key)))
                errors[key] = $"«{label}» رقم صحيح من صفر فأكثر";
        }
        if (!IsBlankOrNonNegativeNumber(ReadString(root, "streetWidthM")))
            errors["streetWidthM"] = "«عرض الشارع» رقم من صفر فأكثر";

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

    /// <summary>
    /// Counts the inspector types as text (rooms … age). «-3», «خمسة» and «1e9» used to be stored and
    /// printed in the report and the Enfaz package (2026-10-28); the screen now keeps digits only and
    /// the server refuses anything else — a stale client or a direct API call included.
    /// </summary>
    private static readonly (string Key, string Label)[] WholeCountFields =
    [
        ("roomCount", "عدد الغرف"),
        ("hallCount", "عدد الصالات"),
        ("unitCount", "عدد الشقق"),
        ("bathroomCount", "دورات المياه"),
        ("showroomCount", "المعارض"),
        ("wellCount", "الآبار"),
        ("towerCount", "الأبراج"),
        ("propertyAgeYears", "عمر العقار"),
    ];

    /// <summary>Empty, or digits only (Arabic digits allowed).</summary>
    internal static bool IsBlankOrWholeCount(string? raw)
    {
        var text = (raw ?? "").Trim();
        return text.Length == 0 || text.All(char.IsDigit);
    }

    /// <summary>Empty, or a number read by <see cref="LocaleNumber"/> that is not below zero.</summary>
    internal static bool IsBlankOrNonNegativeNumber(string? raw)
    {
        var text = (raw ?? "").Trim();
        return text.Length == 0 || (LocaleNumber.TryParse(text, out var value) && value >= 0);
    }

    private static bool IsLandInspection(JsonElement root)
    {
        if (GetBool(root, "vacantLand"))
            return true;

        if (!root.TryGetProperty("featureValues", out var features) ||
            features.ValueKind != JsonValueKind.Object)
        {
            return false;
        }

        var subject = ReadFeatureValue(features, "assetSubject");
        return LooksLikeVacantLand(subject);
    }

    private static bool LooksLikeVacantLand(string value)
    {
        var normalized = value
            .Replace("أ", "ا")
            .Replace("إ", "ا")
            .Replace("آ", "ا")
            .Replace("ٱ", "ا")
            .Trim();
        if (normalized.Length == 0 || normalized.Contains("ملحق", StringComparison.Ordinal))
            return false;
        return normalized.Contains("ارض", StringComparison.Ordinal)
            || normalized.Contains("أرض", StringComparison.Ordinal)
            || normalized.Contains("land", StringComparison.OrdinalIgnoreCase);
    }

    private static string ReadFeatureValue(JsonElement features, string key)
    {
        if (features.ValueKind != JsonValueKind.Object)
            return "";
        foreach (var prop in features.EnumerateObject())
        {
            if (!string.Equals(prop.Name, key, StringComparison.OrdinalIgnoreCase))
                continue;
            return prop.Value.ValueKind == JsonValueKind.String
                ? prop.Value.GetString()?.Trim() ?? ""
                : prop.Value.ToString()?.Trim() ?? "";
        }
        return "";
    }

    private static bool IsCommercialShopInspection(JsonElement root)
    {
        if (IsLandInspection(root))
            return false;

        if (!root.TryGetProperty("featureValues", out var features) ||
            features.ValueKind != JsonValueKind.Object)
        {
            return false;
        }

        var subject = ReadFeatureValue(features, "assetSubject");
        return subject.Contains("محل", StringComparison.Ordinal)
            && subject.Contains("تجار", StringComparison.Ordinal);
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

    private static bool RequiresOccupancyDescription(JsonElement root)
    {
        if (!root.TryGetProperty("featureValues", out var features) ||
            features.ValueKind != JsonValueKind.Object)
        {
            return false;
        }

        var occupancy = ReadString(features, "occupancyState");
        if (occupancy != "مشغول") return false;
        return string.IsNullOrWhiteSpace(ReadString(features, "occupancyDescription"));
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
            if (!string.IsNullOrWhiteSpace(text))
                continue;

            // Empty shells (add then leave blank) are optional. Only rows that
            // already have a photo need explanation text.
            if (obs.TryGetProperty("photo", out var photo) &&
                photo.ValueKind is not JsonValueKind.Null and not JsonValueKind.Undefined &&
                HasPhotoFileName(photo))
            {
                return true;
            }
        }

        return false;
    }

    private static List<string> ListPhotoValidationIssues(JsonElement root)
    {
        var issues = new List<string>();
        var isLand = IsLandInspection(root);
        var isShop = IsCommercialShopInspection(root);

        root.TryGetProperty("featureValues", out var featureValues);
        root.TryGetProperty("featurePhotoAttachments", out var featurePhotos);
        foreach (var (key, label, photoOnYes, yesNo) in FeaturePhotoFields)
        {
            if (isLand && LandHiddenFeatureKeys.Contains(key))
                continue;
            var value = featureValues.ValueKind == JsonValueKind.Object
                ? ReadFeatureValue(featureValues, key)
                : "";
            if (!FeatureRequiresPhoto(photoOnYes, yesNo, value))
                continue;
            if (!HasBoundAttachment(featurePhotos, key)
                && !(key == "movables" && HasMovablesSlotPhoto(root)))
                issues.Add($"يجب إرفاق صورة توثيقية: {label}");
        }

        if (!isLand
            && ParsePositiveCount(root, "showroomCount") > 0
            && !HasBoundAttachment(GetObject(root, "componentPhotoAttachments"), "showroom"))
        {
            issues.Add("يجب إرفاق صورة المعرض");
        }

        if (!isLand
            && !isShop
            && ParsePositiveCount(root, "wellCount") > 0
            && !HasBoundAttachment(GetObject(root, "componentPhotoAttachments"), "well"))
        {
            issues.Add("يجب إرفاق صورة البئر");
        }

        // «الخدمات والمرافق المحيطة» proof photos are optional — do not block submission.
        // Free-photo kind tagging is optional — do not block submission.
        // Pending-approval extras in an otherwise complete slot are not a submit blocker.

        if (HasPhotosWithoutServerAttachment(root))
            issues.Add("يجب رفع الصور إلى الخادم قبل الإرسال");

        return issues;
    }

    // PhotoOnYes = the proof photo BLOCKS submit. Omar 2026-10-21: a photo offered on a chosen
    // component (مسبح، مصعد، قبو، مطبخ، مدخل سيارة، منقولات) is optional — the picker stays, nothing
    // blocks; every row is false now (kept as a switch). Showroom / well photos are separate rules.
    private static readonly (string Key, string Label, bool PhotoOnYes, bool YesNo)[] FeaturePhotoFields =
    [
        ("assetSubject", "الأصل محل التقييم", false, false),
        ("facade", "الواجهة", false, false),
        ("propertyUsage", "استخدام العقار", false, false),
        ("zoneStatus", "حالة منطقة العقار", false, false),
        ("propertyCondition", "حالة العقار", false, false),
        ("buildState", "حالة البناء", false, false),
        ("occupancyState", "حالة الإشغال", false, false),
        ("districtState", "حالة الحي", false, false),
        ("movables", "يوجد منقولات", false, true),
        ("carEntrance", "مدخل السيارة", false, true),
        ("hasBasement", "يوجد قبو", false, true),
        ("hasElevator", "يوجد مصعد", false, true),
        ("hasPool", "يوجد مسبح", false, true),
        ("hasFence", "يوجد سور", false, true),
        ("hasCentralAc", "تكييف مركزي", false, true),
        ("hasTanks", "خزانات", false, true),
        ("hasLandscaping", "تشجير", false, true),
        ("kitchen", "مطبخ", false, true),
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
        // JSON names are case-sensitive here: accept the camelCase the app sends and the PascalCase
        // a server-side re-serialisation writes (the second check repeated the first before).
        return (HasNonEmptyString(el, "fileName") || HasNonEmptyString(el, "FileName"))
            && (HasNonEmptyString(el, "attachmentId") || HasNonEmptyString(el, "AttachmentId"));
    }

    /// <summary>
    /// «يوجد منقولات» photos are kept in the multi-photo slot <c>definedPhotos["feature:movables"]</c>;
    /// any one uploaded photo satisfies the proof-photo rule (the old single proof slot still does too).
    /// </summary>
    private static bool HasMovablesSlotPhoto(JsonElement root)
    {
        var defined = GetObject(root, "definedPhotos");
        if (defined.ValueKind != JsonValueKind.Object
            || !defined.TryGetProperty("feature:movables", out var slot)
            || slot.ValueKind != JsonValueKind.Object
            || !slot.TryGetProperty("photos", out var photos)
            || photos.ValueKind != JsonValueKind.Array)
            return false;
        foreach (var photo in photos.EnumerateArray())
        {
            if (photo.ValueKind == JsonValueKind.Object
                && HasNonEmptyString(photo, "fileName")
                && HasNonEmptyString(photo, "attachmentId"))
                return true;
        }
        return false;
    }

    private static bool HasPhotosWithoutServerAttachment(JsonElement root) =>
        FieldInspectionPayloadAttachments.HasPhotosWithoutServerAttachment(root);

    private static bool HasPhotoFileName(JsonElement element) =>
        HasNonEmptyString(element, "fileName");

    private static bool TryParseCoord(string raw, out double value)
    {
        return double.TryParse(
            raw.Trim(),
            NumberStyles.Float,
            CultureInfo.InvariantCulture,
            out value);
    }

    private static string ReadString(JsonElement element, string name) =>
        JsonElementReader.ReadString(element, name);

    private static bool HasNonEmptyString(JsonElement element, string name) =>
        JsonElementReader.HasNonEmptyString(element, name);

    private static bool GetBool(JsonElement element, string name) =>
        JsonElementReader.GetBool(element, name);
}

using System.Globalization;
using System.Text.Json;

namespace RealEstateEval.Application.Rules;

/// <summary>
/// Server-side validation for field-inspection party task payloads —
/// mirrors <c>validateInspectorWorkspace</c> / <c>listInspectorPhotoValidationIssues</c> in the MFE.
/// Proof photos (feature table, showroom/well, services/amenities) are optional —
/// a missing one never blocks submission.
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
        if (photoIssues.Count > 0)
            errors["definedPhotos"] = photoIssues[0];

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

        // Proof photos (feature table, showroom/well, services/amenities) are
        // optional — only already-uploaded photos are checked below (pending
        // approval / not yet on the server), never whether one exists at all.
        var (_, _, pendingApproval) = ComputeDefinedPhotoCoverage(root);
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
        HasNonEmptyString(element, "fileName");

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

using System.Globalization;
using System.Text.Json;
using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Application.Rules;

namespace RealEstateEval.CaseStudy.Application.Rules;

public static class FieldInspectionWorkspaceProjector
{
    public static FieldInspectionWorkspace Project(
        PartyTaskSubmission submission,
        JsonElement root,
        DateTime utcNow)
    {
        var (requiredTotal, requiredDone, pendingApproval) = ComputePhotoCoverage(root);
        var observationCount = CountObservations(root);
        var attachmentCount = FieldInspectionPayloadAttachments.Collect(root).Count;

        TryParseCoord(ReadString(root, "mapLatitude"), out var lat);
        TryParseCoord(ReadString(root, "mapLongitude"), out var lng);

        DateOnly? inspectionDate = null;
        if (DateOnly.TryParse(ReadString(root, "inspectionDate"), out var parsedDate))
            inspectionDate = parsedDate;

        var now = utcNow;
        return new FieldInspectionWorkspace
        {
            WorkflowTaskId = submission.WorkflowTaskId,
            PartyTaskSubmissionId = submission.Id,
            PropertyId = submission.PropertyId,
            PoNumber = submission.PoNumber,
            InspectionDate = inspectionDate,
            InspectionTime = NullIfEmpty(ReadString(root, "inspectionTime")),
            MapLatitude = lat,
            MapLongitude = lng,
            InspectionConfirmed = GetBool(root, "inspectionConfirmed"),
            Status = submission.Status,
            RequiredPhotoSlots = requiredTotal,
            CompletedPhotoSlots = requiredDone,
            PendingPhotoApprovals = pendingApproval,
            ObservationCount = observationCount,
            AttachmentCount = attachmentCount,
            SubmittedAtUtc = submission.SubmittedAtUtc,
            CreatedAtUtc = submission.CreatedAtUtc == default ? now : submission.CreatedAtUtc,
            UpdatedAtUtc = submission.UpdatedAtUtc == default ? now : submission.UpdatedAtUtc,
        };
    }

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

    private static (int RequiredTotal, int RequiredDone, int PendingApproval) ComputePhotoCoverage(
        JsonElement root)
    {
        var requiredTotal = 0;
        var requiredDone = 0;
        var pendingApproval = 0;

        root.TryGetProperty("definedPhotos", out var definedPhotos);
        if (definedPhotos.ValueKind != JsonValueKind.Object)
            definedPhotos = default;

        var slotIds = ListServiceAmenitySlotIds(root);
        foreach (var slotId in slotIds)
        {
            requiredTotal++;
            if (IsDefinedSlotComplete(definedPhotos, slotId))
                requiredDone++;
        }

        if (definedPhotos.ValueKind == JsonValueKind.Object)
        {
            foreach (var slotId in slotIds)
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
            if (GetBool(photo, "approved") && !string.IsNullOrWhiteSpace(ReadString(photo, "fileName")))
                return true;
        }

        return false;
    }

    private static int CountObservations(JsonElement root)
    {
        if (!root.TryGetProperty("observations", out var observations) ||
            observations.ValueKind != JsonValueKind.Array)
        {
            return 0;
        }

        return observations.GetArrayLength();
    }

    private static bool TryParseCoord(string raw, out decimal? value)
    {
        value = null;
        if (string.IsNullOrWhiteSpace(raw))
            return false;
        if (!decimal.TryParse(raw.Trim(), NumberStyles.Float, CultureInfo.InvariantCulture, out var parsed))
            return false;
        value = parsed;
        return true;
    }

    private static string? NullIfEmpty(string value) => Texts.NullIfBlank(value);

    private static string ReadString(JsonElement element, string name) =>
        JsonElementReader.ReadString(element, name);

    private static bool GetBool(JsonElement element, string name) =>
        JsonElementReader.GetBool(element, name);
}

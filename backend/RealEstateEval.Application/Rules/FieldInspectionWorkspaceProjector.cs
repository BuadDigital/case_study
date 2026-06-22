using System.Globalization;
using System.Text.Json;
using RealEstateEval.Domain;

namespace RealEstateEval.Application.Rules;

public static class FieldInspectionWorkspaceProjector
{
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

    public static FieldInspectionWorkspace Project(
        PartyTaskSubmission submission,
        JsonElement root)
    {
        var showAnnex = ReadString(root, "hasAnnex") == "نعم";
        var (requiredTotal, requiredDone, pendingApproval) = ComputePhotoCoverage(root, showAnnex);
        var observationCount = CountObservations(root);
        var attachmentCount = FieldInspectionPayloadAttachments.Collect(root).Count;

        TryParseCoord(ReadString(root, "mapLatitude"), out var lat);
        TryParseCoord(ReadString(root, "mapLongitude"), out var lng);

        DateOnly? inspectionDate = null;
        if (DateOnly.TryParse(ReadString(root, "inspectionDate"), out var parsedDate))
            inspectionDate = parsedDate;

        var now = DateTime.UtcNow;
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

    private static (int RequiredTotal, int RequiredDone, int PendingApproval) ComputePhotoCoverage(
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
                if (!string.IsNullOrWhiteSpace(ReadString(photo, "category")) && !GetBool(photo, "approved"))
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

    private static string? NullIfEmpty(string value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string ReadString(JsonElement element, string name)
    {
        if (!element.TryGetProperty(name, out var prop) || prop.ValueKind != JsonValueKind.String)
            return "";
        return prop.GetString()?.Trim() ?? "";
    }

    private static bool GetBool(JsonElement element, string name)
    {
        if (!element.TryGetProperty(name, out var prop))
            return false;
        return prop.ValueKind == JsonValueKind.True;
    }
}

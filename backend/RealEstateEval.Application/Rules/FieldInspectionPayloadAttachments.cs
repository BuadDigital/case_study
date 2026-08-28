using System.Globalization;
using System.Text.Json;
using RealEstateEval.Domain;

namespace RealEstateEval.Application.Rules;

public readonly record struct FieldInspectionAttachmentRef(Guid AttachmentId, string PhotoRef);

/// <summary>Extracts photo attachment references from a field-inspection payload.</summary>
public static class FieldInspectionPayloadAttachments
{
    public static IReadOnlyList<FieldInspectionAttachmentRef> Collect(JsonElement root)
    {
        var refs = new List<FieldInspectionAttachmentRef>();

        if (root.TryGetProperty("featurePhotoAttachments", out var featureAttachments) &&
            featureAttachments.ValueKind == JsonValueKind.Object)
        {
            foreach (var prop in featureAttachments.EnumerateObject())
            {
                TryAdd(refs, prop.Value, $"feature:{prop.Name}");
            }
        }

        if (root.TryGetProperty("componentPhotoAttachments", out var componentAttachments) &&
            componentAttachments.ValueKind == JsonValueKind.Object)
        {
            foreach (var prop in componentAttachments.EnumerateObject())
            {
                TryAdd(refs, prop.Value, $"component:{prop.Name}");
            }
        }

        if (root.TryGetProperty("definedPhotos", out var definedPhotos) &&
            definedPhotos.ValueKind == JsonValueKind.Object)
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
                    var photoId = ReadInt(photo, "id");
                    if (photoId <= 0) continue;
                    TryAdd(refs, photo, $"slot:{slotProp.Name}:{photoId}");
                }
            }
        }

        if (root.TryGetProperty("freePhotos", out var freePhotos) &&
            freePhotos.ValueKind == JsonValueKind.Array)
        {
            foreach (var photo in freePhotos.EnumerateArray())
            {
                var photoId = ReadInt(photo, "id");
                if (photoId <= 0) continue;
                TryAdd(refs, photo, $"free:{photoId}");
            }
        }

        if (root.TryGetProperty("observations", out var observations) &&
            observations.ValueKind == JsonValueKind.Array)
        {
            foreach (var obs in observations.EnumerateArray())
            {
                var obsId = ReadString(obs, "id");
                if (string.IsNullOrWhiteSpace(obsId)) continue;
                if (!obs.TryGetProperty("photo", out var photo)) continue;
                TryAdd(refs, photo, $"observation:{obsId}");
            }
        }

        return refs;
    }

    public static bool HasPhotosWithoutServerAttachment(JsonElement root)
    {
        if (HasUnboundAttachment(root, "featurePhotoAttachments")) return true;
        if (HasUnboundAttachment(root, "componentPhotoAttachments")) return true;

        if (root.TryGetProperty("definedPhotos", out var definedPhotos) &&
            definedPhotos.ValueKind == JsonValueKind.Object)
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
                    if (IsUnboundPhoto(photo))
                        return true;
                }
            }
        }

        if (root.TryGetProperty("freePhotos", out var freePhotos) &&
            freePhotos.ValueKind == JsonValueKind.Array)
        {
            foreach (var photo in freePhotos.EnumerateArray())
            {
                if (IsUnboundPhoto(photo))
                    return true;
            }
        }

        if (root.TryGetProperty("observations", out var observations) &&
            observations.ValueKind == JsonValueKind.Array)
        {
            foreach (var obs in observations.EnumerateArray())
            {
                if (!obs.TryGetProperty("photo", out var photo)) continue;
                if (IsUnboundPhoto(photo))
                    return true;
            }
        }

        return false;
    }

    private static bool HasUnboundAttachment(JsonElement root, string propertyName)
    {
        if (!root.TryGetProperty(propertyName, out var attachments) ||
            attachments.ValueKind != JsonValueKind.Object)
        {
            return false;
        }

        foreach (var prop in attachments.EnumerateObject())
        {
            if (IsUnboundPhoto(prop.Value))
                return true;
        }

        return false;
    }

    private static bool IsUnboundPhoto(JsonElement attachment)
    {
        if (attachment.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined)
            return false;
        if (string.IsNullOrWhiteSpace(ReadString(attachment, "fileName")))
            return false;
        return !TryReadGuid(attachment, "attachmentId", out _);
    }

    private static void TryAdd(
        ICollection<FieldInspectionAttachmentRef> refs,
        JsonElement attachment,
        string photoRef)
    {
        if (attachment.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined)
            return;
        if (string.IsNullOrWhiteSpace(ReadString(attachment, "fileName")))
            return;
        if (!TryReadGuid(attachment, "attachmentId", out var id))
            return;

        refs.Add(new FieldInspectionAttachmentRef(id, photoRef));
    }

    private static string ReadString(JsonElement element, string name) =>
        JsonElementReader.ReadString(element, name);

    private static int ReadInt(JsonElement element, string name) =>
        JsonElementReader.ReadInt(element, name);

    private static bool TryReadGuid(JsonElement element, string name, out Guid id) =>
        JsonElementReader.TryReadGuid(element, name, out id);
}

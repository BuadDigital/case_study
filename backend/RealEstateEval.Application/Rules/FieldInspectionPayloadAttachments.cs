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

        foreach (var prop in ObjectMembers(root, "featurePhotoAttachments"))
            TryAdd(refs, prop.Value, $"feature:{prop.Name}");

        foreach (var prop in ObjectMembers(root, "componentPhotoAttachments"))
            TryAdd(refs, prop.Value, $"component:{prop.Name}");

        foreach (var (slot, photo) in DefinedSlotPhotos(root))
        {
            var photoId = ReadInt(photo, "id");
            if (photoId <= 0) continue;
            TryAdd(refs, photo, $"slot:{slot}:{photoId}");
        }

        foreach (var photo in ArrayItems(root, "freePhotos"))
        {
            var photoId = ReadInt(photo, "id");
            if (photoId <= 0) continue;
            TryAdd(refs, photo, $"free:{photoId}");
        }

        foreach (var obs in ArrayItems(root, "observations"))
        {
            var obsId = ReadString(obs, "id");
            if (string.IsNullOrWhiteSpace(obsId)) continue;
            if (!obs.TryGetProperty("photo", out var photo)) continue;
            TryAdd(refs, photo, $"observation:{obsId}");
        }

        return refs;
    }

    public static bool HasPhotosWithoutServerAttachment(JsonElement root)
    {
        if (ObjectMembers(root, "featurePhotoAttachments").Any(prop => IsUnboundPhoto(prop.Value))) return true;
        if (ObjectMembers(root, "componentPhotoAttachments").Any(prop => IsUnboundPhoto(prop.Value))) return true;
        if (DefinedSlotPhotos(root).Any(slotPhoto => IsUnboundPhoto(slotPhoto.Photo))) return true;
        if (ArrayItems(root, "freePhotos").Any(IsUnboundPhoto)) return true;

        foreach (var obs in ArrayItems(root, "observations"))
        {
            if (!obs.TryGetProperty("photo", out var photo)) continue;
            if (IsUnboundPhoto(photo))
                return true;
        }

        return false;
    }

    /// <summary>Members of the named object; none when it is absent or not an object.</summary>
    private static IEnumerable<JsonProperty> ObjectMembers(JsonElement root, string name)
    {
        if (!root.TryGetProperty(name, out var value) || value.ValueKind != JsonValueKind.Object)
            yield break;

        foreach (var prop in value.EnumerateObject())
            yield return prop;
    }

    /// <summary>Items of the named array; none when it is absent or not an array.</summary>
    private static IEnumerable<JsonElement> ArrayItems(JsonElement root, string name)
    {
        if (!root.TryGetProperty(name, out var value) || value.ValueKind != JsonValueKind.Array)
            yield break;

        foreach (var item in value.EnumerateArray())
            yield return item;
    }

    /// <summary>Every photo of every defined slot (<c>definedPhotos.{slot}.photos[]</c>), with its slot name.</summary>
    private static IEnumerable<(string Slot, JsonElement Photo)> DefinedSlotPhotos(JsonElement root)
    {
        foreach (var slotProp in ObjectMembers(root, "definedPhotos"))
        {
            if (!slotProp.Value.TryGetProperty("photos", out var photos) ||
                photos.ValueKind != JsonValueKind.Array)
            {
                continue;
            }

            foreach (var photo in photos.EnumerateArray())
                yield return (slotProp.Name, photo);
        }
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

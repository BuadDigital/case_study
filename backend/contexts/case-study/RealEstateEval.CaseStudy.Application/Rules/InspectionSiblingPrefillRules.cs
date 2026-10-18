using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;
using RealEstateEval.Application.Rules;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Application.Rules;

/// <summary>
/// Grouped property (decision 2026-10-18): a deed's inspection starts from its sibling deed's
/// inspection — the site inputs and the photos. Pure rules: which sibling inspection to copy
/// from, whether the destination may still be filled, and how the photo sections travel once
/// the files have been copied to the destination task (each photo gets the id of its copy).
/// </summary>
public static class InspectionSiblingPrefillRules
{
    private static readonly JsonSerializerOptions ReadableJson = new() { Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping };

    /// <summary>
    /// The sibling inspection worth copying: accepted first, then submitted, then a draft with
    /// something in it; the most recently updated of each kind. Null when none has content.
    /// </summary>
    public static PartyTaskSubmission? ChooseSource(IEnumerable<PartyTaskSubmission> siblingInspections) =>
        siblingInspections
            .Where(s => HasContent(s.PayloadJson))
            .OrderByDescending(s => s.AcceptedAtUtc is not null ? 2 : s.Status == PartyTaskSubmissionStatus.Submitted ? 1 : 0)
            .ThenByDescending(s => s.UpdatedAtUtc)
            .FirstOrDefault();

    /// <summary>
    /// The destination may be filled when it does not exist yet, or is a draft / returned
    /// package that was never accepted and holds no photo of its own. A submitted or accepted
    /// inspection, or one the inspector already photographed, is the inspector's word.
    /// </summary>
    public static bool MayPrefill(PartyTaskSubmission? destination) =>
        destination is null
        || (destination.AcceptedAtUtc is null
            && destination.Status is PartyTaskSubmissionStatus.Draft or PartyTaskSubmissionStatus.Reopened
            && !HasPhotoRefs(destination.PayloadJson));

    /// <summary>Any photo bound to a server attachment anywhere in the payload.</summary>
    public static bool HasPhotoRefs(string? payloadJson)
    {
        if (string.IsNullOrWhiteSpace(payloadJson)) return false;
        try
        {
            using var doc = JsonDocument.Parse(payloadJson);
            return doc.RootElement.ValueKind == JsonValueKind.Object
                && FieldInspectionPayloadAttachments.Collect(doc.RootElement).Count > 0;
        }
        catch (JsonException)
        {
            return false;
        }
    }

    /// <summary>The server attachment ids the payload references (photos only).</summary>
    public static IReadOnlyList<Guid> PhotoAttachmentIds(string? payloadJson)
    {
        if (string.IsNullOrWhiteSpace(payloadJson)) return [];
        try
        {
            using var doc = JsonDocument.Parse(payloadJson);
            return doc.RootElement.ValueKind == JsonValueKind.Object
                ? FieldInspectionPayloadAttachments.Collect(doc.RootElement).Select(r => r.AttachmentId).Distinct().ToList()
                : [];
        }
        catch (JsonException)
        {
            return [];
        }
    }

    /// <summary>
    /// Carries the source's photo sections into the destination payload, each photo pointing at
    /// its copy (<paramref name="copies"/>: source id → copied id). A photo without a copy is
    /// left out. Copied slot and free photos start unapproved — the specialist reviews this
    /// deed's photos afresh. Destination sections that already hold photos are not touched.
    /// Returns the merged payload and the number of photos linked.
    /// </summary>
    public static (string Json, int PhotosLinked) MergePhotos(
        string? sourceJson,
        string? destinationJson,
        IReadOnlyDictionary<Guid, Guid> copies)
    {
        var destination = destinationJson ?? "{}";
        if (copies.Count == 0) return (destination, 0);

        JsonObject? source;
        JsonObject? merged;
        try
        {
            source = JsonNode.Parse(string.IsNullOrWhiteSpace(sourceJson) ? "{}" : sourceJson) as JsonObject;
            merged = JsonNode.Parse(string.IsNullOrWhiteSpace(destination) ? "{}" : destination) as JsonObject;
        }
        catch (JsonException)
        {
            return (destination, 0);
        }

        if (source is null || merged is null) return (destination, 0);

        var linked = 0;
        foreach (var section in new[] { "featurePhotoAttachments", "componentPhotoAttachments" })
        {
            if (source[section] is not JsonObject sourceMap) continue;
            if (merged[section] is not JsonObject targetMap)
            {
                targetMap = new JsonObject();
                merged[section] = targetMap;
            }

            foreach (var (key, value) in sourceMap)
            {
                if (targetMap[key] is JsonObject existing && ReadGuid(existing, "attachmentId") is not null) continue;
                var copy = RelinkPhoto(value, copies, resetApproval: false);
                if (copy is null) continue;
                targetMap[key] = copy;
                linked++;
            }
        }

        if (source["definedPhotos"] is JsonObject sourceSlots)
        {
            if (merged["definedPhotos"] is not JsonObject targetSlots)
            {
                targetSlots = new JsonObject();
                merged["definedPhotos"] = targetSlots;
            }

            foreach (var (slot, value) in sourceSlots)
            {
                if (value is not JsonObject sourceSlot) continue;
                if (targetSlots[slot] is JsonObject existingSlot
                    && existingSlot["photos"] is JsonArray held && held.Count > 0)
                {
                    continue;
                }

                var photos = new JsonArray();
                if (sourceSlot["photos"] is JsonArray sourcePhotos)
                {
                    foreach (var photo in sourcePhotos)
                    {
                        var copy = RelinkPhoto(photo, copies, resetApproval: true);
                        if (copy is null) continue;
                        photos.Add(copy);
                        linked++;
                    }
                }

                if (photos.Count == 0 && targetSlots[slot] is not null) continue;
                var slotCopy = new JsonObject
                {
                    ["none"] = sourceSlot["none"]?.DeepClone() ?? JsonValue.Create(false),
                    ["photos"] = photos,
                };
                targetSlots[slot] = slotCopy;
            }
        }

        if (source["freePhotos"] is JsonArray sourceFree
            && (merged["freePhotos"] is not JsonArray heldFree || heldFree.Count == 0))
        {
            var free = new JsonArray();
            foreach (var photo in sourceFree)
            {
                var copy = RelinkPhoto(photo, copies, resetApproval: true);
                if (copy is null) continue;
                free.Add(copy);
                linked++;
            }

            if (free.Count > 0) merged["freePhotos"] = free;
        }

        if (source["observations"] is JsonArray sourceObservations
            && (merged["observations"] is not JsonArray heldObservations || heldObservations.Count == 0))
        {
            var observations = new JsonArray();
            foreach (var observation in sourceObservations)
            {
                if (observation is not JsonObject obs) continue;
                var copy = (JsonObject)obs.DeepClone();
                var photo = RelinkPhoto(obs["photo"], copies, resetApproval: false);
                if (photo is not null) linked++;
                copy["photo"] = photo;
                observations.Add(copy);
            }

            if (observations.Count > 0) merged["observations"] = observations;
        }

        return linked == 0 ? (destination, 0) : (merged.ToJsonString(ReadableJson), linked);
    }

    /// <summary>A clone of the photo pointing at its copy; null when it has no copy (or no file).</summary>
    private static JsonObject? RelinkPhoto(JsonNode? photo, IReadOnlyDictionary<Guid, Guid> copies, bool resetApproval)
    {
        if (photo is not JsonObject obj) return null;
        if (string.IsNullOrWhiteSpace(obj["fileName"]?.GetValue<string>())) return null;
        var id = ReadGuid(obj, "attachmentId");
        if (id is null || !copies.TryGetValue(id.Value, out var copyId)) return null;

        var clone = (JsonObject)obj.DeepClone();
        clone["attachmentId"] = copyId.ToString("D");
        if (resetApproval && clone.ContainsKey("approved")) clone["approved"] = false;
        return clone;
    }

    private static Guid? ReadGuid(JsonObject obj, string key)
    {
        var raw = obj[key] as JsonValue;
        return raw is not null && raw.TryGetValue<string>(out var s) && Guid.TryParse(s, out var g) ? g : null;
    }

    private static bool HasContent(string? payloadJson)
    {
        if (string.IsNullOrWhiteSpace(payloadJson)) return false;
        try
        {
            using var doc = JsonDocument.Parse(payloadJson);
            if (doc.RootElement.ValueKind != JsonValueKind.Object) return false;
            if (FieldInspectionPayloadAttachments.Collect(doc.RootElement).Count > 0) return true;
            if (doc.RootElement.TryGetProperty("featureValues", out var features)
                && features.ValueKind == JsonValueKind.Object)
            {
                foreach (var prop in features.EnumerateObject())
                {
                    if (prop.Value.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(prop.Value.GetString()))
                        return true;
                }
            }

            return false;
        }
        catch (JsonException)
        {
            return false;
        }
    }
}

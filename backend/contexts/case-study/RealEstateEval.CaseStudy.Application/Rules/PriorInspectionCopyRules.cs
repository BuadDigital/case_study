using System.Text.Json;
using System.Text.Json.Nodes;

namespace RealEstateEval.CaseStudy.Application.Rules;

/// <summary>
/// What «نسخ من معاملة سابقة» carries from an earlier inspection of the same deed (2026-11-01 ruling):
/// everything the inspector recorded about the property, never a photo.
/// </summary>
public static class PriorInspectionCopyRules
{
    /// <summary>Photos and files, removed at any depth — a copied photo would pass as this visit's proof.</summary>
    private static readonly HashSet<string> PhotoKeys = new(StringComparer.Ordinal)
    {
        "definedPhotos",
        "freePhotos",
        "featurePhotos",
        "featurePhotoAttachments",
        "componentPhotoAttachments",
        "photo",
        "photos",
        "attachment",
        "attachmentId",
    };

    /// <summary>Facts of the earlier visit, not of the property: this visit states them itself.</summary>
    private static readonly HashSet<string> VisitKeys = new(StringComparer.Ordinal)
    {
        "propertyDisplayId",
        "siteAttendedBy",
        "inspectionDate",
        "inspectionTime",
        "completedOnSiteAtUtc",
        "sourceFingerprintSeen",
        "inspectorMapLatitude",
        "inspectorMapLongitude",
        "mapPinned",
        "keyAvailable",
        "clientDeclarationSigned",
        "declarationPhoneSatisfied",
        "inspectionConfirmed",
        "status",
        "returnNote",
        "submittedAtUtc",
        "updatedAtUtc",
    };

    /// <summary>
    /// The copyable part of a stored inspection payload.
    /// How it works: drops <see cref="VisitKeys"/> at the top level and <see cref="PhotoKeys"/> at every
    /// level, so an observation keeps its text and loses its photo.
    /// Edge cases: a blank or non-object payload copies nothing (an empty object). A selected service
    /// stays selected without its photo, so the submit gate asks for a new one.
    /// </summary>
    public static JsonElement CopyablePayload(string? payloadJson)
    {
        var root = string.IsNullOrWhiteSpace(payloadJson) ? null : JsonNode.Parse(payloadJson) as JsonObject;
        if (root is null) return JsonSerializer.SerializeToElement(new JsonObject());

        foreach (var key in VisitKeys) root.Remove(key);
        RemovePhotos(root);
        return JsonSerializer.SerializeToElement(root);
    }

    private static void RemovePhotos(JsonNode? node)
    {
        switch (node)
        {
            case JsonObject obj:
                foreach (var key in obj.Select(p => p.Key).Where(PhotoKeys.Contains).ToList()) obj.Remove(key);
                foreach (var (_, child) in obj) RemovePhotos(child);
                break;
            case JsonArray array:
                foreach (var child in array) RemovePhotos(child);
                break;
        }
    }
}

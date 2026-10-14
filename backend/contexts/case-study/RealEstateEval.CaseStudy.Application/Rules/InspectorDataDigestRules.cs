using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Rules;

/// <summary>
/// Batch 2C: lets the appraiser see WHICH parts of the inspector's package changed since he last looked.
/// A pure function over the inspector payload (plus the property's components table and the specialist's
/// components text) → one short stable hash per section. The appraiser's client keeps the encoded string it
/// acknowledged under <see cref="SeenPayloadKey"/> in his own draft payload; the server only compares.
/// <para>
/// Canonical form per section: sorted keys, trimmed strings, numbers as invariant text, empty values
/// (null, "", empty arrays / objects) and <c>false</c> dropped — so a missing key, an empty string and an
/// untouched checkbox are the same — and the volatile bookkeeping keys ignored at every depth. The one
/// place <c>false</c> carries meaning is a boundary's tri-state <c>matches</c>, kept as is.
/// </para>
/// </summary>
public static class InspectorDataDigestRules
{
    /// <summary>Key in the appraiser's own payload holding the fingerprint he acknowledged.</summary>
    public const string SeenPayloadKey = "inspectorDataSeen";

    public const string AssetType = "assetType";
    public const string Components = "components";
    public const string Area = "area";
    public const string Age = "age";
    public const string Boundaries = "boundaries";
    public const string Location = "location";
    public const string Photos = "photos";
    public const string Narrative = "narrative";
    public const string Services = "services";

    /// <summary>The sections, in the order they are encoded.</summary>
    public static readonly IReadOnlyList<string> GroupKeys =
    [
        AssetType, Components, Area, Age, Boundaries, Location, Photos, Narrative, Services,
    ];

    /// <summary>Bookkeeping keys that change without the inspector's data changing.</summary>
    private static readonly HashSet<string> VolatileKeys = new(StringComparer.Ordinal)
    {
        "status",
        "returnNote",
        "submittedAtUtc",
        "updatedAtUtc",
        "completedOnSiteAtUtc",
        "inspectionConfirmed",
        "sourceFingerprintSeen",
        SeenPayloadKey,
    };

    /// <summary>Payload keys owned by each section (top level; <c>featureValues</c> is split separately).</summary>
    private static readonly IReadOnlyDictionary<string, string[]> PayloadKeysByGroup =
        new Dictionary<string, string[]>(StringComparer.Ordinal)
        {
            [AssetType] = ["vacantLand"],
            [Components] =
            [
                "unitCount", "roomCount", "hallCount", "bathroomCount", "showroomCount", "wellCount",
                "towerCount", "jacuzziCount", "diningCount", "majlisCount", "maidRoomCount",
                "guardRoomCount", "parkingCount", "playgroundCount", "storeCount",
            ],
            [Area] =
            [
                "builtArea", "buildingFloors", "basementTotal", "annexTotal", "annexUpperCount",
                "annexGroundCount", "buildingsTotal", "hasAnnex",
            ],
            [Age] = ["propertyAgeYears", "buildLicenseNumber", "buildLicenseDate"],
            [Boundaries] = ["boundaryMatches", "deedMatchesNature"],
            [Location] =
            [
                "mapLatitude", "mapLongitude", "inspectorMapLatitude", "inspectorMapLongitude",
                "mapPinned", "streetName", "mainStreetName", "streetWidthM",
            ],
            [Photos] =
            [
                "definedPhotos", "freePhotos", "featurePhotoAttachments", "componentPhotoAttachments",
            ],
            [Narrative] =
            [
                "propertyDescription", "districtProsCons", "assetNotes", "observations",
                "hasViolations", "violationsCount", "violationsDescription",
            ],
            [Services] =
            [
                "services", "amenities", "electricityMeterCount", "electricityMeterNumbers",
                "waterMeterCount", "waterMeterNumbers",
            ],
        };

    /// <summary>
    /// The per-section hashes of a package. <paramref name="inventoryLines"/> and
    /// <paramref name="specialistComponentsText"/> belong to the components section; pass null when the
    /// property is not at hand (a payload-only comparison).
    /// </summary>
    public static IReadOnlyDictionary<string, string> Compute(
        string? payloadJson,
        IEnumerable<BuildingInventoryLine>? inventoryLines = null,
        string? specialistComponentsText = null)
    {
        var root = ParseRoot(payloadJson);
        var result = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var group in GroupKeys)
        {
            var content = new JsonObject();
            foreach (var key in PayloadKeysByGroup[group])
                AddCanonical(content, key, root, key);

            if (group == AssetType)
                AddCanonical(content, "assetSubject", FeatureValues(root), "assetSubject");
            else if (group == Narrative)
                content["featureValues"] = Canonical(RestOfFeatureValues(root), keepFalse: false);
            else if (group == Components)
            {
                var lines = InventoryJson(inventoryLines);
                if (lines is not null) content["inventory"] = lines;
                var text = (specialistComponentsText ?? "").Trim();
                if (text.Length > 0) content["componentsText"] = text;
            }

            // Drop members that canonicalized to nothing so the hash does not depend on them.
            var canonical = Canonical(content, keepFalse: false);
            result[group] = Hash(canonical?.ToJsonString() ?? "");
        }

        return result;
    }

    /// <summary><c>group:hash;group:hash</c> in <see cref="GroupKeys"/> order.</summary>
    public static string Encode(IReadOnlyDictionary<string, string> hashes) =>
        string.Join(
            ";",
            GroupKeys
                .Where(hashes.ContainsKey)
                .Select(g => $"{g}:{hashes[g]}"));

    /// <summary>The encoded fingerprint of a package — what the appraiser's client stores as seen.</summary>
    public static string Fingerprint(
        string? payloadJson,
        IEnumerable<BuildingInventoryLine>? inventoryLines = null,
        string? specialistComponentsText = null) =>
        Encode(Compute(payloadJson, inventoryLines, specialistComponentsText));

    /// <summary>Parses an encoded fingerprint; null when it is blank or not in the expected shape.</summary>
    public static IReadOnlyDictionary<string, string>? Decode(string? encoded)
    {
        if (string.IsNullOrWhiteSpace(encoded)) return null;
        var result = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var part in encoded.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            var colon = part.IndexOf(':');
            if (colon <= 0 || colon == part.Length - 1) return null;
            var group = part[..colon];
            if (!GroupKeys.Contains(group, StringComparer.Ordinal)) return null;
            result[group] = part[(colon + 1)..];
        }

        return result.Count == 0 ? null : result;
    }

    /// <summary>
    /// The sections whose hash differs from the acknowledged baseline, in <see cref="GroupKeys"/> order.
    /// A missing or unreadable baseline, and a section the baseline does not carry, yield no change —
    /// the first open of a package cannot be «changed».
    /// </summary>
    public static IReadOnlyList<string> ChangedGroups(
        string? seenEncoded,
        IReadOnlyDictionary<string, string> current)
    {
        var seen = Decode(seenEncoded);
        if (seen is null) return [];
        return GroupKeys
            .Where(g => seen.TryGetValue(g, out var before)
                && current.TryGetValue(g, out var now)
                && !string.Equals(before, now, StringComparison.Ordinal))
            .ToList();
    }

    /// <summary>The sections that differ between two payloads (payload-only comparison).</summary>
    public static IReadOnlyList<string> ChangedBetweenPayloads(string? beforeJson, string? afterJson)
    {
        var before = Compute(beforeJson);
        var after = Compute(afterJson);
        return GroupKeys
            .Where(g => !string.Equals(before[g], after[g], StringComparison.Ordinal))
            .ToList();
    }

    // ------------------------------------------------------------------ canonical form

    private static JsonObject ParseRoot(string? payloadJson)
    {
        if (string.IsNullOrWhiteSpace(payloadJson)) return new JsonObject();
        try
        {
            return JsonNode.Parse(payloadJson) as JsonObject ?? new JsonObject();
        }
        catch (JsonException)
        {
            return new JsonObject();
        }
    }

    private static JsonObject? FeatureValues(JsonObject root) =>
        root["featureValues"] as JsonObject;

    private static JsonObject RestOfFeatureValues(JsonObject root)
    {
        var rest = new JsonObject();
        if (FeatureValues(root) is not { } values) return rest;
        foreach (var (key, value) in values)
        {
            if (string.Equals(key, "assetSubject", StringComparison.Ordinal)) continue;
            rest[key] = value?.DeepClone();
        }

        return rest;
    }

    private static void AddCanonical(JsonObject target, string targetKey, JsonObject? source, string sourceKey)
    {
        if (source is null || !source.TryGetPropertyValue(sourceKey, out var value) || value is null) return;
        target[targetKey] = value.DeepClone();
    }

    private static JsonArray? InventoryJson(IEnumerable<BuildingInventoryLine>? lines)
    {
        if (lines is null) return null;
        var array = new JsonArray();
        foreach (var line in lines.OrderBy(l => l.SortOrder))
        {
            array.Add(new JsonObject
            {
                ["kind"] = line.StructureKind,
                ["label"] = line.Label,
                ["area"] = line.AreaSqm,
                ["itemKey"] = line.ItemKey,
                ["unit"] = line.Unit,
                ["ratio"] = line.BuildRatioPct?.ToString("0.####", CultureInfo.InvariantCulture),
                ["floors"] = line.RepeatedFloorCount?.ToString(CultureInfo.InvariantCulture),
                ["notes"] = line.Notes,
            });
        }

        return array.Count == 0 ? null : array;
    }

    /// <summary>
    /// Canonical copy of a node, or null when it carries nothing. Objects: sorted keys, volatile keys and
    /// empty members dropped. Arrays keep their order except arrays of plain strings (sets, e.g.
    /// <c>services</c>), which are sorted.
    /// </summary>
    private static JsonNode? Canonical(JsonNode? node, bool keepFalse)
    {
        switch (node)
        {
            case null:
                return null;
            case JsonObject obj:
            {
                var result = new JsonObject();
                foreach (var name in obj.Select(kv => kv.Key).OrderBy(k => k, StringComparer.Ordinal))
                {
                    if (VolatileKeys.Contains(name)) continue;
                    var child = Canonical(obj[name], keepFalse || name == "matches");
                    if (child is not null) result[name] = child;
                }

                return result.Count == 0 ? null : result;
            }
            case JsonArray array:
            {
                var items = array
                    .Select(item => Canonical(item, keepFalse))
                    .Where(item => item is not null)
                    .ToList();
                if (items.Count == 0) return null;
                if (items.All(i => i is JsonValue v && v.TryGetValue<string>(out _)))
                {
                    items = items
                        .OrderBy(i => i!.GetValue<string>(), StringComparer.Ordinal)
                        .ToList();
                }

                var result = new JsonArray();
                foreach (var item in items) result.Add(item);
                return result;
            }
            case JsonValue value:
            {
                if (value.TryGetValue<string>(out var text))
                {
                    var trimmed = text.Trim();
                    return trimmed.Length == 0 ? null : JsonValue.Create(trimmed);
                }

                if (value.TryGetValue<bool>(out var flag))
                    return flag || keepFalse ? JsonValue.Create(flag) : null;

                var element = value.GetValue<JsonElement>();
                return element.ValueKind switch
                {
                    JsonValueKind.Number => JsonValue.Create(
                        element.TryGetDecimal(out var number)
                            ? number.ToString("0.############", CultureInfo.InvariantCulture)
                            : element.GetRawText()),
                    JsonValueKind.Null or JsonValueKind.Undefined => null,
                    _ => JsonValue.Create(element.ToString()),
                };
            }
            default:
                return null;
        }
    }

    private static string Hash(string canonical)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(canonical));
        return Convert.ToHexString(bytes, 0, 6).ToLowerInvariant();
    }
}

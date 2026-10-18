using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Rules;

/// <summary>
/// When two deeds are confirmed as one grouped property (decision 2026-10-15), the data one of
/// them already carries is copied onto the other — once, at the link, and only into what is
/// still empty. Nothing typed by a person is ever overwritten, and the two work orders stay
/// administratively independent.
///
/// What travels: the intake / bourse fields that describe the property rather than the deed
/// (owner, restrictions, place, court, classification, plan, finishing …), the contacts, the
/// uploaded documents' names (the files themselves are copied by the screen, which holds the
/// bytes) and the inspector's draft inputs. What stays per deed: deed number and dates, the
/// registry number, request and mandate numbers, plot number, area, the boundaries and the
/// partition minutes — every deed has its own.
/// </summary>
public static class PropertyGroupDataSyncRules
{
    /// <summary>Arabic stays readable in the stored payload, as the screen writes it.</summary>
    private static readonly JsonSerializerOptions ReadableJson = new() { Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping };

    private sealed record TextField(string Name, Func<WorkOrderProperty, string?> Get, Action<WorkOrderProperty, string> Set);

    private sealed record IdField(string Name, Func<WorkOrderProperty, Guid?> Get, Action<WorkOrderProperty, Guid> Set);

    /// <summary>Property-level text fields that may be filled from the sibling deed.</summary>
    private static readonly TextField[] SharedTextFields =
    [
        new("ownerName", p => p.OwnerName, (p, v) => p.OwnerName = v),
        new("deedOwnersJson", p => p.DeedOwnersJson, (p, v) => p.DeedOwnersJson = v),
        new("restrictionsPresent", p => p.RestrictionsPresent, (p, v) => p.RestrictionsPresent = v),
        new("restrictionType", p => p.RestrictionType, (p, v) => p.RestrictionType = v),
        new("restrictionOtherReason", p => p.RestrictionOtherReason, (p, v) => p.RestrictionOtherReason = v),
        new("city", p => p.City, (p, v) => p.City = v),
        new("region", p => p.Region, (p, v) => p.Region = v),
        new("district", p => p.District, (p, v) => p.District = v),
        new("deedStatus", p => p.DeedStatus, (p, v) => p.DeedStatus = v),
        new("court", p => p.Court, (p, v) => p.Court = v),
        new("circuit", p => p.Circuit, (p, v) => p.Circuit = v),
        new("classification", p => p.Classification, (p, v) => p.Classification = v),
        new("propertyType", p => p.PropertyType, (p, v) => p.PropertyType = v),
        new("planNumber", p => p.PlanNumber, (p, v) => p.PlanNumber = v),
        new("planName", p => p.PlanName, (p, v) => p.PlanName = v),
        new("blockNumber", p => p.BlockNumber, (p, v) => p.BlockNumber = v),
        new("locationMapUrl", p => p.LocationMapUrl, (p, v) => p.LocationMapUrl = v),
        new("finishingType", p => p.FinishingType, (p, v) => p.FinishingType = v),
        new("finishingStructure", p => p.FinishingStructure, (p, v) => p.FinishingStructure = v),
        new("searchScopeNotes", p => p.SearchScopeNotes, (p, v) => p.SearchScopeNotes = v),
    ];

    private static readonly IdField[] SharedIdFields =
    [
        new("courtId", p => p.CourtId, (p, v) => p.CourtId = v),
        new("circuitId", p => p.CircuitId, (p, v) => p.CircuitId = v),
        new("regionId", p => p.RegionId, (p, v) => p.RegionId = v),
        new("cityId", p => p.CityId, (p, v) => p.CityId = v),
    ];

    /// <summary>Names of the fields that may travel between the deeds of a group (for tests and docs).</summary>
    public static IReadOnlyList<string> SharedFieldNames { get; } =
        SharedTextFields.Select(f => f.Name).Concat(SharedIdFields.Select(f => f.Name)).ToList();

    /// <summary>
    /// Fills every empty shared field of <paramref name="target"/> from <paramref name="source"/>.
    /// Returns the names of the fields that were filled; nothing on the source changes.
    /// </summary>
    public static IReadOnlyList<string> FillEmptyFields(WorkOrderProperty source, WorkOrderProperty target)
    {
        var filled = new List<string>();
        foreach (var field in SharedTextFields)
        {
            var value = field.Get(source);
            if (string.IsNullOrWhiteSpace(value) || !string.IsNullOrWhiteSpace(field.Get(target)))
                continue;
            field.Set(target, value.Trim());
            filled.Add(field.Name);
        }

        foreach (var field in SharedIdFields)
        {
            var value = field.Get(source);
            if (value is null || value == Guid.Empty || field.Get(target) is { } existing && existing != Guid.Empty)
                continue;
            field.Set(target, value.Value);
            filled.Add(field.Name);
        }

        return filled;
    }

    /// <summary>
    /// The contacts to add to <paramref name="target"/> when it has none and the source has some:
    /// fresh rows (new ids, the target's property id), in the source's order. Empty when the
    /// target already has a contact or the source has none.
    /// </summary>
    public static IReadOnlyList<PropertyContact> ContactsToCopy(
        WorkOrderProperty source,
        WorkOrderProperty target,
        DateTime nowUtc)
    {
        if (target.Contacts.Count > 0 || source.Contacts.Count == 0)
            return [];

        return source.Contacts
            .OrderBy(c => c.SortOrder)
            .Select((c, i) => new PropertyContact
            {
                Id = Guid.NewGuid(),
                PropertyId = target.Id,
                Name = c.Name,
                Role = c.Role,
                Phone = c.Phone,
                NationalId = c.NationalId,
                SortOrder = i,
                UpdatedAtUtc = nowUtc,
            })
            .ToList();
    }

    /// <summary>The uploaded documents' stored names, as the screen reports them after copying the files.</summary>
    public sealed record DocumentNames(
        IReadOnlyList<string> AssignmentDocFileNames,
        IReadOnlyList<string> DelegationLetterFileNames,
        IReadOnlyList<string> OtherDocumentFileNames,
        string? RealEstateRegFileName,
        string? DeedOwnershipFileName,
        string? BourseDeedImageFileName,
        string? BoundariesExternalDocName);

    /// <summary>
    /// Records the names of documents the screen copied onto <paramref name="target"/> — only
    /// into name slots that are still empty, so a document the deed already had keeps its name.
    /// Returns the slots that were filled.
    /// </summary>
    public static IReadOnlyList<string> FillEmptyDocumentNames(WorkOrderProperty target, DocumentNames names)
    {
        var filled = new List<string>();

        void List(string slot, IReadOnlyList<string> incoming, Func<string?> get, Action<string?> set)
        {
            if (PropertyFileNameList.Parse(get()).Count > 0) return;
            var serialized = PropertyFileNameList.Serialize(incoming);
            if (serialized is null) return;
            set(serialized);
            filled.Add(slot);
        }

        void Single(string slot, string? incoming, Func<string?> get, Action<string?> set)
        {
            if (!string.IsNullOrWhiteSpace(get()) || string.IsNullOrWhiteSpace(incoming)) return;
            set(incoming.Trim());
            filled.Add(slot);
        }

        List("assignmentDocFileNames", names.AssignmentDocFileNames, () => target.AssignmentDocFileName, v => target.AssignmentDocFileName = v);
        List("delegationLetterFileNames", names.DelegationLetterFileNames, () => target.DelegationLetterFileName, v => target.DelegationLetterFileName = v);
        List("otherDocumentFileNames", names.OtherDocumentFileNames, () => target.OtherDocumentFileNames, v => target.OtherDocumentFileNames = v);
        Single("realEstateRegFileName", names.RealEstateRegFileName, () => target.RealEstateRegFileName, v => target.RealEstateRegFileName = v);
        Single("deedOwnershipFileName", names.DeedOwnershipFileName, () => target.DeedOwnershipFileName, v => target.DeedOwnershipFileName = v);
        Single("bourseDeedImageFileName", names.BourseDeedImageFileName, () => target.BourseDeedImageFileName, v => target.BourseDeedImageFileName = v);
        Single("boundariesExternalDocName", names.BoundariesExternalDocName, () => target.BoundariesExternalDocName, v => target.BoundariesExternalDocName = v);
        return filled;
    }

    /// <summary>
    /// Inspector payload keys that describe the site and may travel between the deeds of a group.
    /// Boundaries (per deed) and photos (bound to the inspection task) never travel; neither do
    /// the ids, the confirmation flags or the client's declaration.
    /// </summary>
    public static readonly IReadOnlyList<string> SharedInspectorKeys =
    [
        // asset / components / areas / age
        "vacantLand", "landHasValuableStructures",
        "unitCount", "roomCount", "hallCount", "bathroomCount", "showroomCount", "wellCount",
        "towerCount", "jacuzziCount", "diningCount", "majlisCount", "maidRoomCount",
        "guardRoomCount", "parkingCount", "playgroundCount", "storeCount",
        "builtArea", "buildingFloors", "basementTotal", "annexTotal", "annexUpperCount",
        "annexGroundCount", "buildingsTotal", "hasAnnex",
        "propertyAgeYears", "buildLicenseNumber", "buildLicenseDate",
        // location and access
        "mapLatitude", "mapLongitude", "inspectorMapLatitude", "inspectorMapLongitude", "mapPinned",
        "streetName", "mainStreetName", "streetWidthM",
        "accessRouteDescription", "accessContactName", "accessContactPhone", "accessContactRole",
        "accessContactNationalId",
        // narrative and services — «observations» carry photos, so they travel with the photo leg
        // (InspectionSiblingPrefillRules.MergePhotos), never as plain text
        "propertyDescription", "districtProsCons", "assetNotes",
        "hasViolations", "violationsCount", "violationsDescription",
        "services", "amenities", "electricityMeterCount", "electricityMeterNumbers",
        "waterMeterCount", "waterMeterNumbers",
    ];

    /// <summary>
    /// Copies the inspector's shared inputs from <paramref name="sourceJson"/> into the empty
    /// slots of <paramref name="targetJson"/>: the top-level keys in
    /// <see cref="SharedInspectorKeys"/> and every entry of <c>featureValues</c>. Returns the
    /// merged payload and the number of slots filled; the payload is unchanged (and the count 0)
    /// when there was nothing to copy or either side is not a JSON object.
    /// </summary>
    public static (string Json, int Filled) FillEmptyInspectorPayload(string? sourceJson, string? targetJson)
    {
        var target = targetJson ?? "{}";
        JsonObject? source;
        JsonObject? merged;
        try
        {
            source = JsonNode.Parse(string.IsNullOrWhiteSpace(sourceJson) ? "{}" : sourceJson) as JsonObject;
            merged = JsonNode.Parse(string.IsNullOrWhiteSpace(target) ? "{}" : target) as JsonObject;
        }
        catch (JsonException)
        {
            return (target, 0);
        }

        if (source is null || merged is null) return (target, 0);

        var filled = 0;
        foreach (var key in SharedInspectorKeys)
        {
            if (!source.TryGetPropertyValue(key, out var value) || IsEmpty(value)) continue;
            if (merged.TryGetPropertyValue(key, out var existing) && !IsEmpty(existing)) continue;
            merged[key] = value?.DeepClone();
            filled++;
        }

        if (source["featureValues"] is JsonObject sourceFeatures)
        {
            if (merged["featureValues"] is not JsonObject targetFeatures)
            {
                targetFeatures = new JsonObject();
                merged["featureValues"] = targetFeatures;
            }

            foreach (var (key, value) in sourceFeatures)
            {
                if (IsEmpty(value)) continue;
                if (targetFeatures.TryGetPropertyValue(key, out var existing) && !IsEmpty(existing)) continue;
                targetFeatures[key] = value?.DeepClone();
                filled++;
            }
        }

        return filled == 0 ? (target, 0) : (merged.ToJsonString(ReadableJson), filled);
    }

    /// <summary>A slot counts as empty when it is missing, null, blank text, false, or an empty array / object.</summary>
    private static bool IsEmpty(JsonNode? node) => node switch
    {
        null => true,
        JsonArray array => array.Count == 0,
        JsonObject obj => obj.Count == 0,
        JsonValue value when value.TryGetValue<string>(out var s) => string.IsNullOrWhiteSpace(s),
        JsonValue value when value.TryGetValue<bool>(out var b) => !b,
        _ => false,
    };
}

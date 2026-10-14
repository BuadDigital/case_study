using System.Text.Json;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Rules;

/// <summary>
/// «مكونات العقار» is the case specialist's: a report text written from the inspector's
/// description (text or photo), plus a building-inventory table the appraiser's direct costs
/// can start from. Before accepting the field inspection the report text is required, and so is
/// a table with at least one line whenever the property has buildings or annexes worth valuing —
/// every non-land asset, and a land asset only when the inspector answered «yes» to
/// <see cref="LandHasValuableStructuresKey"/> (see <see cref="HasStructures"/>).
/// </summary>
public static class SpecialistComponentsRules
{
    public const int TextMaxLength = 8000;

    public const string TextKey = "componentsText";
    public const string InventoryKey = "inventoryLines";

    /// <summary>
    /// Root-level inspector payload key: for an asset typed land, does the land hold buildings or
    /// annexes worth valuing? <c>"yes"</c> | <c>"no"</c> | <c>""</c> (missing/empty = not answered).
    /// Meaningful only when the inspected asset type is land.
    /// </summary>
    public const string LandHasValuableStructuresKey = "landHasValuableStructures";

    public const string LandStructuresYes = "yes";
    public const string LandStructuresNo = "no";

    public const string LandHasValuableStructuresRequired = "حدّد هل في الأرض مبانٍ أو ملاحق تستحق التقييم";

    public const string TextRequired = "اكتب «مكونات العقار» للتقرير قبل قبول المعاينة";

    public const string InventoryRequired =
        "أضف إلى جدول الحصر بنداً واحداً على الأقل للمباني والملاحق قبل قبول المعاينة";

    /// <summary>
    /// Whether the property has buildings or annexes worth valuing that the inventory table must
    /// list. A non-land asset (or a property whose inspected type is not yet known) always does.
    /// An asset the inspector typed «أرض» does only when the inspector explicitly answered
    /// <see cref="LandStructuresYes"/> to <see cref="LandHasValuableStructuresKey"/>; «no», an
    /// empty answer, and a land submission with no such key at all (legacy — submitted before the
    /// question existed) are all treated as no structures, i.e. exempt. The inspector's asset type
    /// is read from <see cref="WorkOrderProperty.InspectedPropertyType"/> (set on submit); the
    /// intake <see cref="WorkOrderProperty.PropertyType"/> / classification are deliberately
    /// ignored, and <see cref="WorkOrderProperty.HasStructuresToValue"/> only records whether lines
    /// were listed, so it cannot tell a land with worthless annexes from an unlisted one. The land
    /// answer lives only in the submitted payload, so the caller passes it
    /// (<see cref="ReadLandHasValuableStructures(string?)"/>).
    /// </summary>
    public static bool HasStructures(WorkOrderProperty property, string? landHasValuableStructures = null) =>
        !IsInspectedLand(property)
        || string.Equals(landHasValuableStructures?.Trim(), LandStructuresYes, StringComparison.OrdinalIgnoreCase);

    /// <summary>The inspector's submitted «الأصل محل التقييم» is land.</summary>
    public static bool IsInspectedLand(WorkOrderProperty property) =>
        !string.IsNullOrWhiteSpace(property.InspectedPropertyType)
        && InspectedPropertyTypeRules.IsLand(property.InspectedPropertyType);

    /// <summary>
    /// The inspector's land-structures answer from an inspector payload root: <c>"yes"</c>,
    /// <c>"no"</c>, or null when missing / empty / not one of the two.
    /// </summary>
    public static string? ReadLandHasValuableStructures(JsonElement root)
    {
        if (root.ValueKind != JsonValueKind.Object
            || !root.TryGetProperty(LandHasValuableStructuresKey, out var value)
            || value.ValueKind != JsonValueKind.String)
        {
            return null;
        }

        var answer = value.GetString()?.Trim().ToLowerInvariant();
        return answer is LandStructuresYes or LandStructuresNo ? answer : null;
    }

    /// <summary><see cref="ReadLandHasValuableStructures(JsonElement)"/> from raw payload JSON; null when unparsable.</summary>
    public static string? ReadLandHasValuableStructures(string? payloadJson)
    {
        if (string.IsNullOrWhiteSpace(payloadJson)) return null;
        try
        {
            using var doc = JsonDocument.Parse(payloadJson);
            return ReadLandHasValuableStructures(doc.RootElement);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    /// <summary>
    /// Every reason the field inspection cannot be accepted yet, keyed <see cref="TextKey"/> and
    /// <see cref="InventoryKey"/>; empty when ready. <paramref name="landHasValuableStructures"/> is
    /// the inspector's submitted land answer (see <see cref="HasStructures"/>).
    /// </summary>
    public static Dictionary<string, string> MissingForAcceptance(
        WorkOrderProperty property,
        string? landHasValuableStructures = null)
    {
        var missing = new Dictionary<string, string>();
        if (string.IsNullOrWhiteSpace(property.SpecialistComponentsText))
            missing[TextKey] = TextRequired;

        if (HasStructures(property, landHasValuableStructures) && property.BuildingInventoryLines.Count == 0)
            missing[InventoryKey] = InventoryRequired;

        return missing;
    }
}

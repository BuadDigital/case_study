using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Valuation.Application.Rules;

/// <summary>
/// When a valuation's subject is valued as land — the market approach compares it with lands, per m²
/// of land. The screens' twin is <c>marketSubjectKind</c> (market-subject.ts).
/// </summary>
public static class SubjectLandRules
{
    /// <summary>
    /// The specialist's inventory lists a floor area (a floor, an annex or a basement with an area) —
    /// a building stands on the land, not only a fence or a room's fittings.
    /// How it works: the cost table's own grouping (<see cref="CostLineItemKeys.IsAreaGroup"/>), so a
    /// catalog floor item, a floor / annex / basement kind, or a custom «other» line named as one
    /// («الدور الثاني», «ملحق علوي» — A→Z #30/#52, 2026-11-04) counts.
    /// Edge cases: a line without an area never counts.
    /// </summary>
    public static bool HasFloorArea(IEnumerable<CaseStudyBuildingInventoryLineDto>? lines) =>
        (lines ?? []).Any(l =>
            CostLineItemKeys.IsAreaGroup(l.ItemKey, l.StructureKind, l.Label)
            && LocaleNumber.TryParsePositive(l.AreaSqm, out _));

    /// <summary>
    /// What: the subject is land valued on its own — a land deed with no building on it. A fence or a
    /// room's fittings do not make it a building; a floor area does («أرض تجارية + مستودع» is valued
    /// as a building).
    /// Edge cases: an inventory that could not be read counts as no floor area, so the type decides.
    /// </summary>
    public static bool IsValuedAsLand(
        string? propertyType,
        IEnumerable<CaseStudyBuildingInventoryLineDto>? inventory) =>
        ValuationApproachSettingsRules.IsLandPropertyType(propertyType) && !HasFloorArea(inventory);

    /// <summary>
    /// What: the land a built subject stands on, as its deed states it — what the land-area line of
    /// its market table compares with until the appraiser types another figure (2026-11-15).
    /// Edge cases: a unit inside a building (an apartment, a shop, a floor) has no land of its own on
    /// its deed — the deed's area is the unit's — so there is no default and the appraiser enters the
    /// land share, or leaves the land line out. An unreadable or empty area gives none.
    /// </summary>
    public static decimal? DeedLandAreaOfBuiltSubject(string? propertyType, string? deedArea)
    {
        var type = (propertyType ?? "").Trim();
        if (PropertyTypeCatalog.ClassificationOf(type) == PropertyTypeCatalog.UnitInBuilding
            || type.Contains("شقة", StringComparison.Ordinal)
            || type.Contains("شقه", StringComparison.Ordinal))
        {
            return null;
        }

        return LocaleNumber.TryParsePositive(deedArea, out var area) ? area : null;
    }
}

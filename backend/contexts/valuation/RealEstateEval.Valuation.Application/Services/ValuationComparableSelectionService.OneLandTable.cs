using RealEstateEval.Domain;
using RealEstateEval.Valuation.Application.Rules;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Valuation.Application.Services;

public sealed partial class ValuationComparableSelectionService
{
    private readonly Dictionary<Guid, bool> _landValuedOnce = [];

    /// <summary>
    /// What: the table a request for <paramref name="selectionContext"/> really reads and writes.
    /// The property's land has one valuation by comparable sales (Omar 2026-11-12: «أرض العقار، سواء
    /// قمت بتقييمها لوحدها أو كجزء من طريقة التكلفة، التسويات واحدة — الأرض هي الأرض وقيمتها ثابتة»):
    /// when the subject is valued as land, the market table IS that valuation, and «تقدير قيمة الأرض
    /// فضاءً» inside the cost approach is the same rows — the same comparables, adjustments, weights
    /// and factor rationales. Nothing is copied and the two can never differ (the copy between the
    /// two tables, 2026-11-11, was removed the next day: «الغي»).
    ///
    /// How it works: for such a subject the land_within_cost context answers with the market table,
    /// on every read and every write. So the cost approach, the reconciliation, the hand-over checks
    /// and the report, which all ask for the land table, get the market table's rows without knowing.
    /// What is shared is the comparison: the land view is computed exactly as the market table —
    /// same area for the area adjustment, same basis, same weights — so one rate per m² of land
    /// comes out of both. What follows it stays each approach's own: the market value is that rate
    /// × the market's area, rounded; the cost approach's land is the rate, less its use-restriction
    /// discount, × the plot it holds, unrounded.
    ///
    /// Edge cases:
    /// - A built subject (فيلا، عمارة، أرض عليها مستودع) keeps two tables: its market table compares
    ///   buildings and says nothing about the land.
    /// - It does not depend on which approaches are switched on: a land valued by the cost approach
    ///   alone fills the same rows the market approach shows once it is switched on.
    /// - Rows saved in land_within_cost for such a subject before this rule stay in the database,
    ///   unread.
    /// </summary>
    private async Task<string> TableOfAsync(
        ValuationRequest request,
        string? selectionContext,
        CancellationToken cancellationToken)
    {
        var context = ComparableSelectionContexts.Normalize(selectionContext);
        return context == ComparableSelectionContexts.LandWithinCost
            && await LandIsValuedOnceAsync(request, cancellationToken)
                ? ComparableSelectionContexts.Market
                : context;
    }

    /// <summary>
    /// The subject is valued as land (<see cref="SubjectLandRules.IsValuedAsLand"/>), by the type the
    /// inspection settled and the specialist's inventory. Asked from the case-study service once per
    /// request and valuation; when it cannot answer, the request's own type decides.
    /// </summary>
    private async Task<bool> LandIsValuedOnceAsync(ValuationRequest request, CancellationToken cancellationToken)
    {
        if (_landValuedOnce.TryGetValue(request.Id, out var known)) return known;
        var facts = caseStudy is null || request.PropertyId == Guid.Empty
            ? null
            : await caseStudy.GetValuationPropertyContextAsync(request.PropertyId, cancellationToken);
        var type = string.IsNullOrWhiteSpace(facts?.EffectivePropertyType())
            ? request.PropertyType
            : facts.EffectivePropertyType();
        return _landValuedOnce[request.Id] =
            SubjectLandRules.IsValuedAsLand(type, facts?.BuildingInventoryLines);
    }
}

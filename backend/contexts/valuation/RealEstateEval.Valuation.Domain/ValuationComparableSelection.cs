namespace RealEstateEval.Valuation.Domain;

/// <summary>
/// Selected comparable from the company bank for a valuation request.
/// Adoption feeds the market approach; adjustment lines hold sequential % .
/// </summary>
public class ValuationComparableSelection
{
    public Guid Id { get; set; }
    public Guid ValuationRequestId { get; set; }
    public Guid ComparablePropertyId { get; set; }
    /// <summary>market | land_within_cost — two independent tables with no import between them.</summary>
    public string SelectionContext { get; set; } = ComparableSelectionContexts.Market;
    public int SortOrder { get; set; }
 /// <summary>Adopted into the comps table.</summary>
    public bool IsAdopted { get; set; }
    public string? SelectedByUserId { get; set; }
    public DateTime SelectedAtUtc { get; set; }

 /// <summary>Relative weight %. Null = use suggestion.</summary>
    public decimal? WeightPct { get; set; }
 /// <summary>When true, <see cref="WeightPct"/> is appraiser override; else engine suggests.</summary>
    public bool WeightIsManual { get; set; }

 /// <summary>mandatory rationale for a manual weight override.</summary>
    public string? WeightOverrideRationale { get; set; }

 /// <summary>measurement method for the area adjustment (multiplier / multiples).</summary>
    public string AreaAdjustmentMethod { get; set; } = AreaAdjustmentMethods.Multiplier;

 /// <summary>
 /// Interactive model spec (compEdit): manual override of total property price for this valuation only —
 /// does not touch comparable data in the shared bank. Null = bank value.
 /// </summary>
    public decimal? PriceOverrideSar { get; set; }

 /// <summary>Manual override of comparable area (m²) for this valuation only. Null = bank value.</summary>
    public decimal? AreaOverrideSqm { get; set; }

    public ValuationRequest? ValuationRequest { get; set; }
    public ComparableProperty? ComparableProperty { get; set; }
    public ICollection<ValuationComparableAdjustmentLine> AdjustmentLines { get; set; } = [];
}

/// <summary>Selection / adoption helpers — adjustments logic: at least one adopted comparable is required.</summary>
public static class ValuationComparableSelectionRules
{
    /// <summary>Adjustments logic §4: error when zero adopted — at least one is required.</summary>
    public const int MinimumAdoptedForMarketApproach = 1;

    public static bool MeetsMinimumAdopted(IEnumerable<ValuationComparableSelection> rows) =>
        rows.Count(r => r.IsAdopted) >= MinimumAdoptedForMarketApproach;

    public static bool MeetsMinimumAdopted(IEnumerable<bool> adoptedFlags) =>
        adoptedFlags.Count(a => a) >= MinimumAdoptedForMarketApproach;
}

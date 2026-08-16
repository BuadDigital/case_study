namespace RealEstateEval.Domain;

/// <summary>
/// Selected comparable from the company bank for a valuation request (§1.5 / ق-6).
/// Adoption feeds the market approach; adjustment lines hold sequential % (ت-3).
/// </summary>
public class ValuationComparableSelection
{
    public Guid Id { get; set; }
    public Guid ValuationRequestId { get; set; }
    public Guid ComparablePropertyId { get; set; }
    public int SortOrder { get; set; }
    /// <summary>Adopted into the comps table (ق-6 requires ≥1 before opinion).</summary>
    public bool IsAdopted { get; set; }
    public string? SelectedByUserId { get; set; }
    public DateTime SelectedAtUtc { get; set; }

    /// <summary>Relative weight % (ق-9 suggest / ق-10 sum = 100). Null = use suggestion.</summary>
    public decimal? WeightPct { get; set; }
    /// <summary>When true, <see cref="WeightPct"/> is appraiser override; else engine suggests.</summary>
    public bool WeightIsManual { get; set; }

    /// <summary>Decision 19.3 (Solomon 2026-08-16) — mandatory rationale for a manual weight override.</summary>
    public string? WeightOverrideRationale { get; set; }

    /// <summary>ت-4 #33 — measurement method for the area adjustment (المضاعف / الأمثال).</summary>
    public string AreaAdjustmentMethod { get; set; } = AreaAdjustmentMethods.Multiplier;

    public ValuationRequest? ValuationRequest { get; set; }
    public ComparableProperty? ComparableProperty { get; set; }
    public ICollection<ValuationComparableAdjustmentLine> AdjustmentLines { get; set; } = [];
}

/// <summary>Selection / adoption helpers.</summary>
public static class ValuationComparableSelectionRules
{
    public static bool HasAtLeastOneAdopted(IEnumerable<ValuationComparableSelection> rows) =>
        rows.Any(r => r.IsAdopted);

    public static bool HasAtLeastOneAdopted(IEnumerable<bool> adoptedFlags) =>
        adoptedFlags.Any(a => a);
}

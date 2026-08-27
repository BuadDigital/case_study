namespace RealEstateEval.Domain;

/// <summary>
/// Selected comparable from the company bank for a valuation request.
/// Adoption feeds the market approach; adjustment lines hold sequential % .
/// </summary>
public class ValuationComparableSelection
{
    public Guid Id { get; set; }
    public Guid ValuationRequestId { get; set; }
    public Guid ComparablePropertyId { get; set; }
    /// <summary>market | land_within_cost — جدولان مستقلان بلا استيراد.</summary>
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

 /// <summary>measurement method for the area adjustment (المضاعف / الأمثال).</summary>
    public string AreaAdjustmentMethod { get; set; } = AreaAdjustmentMethods.Multiplier;

 /// <summary>
 /// مواصفة النموذج التفاعلي (compEdit): تجاوز يدوي لسعر العقار الإجمالي لهذا التقييم فقط —
 /// لا يمس بيانات المقارن في البنك المشترك. Null = قيمة البنك.
 /// </summary>
    public decimal? PriceOverrideSar { get; set; }

 /// <summary>تجاوز يدوي لمساحة المقارن (م²) لهذا التقييم فقط. Null = قيمة البنك.</summary>
    public decimal? AreaOverrideSqm { get; set; }

    public ValuationRequest? ValuationRequest { get; set; }
    public ComparableProperty? ComparableProperty { get; set; }
    public ICollection<ValuationComparableAdjustmentLine> AdjustmentLines { get; set; } = [];
}

/// <summary>Selection / adoption helpers — منطق-التسويات: يلزم مقارن معتمد واحد على الأقل.</summary>
public static class ValuationComparableSelectionRules
{
    /// <summary>منطق-التسويات §٤: خطأ عند صفر معتمد — يلزم واحد على الأقل.</summary>
    public const int MinimumAdoptedForMarketApproach = 1;

    public static bool MeetsMinimumAdopted(IEnumerable<ValuationComparableSelection> rows) =>
        rows.Count(r => r.IsAdopted) >= MinimumAdoptedForMarketApproach;

    public static bool MeetsMinimumAdopted(IEnumerable<bool> adoptedFlags) =>
        adoptedFlags.Count(a => a) >= MinimumAdoptedForMarketApproach;
}

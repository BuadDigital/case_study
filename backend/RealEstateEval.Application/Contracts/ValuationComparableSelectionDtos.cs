using System.ComponentModel.DataAnnotations;

namespace RealEstateEval.Application.Contracts;

public class ValuationComparableAdjustmentLineDto
{
    public Guid Id { get; init; }
    public required string FactorKey { get; init; }
    public required string LabelAr { get; init; }
    public decimal Percent { get; init; }
    public string Rationale { get; init; } = "";
    public bool IsIncluded { get; init; } = true;
    public int SortOrder { get; init; }
}

public class ValuationComparableMarketDto
{
    public IReadOnlyList<ValuationComparableAdjustmentLineDto> AdjustmentLines { get; init; } = [];
 /// <summary>Included sequential % applied multiplicatively .</summary>
    public decimal SumSequentialPct { get; init; }
 /// <summary>Included difference-factor % summed then applied once .</summary>
    public decimal SumDifferencePct { get; init; }
 /// <summary>Algebraic sum of all included %.</summary>
    public decimal SumIncludedPct { get; init; }
 /// <summary>|sum| &gt; 35%.</summary>
    public bool ExceedsLargeAdjustmentThreshold { get; init; }
 /// <summary>Deal age in months for market-condition inference.</summary>
    public int DealAgeMonths { get; init; }
 /// <summary>Unit rate after sequential multiply only.</summary>
    public decimal PricePerSqmAfterSequential { get; init; }
 /// <summary>Unit rate after sequential + difference factors.</summary>
    public decimal PricePerSqmAfterDifference { get; init; }
 /// <summary>Suggested weight % .</summary>
    public decimal SuggestedWeightPct { get; init; }
 /// <summary>Effective weight (manual override or suggested).</summary>
    public decimal EffectiveWeightPct { get; init; }
    public bool WeightIsManual { get; init; }
    public decimal? WeightPct { get; init; }
 /// <summary>required when WeightIsManual.</summary>
    public string? WeightOverrideRationale { get; init; }
 /// <summary>المضاعف / الأمثال.</summary>
    public string AreaAdjustmentMethod { get; init; } = "multiplier";
 /// <summary>computed suggestion (provisional curve until v3); valuer applies via the area line.</summary>
    public decimal SuggestedAreaAdjustmentPct { get; init; }
}

public class ValuationComparableSelectionDto
{
    public Guid Id { get; init; }
    public Guid ValuationRequestId { get; init; }
    public Guid ComparablePropertyId { get; init; }
    public int SortOrder { get; init; }
    public bool IsAdopted { get; init; }
    public string? SelectedByUserId { get; init; }
    public string SelectedAtUtc { get; init; } = "";
    public ComparablePropertyDto Comparable { get; init; } = null!;
    public ValuationComparableMarketDto? Market { get; init; }
}

public class ValuationComparableSelectionListDto
{
    public Guid ValuationRequestId { get; init; }
    public string PropertyId { get; init; } = "";
    public int AdoptedCount { get; init; }
 /// <summary>helper — true when ≥1 adopted (issuance gate wired later).</summary>
    public bool MeetsMinimumAdoptedGate { get; init; }
 /// <summary>helper for adopted comps with effective weights.</summary>
    public bool WeightsSumTo100 { get; init; }
 /// <summary>Weighted adjusted amount across adopted comps — unit rate or whole value per basis.</summary>
    public decimal WeightedPricePerSqm { get; init; }
 /// <summary>Subject land/building site area m².</summary>
    public decimal? SubjectAreaSqm { get; init; }
 /// <summary>price_per_sqm | whole_property.</summary>
    public string AdjustmentBasis { get; init; } = "price_per_sqm";
    public string AdjustmentBasisLabelAr { get; init; } = "";
 /// <summary>Per-m²: weighted × area. Whole-property: weighted value directly.</summary>
    public decimal MarketOpinionValue { get; init; }
    public string? AnalysisNotes { get; init; }
    public IReadOnlyList<ValuationComparableSelectionDto> Items { get; init; } = [];
}

public class SaveValuationMarketApproachRequest
{
    public decimal? SubjectAreaSqm { get; init; }

 /// <summary>price_per_sqm (default) | whole_property.</summary>
    [MaxLength(32)]
    public string? AdjustmentBasis { get; init; }

    [MaxLength(4000)]
    public string? AnalysisNotes { get; init; }
}

public class ValuationCostLineDto
{
    public Guid Id { get; init; }
    public Guid? SourceInventoryLineId { get; init; }
    public string StructureKind { get; init; } = "floor";
 /// <summary>defined item — custom = free label.</summary>
    public string ItemKey { get; init; } = "custom";
    public string ItemLabelAr { get; init; } = "";
    public string Label { get; init; } = "";
 /// <summary>Quantity in the line's unit.</summary>
    public decimal AreaSqm { get; init; }
 /// <summary>unit: sqm | lm | count | lump.</summary>
    public string Unit { get; init; } = "sqm";
    public string UnitLabelAr { get; init; } = "";
 /// <summary>نسبة البناء (%), optional.</summary>
    public decimal? BuildRatioPct { get; init; }
 /// <summary>repeated-floors count (quantity derives from first floor × count).</summary>
    public int? RepeatedFloorCount { get; init; }
    public decimal UnitCostSar { get; init; }
    public decimal LineTotal { get; init; }
    public string Rationale { get; init; } = "";
    public bool IsIncluded { get; init; } = true;
    public int SortOrder { get; init; }
}

public class ValuationCostApproachDto
{
    public Guid ValuationRequestId { get; init; }
    public string PropertyId { get; init; } = "";
 /// <summary>market weighted unit rate imported at land import.</summary>
    public decimal LandUnitRateFromMarket { get; init; }
 /// <summary>Land area m² snapshot from the market header at import.</summary>
    public decimal LandAreaSqm { get; init; }
 /// <summary>. </summary>
    public decimal UseRestrictionDiscountPct { get; init; }
 /// <summary>required when discount &gt; 0.</summary>
    public string? UseRestrictionRationale { get; init; }
 /// <summary>. </summary>
    public decimal? ApartmentLandShareSqm { get; init; }
 /// <summary>computed.</summary>
    public decimal LandUnitRateAfterDiscount { get; init; }
 /// <summary>Discounted rate × (apartment share ?? land area) —, not free-typed.</summary>
    public decimal LandValueFromMarket { get; init; }
    public string? LandImportedAtUtc { get; init; }
    public decimal DirectCostTotal { get; init; }

 // indirect costs 
    public IReadOnlyList<ValuationIndirectCostItemDto> IndirectItems { get; init; } = [];
 /// <summary>.</summary>
    public decimal FinancingAnnualRatePct { get; init; }
 /// <summary>.</summary>
    public int FinancingMonths { get; init; }
 /// <summary> — computed.</summary>
    public decimal FinancingPct { get; init; }
 /// <summary> — computed.</summary>
    public decimal IndirectRatesSumPct { get; init; }
 /// <summary> — direct × (1 + indirect) — computed.</summary>
    public decimal TotalCostWithIndirect { get; init; }

 // age / depreciation 
    public decimal? ActualAgeYears { get; init; }
    public decimal? EconomicAgeYears { get; init; }
    public decimal LifeExtensionYears { get; init; }
    public string? LifeExtensionBasis { get; init; }
    public decimal FunctionalObsolescencePct { get; init; }
    public string? FunctionalObsolescenceRationale { get; init; }
    public decimal ExternalObsolescencePct { get; init; }
    public string? ExternalObsolescenceRationale { get; init; }
 /// <summary>Economic age + extension — computed.</summary>
    public decimal ExtendedLifeYears { get; init; }
 /// <summary> — computed, unclamped.</summary>
    public decimal? PhysicalObsolescencePct { get; init; }
 /// <summary> — computed, unclamped.</summary>
    public decimal TotalObsolescencePct { get; init; }
 /// <summary> — computed.</summary>
    public decimal DepreciationValue { get; init; }
 /// <summary> — computed.</summary>
    public decimal BuildingsValueAfterDepreciation { get; init; }

 /// <summary> — buildings after depreciation + land.</summary>
    public decimal CostOpinionWithLand { get; init; }
 /// <summary> — buildings after indirect + depreciation, without land.</summary>
    public decimal CostOpinionBuildingsOnly { get; init; }
    public string? AnalysisNotes { get; init; }
    public IReadOnlyList<ValuationCostLineDto> Lines { get; init; } = [];
}

public class ValuationIndirectCostItemDto
{
    public string ItemKey { get; init; } = "";
    public string LabelAr { get; init; } = "";
 /// <summary>0–50 (%).</summary>
    public decimal Pct { get; init; }
    public string? Rationale { get; init; }
 /// <summary>Computed from the direct-cost base.</summary>
    public decimal Amount { get; init; }
    public int SortOrder { get; init; }
}

public class SaveValuationIndirectCostItemRequest
{
    [Required, MaxLength(64)]
    public string ItemKey { get; init; } = "";

 /// <summary>0–50 (%).</summary>
    public decimal Pct { get; init; }

    [MaxLength(2000)]
    public string? Rationale { get; init; }

    public int SortOrder { get; init; }
}

public class SaveValuationCostLineRequest
{
    public Guid? Id { get; init; }
    public Guid? SourceInventoryLineId { get; init; }

    [Required, MaxLength(32)]
    public string StructureKind { get; init; } = "floor";

 /// <summary>defined item; custom needs a label.</summary>
    [MaxLength(64)]
    public string? ItemKey { get; init; }

    [MaxLength(256)]
    public string Label { get; init; } = "";

    public decimal AreaSqm { get; init; }

 /// <summary>sqm | lm | count | lump — omitted = the item's default unit.</summary>
    [MaxLength(16)]
    public string? Unit { get; init; }

    public decimal? BuildRatioPct { get; init; }

 /// <summary>repeated-floors count.</summary>
    public int? RepeatedFloorCount { get; init; }

    public decimal UnitCostSar { get; init; }

    [MaxLength(2000)]
    public string? Rationale { get; init; }

    public bool IsIncluded { get; init; } = true;
    public int SortOrder { get; init; }
}

public class SaveValuationCostApproachRequest
{
    public IReadOnlyList<SaveValuationCostLineRequest> Lines { get; init; } = [];

    [MaxLength(4000)]
    public string? AnalysisNotes { get; init; }

 /// <summary>When true, refresh land rate/area from current market approach .</summary>
    public bool ImportLandFromMarket { get; init; } = true;

 /// <summary>0–100, default 0.</summary>
    public decimal UseRestrictionDiscountPct { get; init; }

 /// <summary>required when discount &gt; 0.</summary>
    [MaxLength(2000)]
    public string? UseRestrictionRationale { get; init; }

 /// <summary>apartment share of land m².</summary>
    public decimal? ApartmentLandShareSqm { get; init; }

 // indirect costs
    public IReadOnlyList<SaveValuationIndirectCostItemRequest> IndirectItems { get; init; } = [];
    public decimal FinancingAnnualRatePct { get; init; }
    public int FinancingMonths { get; init; }

 // age / depreciation
    public decimal? ActualAgeYears { get; init; }
    public decimal? EconomicAgeYears { get; init; }
    public decimal LifeExtensionYears { get; init; }
    [MaxLength(2000)]
    public string? LifeExtensionBasis { get; init; }
    public decimal FunctionalObsolescencePct { get; init; }
    [MaxLength(2000)]
    public string? FunctionalObsolescenceRationale { get; init; }
    public decimal ExternalObsolescencePct { get; init; }
    [MaxLength(2000)]
    public string? ExternalObsolescenceRationale { get; init; }
}

public class ValuationReconciliationMethodDto
{
    public Guid? Id { get; init; }
    public required string ApproachKind { get; init; }
    public required string LabelAr { get; init; }
 /// <summary>Live approach opinion (market / cost with land).</summary>
    public decimal ApproachValue { get; init; }
    public decimal WeightPct { get; init; }
    public decimal SuggestedWeightPct { get; init; }
    public decimal ContributionValue { get; init; }
    public string Rationale { get; init; } = "";
    public bool IsIncluded { get; init; } = true;
    public int SortOrder { get; init; }
}

public class ValuationReconciliationDto
{
    public Guid ValuationRequestId { get; init; }
    public string PropertyId { get; init; } = "";
    public decimal MarketOpinionValue { get; init; }
    public decimal CostOpinionWithLand { get; init; }
    public IReadOnlyList<ValuationReconciliationMethodDto> Methods { get; init; } = [];
    public decimal WeightSumPct { get; init; }
    public bool WeightsSumTo100 { get; init; }
 /// <summary>True when ≥2 included methods with positive value and weight.</summary>
    public bool MeetsMultiMethodGate { get; init; }
    public decimal WeightedValue { get; init; }
    public int FinalRoundDecimals { get; init; }
 /// <summary>Round once on weighted value. Includes discount when basis allows.</summary>
    public decimal FinalOpinionValue { get; init; }
 /// <summary>Final opinion before liquidation discount (same as final when not applied).</summary>
    public decimal FinalOpinionBeforeLiquidation { get; init; }
    public string MethodsRationale { get; init; } = "";
    public string BasisOfValueKey { get; init; } = "market";
    public string? BasisOfValueLabelAr { get; init; }
    public string? ValuePremiseKey { get; init; }
    public string? ValuePremiseLabelAr { get; init; }
    public decimal LiquidationDiscountPct { get; init; }
    public string? LiquidationDiscountRationale { get; init; }
    public bool LiquidationDiscountApplied { get; init; }
 /// <summary>soft-alert overrides (rationale / ack).</summary>
    public IReadOnlyList<ValuationMethodologyAlertOverrideDto> MethodologyAlertOverrides { get; init; } = [];
}

public class ValuationMethodologyAlertOverrideDto
{
    public required string Code { get; init; }
    public string? OverrideRationale { get; init; }
    public bool Acknowledged { get; init; }
}

public class SaveValuationReconciliationMethodRequest
{
    public Guid? Id { get; init; }

    [Required, MaxLength(32)]
    public string ApproachKind { get; init; } = "market";

    public decimal WeightPct { get; init; }

    [MaxLength(2000)]
    public string? Rationale { get; init; }

    public bool IsIncluded { get; init; } = true;
    public int SortOrder { get; init; }
}

public class SaveValuationReconciliationRequest
{
    public IReadOnlyList<SaveValuationReconciliationMethodRequest> Methods { get; init; } = [];

    [Required, MaxLength(4000)]
    public string MethodsRationale { get; init; } = "";

 /// <summary>0–4; rounding applied once on final opinion.</summary>
    public int FinalRoundDecimals { get; init; }

    [MaxLength(32)]
    public string? BasisOfValueKey { get; init; }

    [MaxLength(32)]
    public string? ValuePremiseKey { get; init; }

 /// <summary>Applied only when basis = liquidation and premise is set.</summary>
    public decimal LiquidationDiscountPct { get; init; }

    [MaxLength(2000)]
    public string? LiquidationDiscountRationale { get; init; }

    public IReadOnlyList<ValuationMethodologyAlertOverrideDto>? MethodologyAlertOverrides { get; init; }
}

public class ValuationComparableSelectionItemRequest
{
    [Required]
    public Guid ComparablePropertyId { get; init; }

    public int SortOrder { get; init; }

    public bool IsAdopted { get; init; } = true;
}

public class ReplaceValuationComparableSelectionsRequest
{
    public IReadOnlyList<ValuationComparableSelectionItemRequest> Items { get; init; } = [];
}

public class SaveValuationComparableAdjustmentLineRequest
{
    public Guid? Id { get; init; }

    [Required, MaxLength(32)]
    public string FactorKey { get; init; } = "financing";

    [MaxLength(128)]
    public string? LabelAr { get; init; }

    public decimal Percent { get; init; }

    [MaxLength(2000)]
    public string? Rationale { get; init; }

    public bool IsIncluded { get; init; } = true;

    public int SortOrder { get; init; }
}

public class SaveValuationComparableMarketRequest
{
    public IReadOnlyList<SaveValuationComparableAdjustmentLineRequest> AdjustmentLines { get; init; } = [];

 /// <summary>When set with WeightIsManual, overrides suggestion.</summary>
    public decimal? WeightPct { get; init; }

    public bool WeightIsManual { get; init; }

 /// <summary>required when WeightIsManual.</summary>
    [MaxLength(2000)]
    public string? WeightOverrideRationale { get; init; }

 /// <summary>multiplier (default) | amthal.</summary>
    [MaxLength(32)]
    public string? AreaAdjustmentMethod { get; init; }
}

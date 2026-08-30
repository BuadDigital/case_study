using System.ComponentModel.DataAnnotations;

namespace RealEstateEval.Valuation.Application.Contracts;

public class ValuationComparableAdjustmentLineDto
{
    public Guid Id { get; init; }
    public required string FactorKey { get; init; }
    public required string LabelAr { get; init; }
    public decimal Percent { get; init; }
    public string Rationale { get; init; } = "";
 /// <summary>Comparable description for this factor (compSpec) — "comparable description…".</summary>
    public string? DescriptionAr { get; init; }
    public bool IsIncluded { get; init; } = true;
    public int SortOrder { get; init; }
 /// <summary>True when the displayed value is a suggested default (valuer has not entered one) — shown as "suggested".</summary>
    public bool IsSuggestedValue { get; init; }
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
 /// <summary>|factorsSum| &gt; 35% — rationale required (interactive model spec).</summary>
    public bool ExceedsLargeAdjustmentThreshold { get; init; }
 /// <summary>Deal age in months — display-only hint ("deal age N months"); adjustment is manual.</summary>
    public int DealAgeMonths { get; init; }
 /// <summary>Default comparable-kind adjustment (KIND_DEFAULT): closed 0 · listing −5 · ceiling −8 · som +6.</summary>
    public decimal SuggestedTransactionTypePct { get; init; }
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
 /// <summary>Multiplier / multiples — computed automatically at table level.</summary>
    public string AreaAdjustmentMethod { get; init; } = "multiplier";
 /// <summary>Computed area adjustment (multiples/multiplier) — applied automatically to the area row.</summary>
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

 /// <summary>compEdit: this valuation's price/area overrides for the comparable — does not touch the shared bank.</summary>
    public decimal? PriceOverrideSar { get; init; }
    public decimal? AreaOverrideSqm { get; init; }
 /// <summary>Effective values after overrides: total price, area, unit price = total ÷ area.</summary>
    public decimal EffectivePriceSar { get; init; }
    public decimal EffectiveAreaSqm { get; init; }
    public decimal EffectivePricePerSqm { get; init; }
}

public class ValuationComparableSelectionListDto
{
    public Guid ValuationRequestId { get; init; }
    public string PropertyId { get; init; } = "";
    /// <summary>market | land_within_cost</summary>
    public string SelectionContext { get; init; } = "market";
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
 /// <summary>Per-m²: weighted × area. Whole-property: weighted value directly — before adjustments-basis rounding.</summary>
    public decimal MarketOpinionValueRaw { get; init; }
 /// <summary>Adjustments logic: market value after rounding to nearest 10^n.</summary>
    public decimal MarketOpinionValue { get; init; }
    /// <summary>Frozen area adjustment factor % for this valuation.</summary>
    public decimal AreaFactorPct { get; init; } = 5m;
    /// <summary>Frozen annual market rate % for mkt suggestion.</summary>
    public decimal AnnualMarketRatePct { get; init; } = 4m;
    /// <summary>Frozen market-value rounding exponent (10^n).</summary>
    public int ValueRoundDecimals { get; init; } = 4;
    public string? AnalysisNotes { get; init; }
 /// <summary>Subject-property descriptions per factor (subjSpec) — factorKey → text.</summary>
    public IReadOnlyDictionary<string, string> SubjectSpecs { get; init; } =
        new Dictionary<string, string>();
 /// <summary>Q-8-1: factor-level rationales — factorKey → rationale; comparable row holds override only.</summary>
    public IReadOnlyList<ValuationAdjustmentFactorRationaleDto> FactorRationales { get; init; } = [];
    public IReadOnlyList<ValuationComparableSelectionDto> Items { get; init; } = [];
}

/// <summary>Q-8-1: adjustment-factor rationale (covers all comparables while the logic is the same).</summary>
public class ValuationAdjustmentFactorRationaleDto
{
    public required string SelectionContext { get; init; }
    public required string FactorKey { get; init; }
    public string RationaleAr { get; init; } = "";
}

public class SaveAdjustmentFactorRationaleRequest
{
    [Required, MaxLength(32)]
    public string SelectionContext { get; init; } = "market";

    [Required, MaxLength(32)]
    public string FactorKey { get; init; } = "";

 /// <summary>Empty = clear factor rationale; non-empty is subject to the minimum length (Q-8-2).</summary>
    [MaxLength(2000)]
    public string? RationaleAr { get; init; }
}

public class SaveValuationMarketApproachRequest
{
    public decimal? SubjectAreaSqm { get; init; }

 /// <summary>price_per_sqm (default) | whole_property.</summary>
    [MaxLength(32)]
    public string? AdjustmentBasis { get; init; }

    /// <summary>Optional freeze override; null keeps existing / seeds from org.</summary>
    public decimal? AreaFactorPct { get; init; }

    public decimal? AnnualMarketRatePct { get; init; }

    /// <summary>Optional freeze override 0–6; null keeps existing.</summary>
    public int? ValueRoundDecimals { get; init; }

    [MaxLength(4000)]
    public string? AnalysisNotes { get; init; }

 /// <summary>subjSpec: subject descriptions per difference factor — null keeps stored values.</summary>
    public IReadOnlyDictionary<string, string>? SubjectSpecs { get; init; }
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
 /// <summary>Build ratio (%), optional.</summary>
    public decimal? BuildRatioPct { get; init; }
 /// <summary>repeated-floors count (quantity derives from first floor × count).</summary>
    public int? RepeatedFloorCount { get; init; }
    public decimal UnitCostSar { get; init; }
 /// <summary>Effective unit cost — inherits "first floor" m² rate when repeating-floor cost is empty/zero.</summary>
    public decimal EffectiveUnitCostSar { get; init; }
 /// <summary>True when unit cost was inherited from "first floor" ("inherited from first floor").</summary>
    public bool UnitCostInherited { get; init; }
 /// <summary>Effective quantity after build ratio (m² in floor-areas group) — "floor area N m²".</summary>
    public decimal EffectiveQuantity { get; init; }
    public decimal LineTotal { get; init; }
 /// <summary>Unit rate after indirects — total × (1 + indirect%) ÷ quantity.</summary>
    public decimal NetUnitRateWithIndirect { get; init; }
    public string Rationale { get; init; } = "";
    public bool IsIncluded { get; init; } = true;
    public int SortOrder { get; init; }
}

public class ValuationCostApproachDto
{
    public Guid ValuationRequestId { get; init; }
    public string PropertyId { get; init; } = "";
 /// <summary>weighted unit rate from land_within_cost comps (not market approach).</summary>
    public decimal LandUnitRateFromMarket { get; init; }
 /// <summary>Land area m² used in the cost land equation.</summary>
    public decimal LandAreaSqm { get; init; }
 /// <summary>true when land_within_cost has adopted comps yielding a unit rate.</summary>
    public bool LandEstimateComplete { get; init; }
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

 /// <summary>Cost-approach indicator by scope: land+building = land + depreciated buildings; building-only = depreciated buildings.</summary>
    public decimal CostOpinionWithLand { get; init; }
 /// <summary> — buildings after indirect + depreciation, without land.</summary>
    public decimal CostOpinionBuildingsOnly { get; init; }
 /// <summary>Cost valuation scope from screen-1 settings: land_and_building | building_only.</summary>
    public string CostScopeKey { get; init; } = "land_and_building";
 /// <summary>Σ effective quantity of m² lines in the floor-areas group — "floor areas".</summary>
    public decimal BuildingAreaSqm { get; init; }
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
    /// <summary>Refresh land unit rate/area from land_within_cost comps (not market).</summary>
    public bool RefreshLandFromLandComps { get; init; } = true;

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

 /// <summary>0–6; round to nearest 10^n — applied once on final opinion.</summary>
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
    /// <summary>market (default) | land_within_cost</summary>
    public string? SelectionContext { get; init; }

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

 /// <summary>compSpec: comparable description for this factor ("comparable description…").</summary>
    [MaxLength(500)]
    public string? DescriptionAr { get; init; }

    public bool IsIncluded { get; init; } = true;

    public int SortOrder { get; init; }
}

/// <summary>Screen 1 — governing valuation settings (B-2): applied approaches + cost basis/unit + adjustments unlock.</summary>
public class ValuationApproachSettingsDto
{
    public Guid ValuationRequestId { get; init; }
    public string PropertyId { get; init; } = "";
    public string PropertyType { get; init; } = "";
 /// <summary>Property type is "land" (any classification).</summary>
    public bool IsLandPropertyType { get; init; }
 /// <summary>Scoping question: are there buildings/structures that must be valued?</summary>
    public bool HasStructuresToValue { get; init; }
 /// <summary>Q-3 (amended): bare land with no structures alone disables the cost approach.</summary>
    public bool CostApproachAllowed { get; init; } = true;
    public bool MarketApproachEnabled { get; init; } = true;
    public bool CostApproachEnabled { get; init; } = true;
 /// <summary>Deferred — shown as "under construction" and cannot be enabled.</summary>
    public bool IncomeApproachEnabled { get; init; }
    public string CostBasisKey { get; init; } = "replacement";
    public string CostBasisLabelAr { get; init; } = "";
 /// <summary>Cost valuation scope: land_and_building (default) | building_only.</summary>
    public string CostScopeKey { get; init; } = "land_and_building";
    public string CostScopeLabelAr { get; init; } = "";
    public string CostMeasurementUnitKey { get; init; } = "comparison_unit";
    public string CostMeasurementUnitLabelAr { get; init; } = "";
    public bool AdjustmentsEditUnlocked { get; init; } = true;

 /// <summary>Valuation purpose (§4j-5) — valuation report settings.</summary>
    public string ValuationPurposeKey { get; init; } = "";
    public string ValuationPurposeLabelAr { get; init; } = "";
    public string? ValuationPurposeNote { get; init; }

 /// <summary>External specialist clause (IVS 101) — not the assignment specialist nor the case-study specialist.</summary>
    public bool ExternalSpecialistUsed { get; init; }
    public string? ExternalSpecialistDetails { get; init; }

 /// <summary>Valuation date: issue (automatic — value issuance) | retrospective (manual with rationale).</summary>
    public string ValuationDateMode { get; init; } = "issue";
    public string ValuationDateModeLabelAr { get; init; } = "";
 /// <summary>yyyy-MM-dd for retrospective (or period start).</summary>
    public string? RetrospectiveDate { get; init; }
    /// <summary>yyyy-MM-dd — period end if any; empty = single date.</summary>
    public string? RetrospectiveDateEnd { get; init; }
    public string? RetrospectiveRationale { get; init; }

 /// <summary>Selected/added items (texts frozen with the valuation).</summary>
    public IReadOnlyList<string> SelectedAssumptions { get; init; } = [];
 /// <summary>Selection library from valuation-report tab settings — for UI display.</summary>
    public IReadOnlyList<string> AssumptionLibrary { get; init; } = [];

 /// <summary>False until a row is saved — the values above are then property-type defaults.</summary>
    public bool IsSaved { get; init; }
}

public class SaveValuationApproachSettingsRequest
{
    public bool MarketApproachEnabled { get; init; } = true;
    public bool CostApproachEnabled { get; init; } = true;
    public bool IncomeApproachEnabled { get; init; }

    [MaxLength(32)]
    public string? CostBasisKey { get; init; }

 /// <summary>land_and_building (default) | building_only.</summary>
    [MaxLength(32)]
    public string? CostScopeKey { get; init; }

    [MaxLength(32)]
    public string? CostMeasurementUnitKey { get; init; }

    public bool AdjustmentsEditUnlocked { get; init; } = true;

 /// <summary>Valuation purpose — required (§4j-5).</summary>
    [MaxLength(32)]
    public string? ValuationPurposeKey { get; init; }

    [MaxLength(2000)]
    public string? ValuationPurposeNote { get; init; }

 /// <summary>External specialist clause — "yes" requires details.</summary>
    public bool ExternalSpecialistUsed { get; init; }

    [MaxLength(2000)]
    public string? ExternalSpecialistDetails { get; init; }

 /// <summary>issue (default) | retrospective.</summary>
    [MaxLength(16)]
    public string? ValuationDateMode { get; init; }

 /// <summary>yyyy-MM-dd — required for retrospective (or period start).</summary>
    [MaxLength(16)]
    public string? RetrospectiveDate { get; init; }

 /// <summary>yyyy-MM-dd — period end; empty = single date.</summary>
    [MaxLength(16)]
    public string? RetrospectiveDateEnd { get; init; }

    [MaxLength(2000)]
    public string? RetrospectiveRationale { get; init; }

 /// <summary>Items selected from the library + free-text additions.</summary>
    public IReadOnlyList<string>? SelectedAssumptions { get; init; }
}

public class SaveValuationComparableMarketRequest
{
    public IReadOnlyList<SaveValuationComparableAdjustmentLineRequest> AdjustmentLines { get; init; } = [];

 /// <summary>compEdit: override total property price for this valuation — null clears the override.</summary>
    public decimal? PriceOverrideSar { get; init; }

 /// <summary>compEdit: override comparable area (m²) — null clears the override.</summary>
    public decimal? AreaOverrideSqm { get; init; }

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

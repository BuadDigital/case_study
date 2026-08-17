using RealEstateEval.Domain;

namespace RealEstateEval.Application.Tests;

public class ValuationMethodologyAlertRulesTests
{
    [Fact]
    public void Evaluate_returns_21_alerts()
    {
        var checks = ValuationMethodologyAlertRules.Evaluate(EmptyInput());
        Assert.Equal(21, checks.Count);
        Assert.Equal(Enumerable.Range(1, 21), checks.Select(c => c.Number));
    }

    [Fact]
    public void Hard_alerts_are_3_4_5_11_15_16_21()
    {
        foreach (var n in new[] { 3, 4, 5, 11, 15, 16, 21 })
            Assert.True(ValuationMethodologyAlertSeverity.IsHard(n));
        foreach (var n in new[] { 1, 2, 6, 7, 8, 9, 10, 12, 13, 14, 17, 18, 19, 20 })
            Assert.False(ValuationMethodologyAlertSeverity.IsHard(n));
    }

    [Fact]
    public void Few_adopted_comparables_triggers_between_1_and_2_only()
    {
        var one = ValuationMethodologyAlertRules.Evaluate(
            EmptyInput() with { AdoptedComparableCount = 1 });
        Assert.True(one.Single(c => c.Number == 19).Triggered);

        var three = ValuationMethodologyAlertRules.Evaluate(
            EmptyInput() with { AdoptedComparableCount = 3 });
        Assert.False(three.Single(c => c.Number == 19).Triggered);

        // صفر مقارنات شأن الحاجب m15 لا m19.
        var zero = ValuationMethodologyAlertRules.Evaluate(
            EmptyInput() with { AdoptedComparableCount = 0 });
        Assert.False(zero.Single(c => c.Number == 19).Triggered);
        Assert.True(zero.Single(c => c.Number == 15).Triggered);
    }

    [Fact]
    public void Stale_comparable_without_time_adjustment_needs_ack()
    {
        var stale = new ValuationMethodologyAlertComparableInput(
            "أرض سكنية", false, 0m, DealAgeMonths: 9, HasMarketConditionsAdjustment: false);
        var adjusted = stale with { HasMarketConditionsAdjustment = true };
        var fresh = stale with { DealAgeMonths = 2 };

        var triggered = ValuationMethodologyAlertRules.Evaluate(
            EmptyInput() with { AdoptedComparables = [stale], TimeGapMonthsThreshold = 6 });
        Assert.True(triggered.Single(c => c.Number == 20).Triggered);
        Assert.Equal(
            ValuationMethodologyAlertSeverityKinds.RequireAck,
            triggered.Single(c => c.Number == 20).SeverityKind);

        var ok = ValuationMethodologyAlertRules.Evaluate(
            EmptyInput() with { AdoptedComparables = [adjusted, fresh], TimeGapMonthsThreshold = 6 });
        Assert.False(ok.Single(c => c.Number == 20).Triggered);
    }

    [Fact]
    public void Inspection_scope_alerts_stay_unevaluated_until_scope_is_captured()
    {
        var checks = ValuationMethodologyAlertRules.Evaluate(EmptyInput());
        Assert.False(checks.Single(c => c.Number == 18).Evaluated);
        Assert.False(checks.Single(c => c.Number == 21).Evaluated);

        var desktop = ValuationMethodologyAlertRules.Evaluate(EmptyInput() with
        {
            InspectionScopeKey = InspectionScopeKeys.Desktop,
        });
        Assert.True(desktop.Single(c => c.Number == 18).Triggered);
        Assert.True(desktop.Single(c => c.Number == 21).Triggered);
        Assert.True(desktop.Single(c => c.Number == 21).BlocksIssuance);

        var approved = ValuationMethodologyAlertRules.Evaluate(EmptyInput() with
        {
            InspectionScopeKey = InspectionScopeKeys.Desktop,
            RemoteInspectionApprovedByAccredited = true,
        });
        Assert.False(approved.Single(c => c.Number == 21).Triggered);

        var full = ValuationMethodologyAlertRules.Evaluate(EmptyInput() with
        {
            InspectionScopeKey = InspectionScopeKeys.Full,
        });
        Assert.False(full.Single(c => c.Number == 18).Triggered);
    }

    [Fact]
    public void No_adopted_comps_triggers_m15_hard_block()
    {
        var checks = ValuationMethodologyAlertRules.Evaluate(EmptyInput() with
        {
            AdoptedComparableCount = 0,
        });
        var m15 = checks.Single(c => c.Number == 15);
        Assert.True(m15.Triggered);
        Assert.True(m15.IsHard);
        Assert.True(m15.BlocksIssuance);
        Assert.Equal(ValuationMethodologyAlertSeverityKinds.Hard, m15.SeverityKind);
    }

    [Fact]
    public void Weights_alert_m16_is_hard()
    {
        var checks = ValuationMethodologyAlertRules.Evaluate(EmptyInput() with
        {
            ComparableWeightsSumTo100 = false,
        });
        Assert.True(checks.Single(c => c.Number == 16).IsHard);
        Assert.True(checks.Single(c => c.Number == 16).Triggered);
        Assert.True(checks.Single(c => c.Number == 16).BlocksIssuance);
    }

    [Fact]
    public void Large_adjustment_m17_requires_rationale_to_clear_block()
    {
        var checks = ValuationMethodologyAlertRules.Evaluate(EmptyInput() with
        {
            AdoptedComparableCount = 1,
            AdoptedComparables =
            [
                new("أرض سكنية", ExceedsLargeAdjustmentThreshold: true, SumIncludedPct: 40m),
            ],
        });
        var m17 = checks.Single(c => c.Number == 17);
        Assert.True(m17.Triggered);
        Assert.False(m17.IsHard);
        Assert.True(m17.BlocksIssuance);
        Assert.Equal(ValuationMethodologyAlertSeverityKinds.RequireRationale, m17.SeverityKind);

        var cleared = ValuationMethodologyAlertRules.Evaluate(EmptyInput() with
        {
            AdoptedComparableCount = 1,
            AdoptedComparables =
            [
                new("أرض سكنية", ExceedsLargeAdjustmentThreshold: true, SumIncludedPct: 40m),
            ],
            Resolutions =
            [
                new(ValuationMethodologyAlertCodes.LargeAdjustments, OverrideRationale: "موقع استثنائي"),
            ],
        });
        Assert.True(cleared.Single(c => c.Number == 17).Triggered);
        Assert.False(cleared.Single(c => c.Number == 17).BlocksIssuance);
    }

    [Fact]
    public void No_cost_line_m1_clears_with_acknowledgement()
    {
        var checks = ValuationMethodologyAlertRules.Evaluate(EmptyInput() with
        {
            CostApproachRelevant = true,
            CostLines = [],
        });
        var m1 = checks.Single(c => c.Number == 1);
        Assert.True(m1.Triggered);
        Assert.Equal(ValuationMethodologyAlertSeverityKinds.RequireAck, m1.SeverityKind);
        Assert.True(m1.BlocksIssuance);

        var acked = ValuationMethodologyAlertRules.Evaluate(EmptyInput() with
        {
            CostApproachRelevant = true,
            CostLines = [],
            Resolutions =
            [
                new(ValuationMethodologyAlertCodes.NoCostLine, Acknowledged: true),
            ],
        });
        Assert.False(acked.Single(c => c.Number == 1).BlocksIssuance);
    }

    [Fact]
    public void Vacant_land_building_comp_m11_is_hard()
    {
        var checks = ValuationMethodologyAlertRules.Evaluate(EmptyInput() with
        {
            HasStructuresToValue = false,
            AdoptedComparableCount = 1,
            AdoptedComparables = [new("فيلا سكنية", false, 0m)],
        });
        var m11 = checks.Single(c => c.Number == 11);
        Assert.True(m11.Triggered);
        Assert.True(m11.IsHard);
        Assert.True(m11.BlocksIssuance);
    }

    [Fact]
    public void Use_restriction_discount_without_rationale_triggers_m10()
    {
        var checks = ValuationMethodologyAlertRules.Evaluate(EmptyInput() with
        {
            UseRestrictionDiscountPct = 15m,
            UseRestrictionRationale = "",
        });
        Assert.True(checks.Single(c => c.Number == 10).Triggered);
        Assert.Equal(ValuationMethodologyAlertSeverityKinds.RequireRationale,
            checks.Single(c => c.Number == 10).SeverityKind);
    }

    [Fact]
    public void Liquidation_discount_no_longer_fires_m10()
    {
 // Use-restriction discount; liquidation has its own validation.
        var checks = ValuationMethodologyAlertRules.Evaluate(EmptyInput() with
        {
            LiquidationDiscountPct = 15m,
            LiquidationDiscountRationale = "",
        });
        Assert.False(checks.Single(c => c.Number == 10).Triggered);
    }

    [Fact]
    public void Repeated_floor_without_first_floor_triggers_m7()
    {
        var checks = ValuationMethodologyAlertRules.Evaluate(EmptyInput() with
        {
            CostApproachRelevant = true,
            CostLines =
            [
                new(BuildingStructureKinds.Floor, "دور متكرر", 100m, 2000m, null, true),
            ],
        });
        Assert.True(checks.Single(c => c.Number == 7).Triggered);
        Assert.Equal(ValuationMethodologyAlertSeverityKinds.RequireAck,
            checks.Single(c => c.Number == 7).SeverityKind);
    }

    [Fact]
    public void Repeated_floor_with_first_floor_does_not_trigger_m7()
    {
        var checks = ValuationMethodologyAlertRules.Evaluate(EmptyInput() with
        {
            CostApproachRelevant = true,
            CostLines =
            [
                new(BuildingStructureKinds.Floor, "الدور الأول", 100m, 2000m, null, true),
                new(BuildingStructureKinds.Floor, "دور متكرر", 100m, 2000m, null, true),
            ],
        });
        Assert.False(checks.Single(c => c.Number == 7).Triggered);
    }

    [Fact]
    public void Repeated_unit_cost_differs_from_first_floor_triggers_m9()
    {
        var checks = ValuationMethodologyAlertRules.Evaluate(EmptyInput() with
        {
            CostApproachRelevant = true,
            CostLines =
            [
                new(BuildingStructureKinds.Floor, "الدور الأرضي", 100m, 2500m, null, true),
                new(BuildingStructureKinds.Floor, "الدور الأول", 100m, 2000m, null, true),
                new(BuildingStructureKinds.Floor, "دور متكرر", 100m, 1800m, null, true),
            ],
        });
 // Baseline is the FIRST floor — ground-floor difference alone is fine.
        Assert.True(checks.Single(c => c.Number == 9).Triggered);

        var withRationale = ValuationMethodologyAlertRules.Evaluate(EmptyInput() with
        {
            CostApproachRelevant = true,
            CostLines =
            [
                new(BuildingStructureKinds.Floor, "الدور الأول", 100m, 2000m, null, true),
                new(BuildingStructureKinds.Floor, "دور متكرر", 100m, 1800m, "تشطيب أدنى", true),
            ],
        });
        Assert.False(withRationale.Single(c => c.Number == 9).Triggered);
    }

    [Fact]
    public void Negative_cost_triggers_m5()
    {
        var checks = ValuationMethodologyAlertRules.Evaluate(EmptyInput() with
        {
            CostApproachRelevant = true,
            CostLines =
            [
                new(BuildingStructureKinds.Floor, "دور", -10m, 100m, null, true),
            ],
        });
        Assert.True(checks.Single(c => c.Number == 5).Triggered);
        Assert.True(checks.Single(c => c.Number == 5).IsHard);
    }

    [Fact]
    public void Unevaluated_life_alerts_are_not_triggered()
    {
        var checks = ValuationMethodologyAlertRules.Evaluate(EmptyInput());
        Assert.False(checks.Single(c => c.Number == 2).Evaluated);
        Assert.False(checks.Single(c => c.Number == 2).Triggered);
        Assert.False(checks.Single(c => c.Number == 3).Evaluated);
        Assert.True(checks.Single(c => c.Number == 3).IsHard);
    }

    [Fact]
    public void Injection_label_compounds_liquidation_premise()
    {
        Assert.Equal(
            "التصفية المنظمة",
            BasisOfValueKeys.InjectionLabelAr(
                BasisOfValueKeys.Liquidation, ValuePremiseKeys.Orderly));
        Assert.Equal(
            "البيع القسري",
            BasisOfValueKeys.InjectionLabelAr(
                BasisOfValueKeys.Liquidation, ValuePremiseKeys.Forced));
        Assert.Equal(
            "القيمة السوقية",
            BasisOfValueKeys.InjectionLabelAr(BasisOfValueKeys.Market, ValuePremiseKeys.CurrentUse));
    }

    [Fact]
    public void Premise_compatibility_enforces_liquidation_pairing()
    {
        Assert.True(ValuePremiseKeys.IsCompatible(BasisOfValueKeys.Liquidation, ValuePremiseKeys.Forced));
        Assert.False(ValuePremiseKeys.IsCompatible(BasisOfValueKeys.Liquidation, ValuePremiseKeys.CurrentUse));
        Assert.True(ValuePremiseKeys.IsCompatible(BasisOfValueKeys.Market, ValuePremiseKeys.HighestAndBest));
        Assert.False(ValuePremiseKeys.IsCompatible(BasisOfValueKeys.Market, ValuePremiseKeys.Orderly));
    }

    [Fact]
    public void Age_alerts_m2_m3_live_from_cost_approach_inputs()
    {
 // Extended life zero with age data present → m2.
        var m2 = ValuationMethodologyAlertRules.Evaluate(EmptyInput() with
        {
            ActualAgeYears = 10m,
            ExtendedLifeYears = 0m,
        });
        Assert.True(m2.Single(c => c.Number == 2).Evaluated);
        Assert.True(m2.Single(c => c.Number == 2).Triggered);

 // Actual 60 over extended 50 → m3 (hard).
        var m3 = ValuationMethodologyAlertRules.Evaluate(EmptyInput() with
        {
            ActualAgeYears = 60m,
            EconomicAgeYears = 50m,
            ExtendedLifeYears = 50m,
        });
        Assert.True(m3.Single(c => c.Number == 3).Triggered);
        Assert.True(m3.Single(c => c.Number == 3).IsHard);
        Assert.False(m3.Single(c => c.Number == 2).Triggered);
    }

    [Fact]
    public void Obsolescence_alerts_m4_m12_live()
    {
        var checks = ValuationMethodologyAlertRules.Evaluate(EmptyInput() with
        {
            TotalObsolescencePct = 130m,
            FunctionalObsolescencePct = 20m,
            FunctionalObsolescenceRationale = "",
        });
        Assert.True(checks.Single(c => c.Number == 4).Triggered);
        Assert.True(checks.Single(c => c.Number == 4).IsHard);
        Assert.True(checks.Single(c => c.Number == 12).Triggered);

        var clean = ValuationMethodologyAlertRules.Evaluate(EmptyInput() with
        {
            TotalObsolescencePct = 40m,
            FunctionalObsolescencePct = 20m,
            FunctionalObsolescenceRationale = "تشطيب قديم",
        });
        Assert.False(clean.Single(c => c.Number == 4).Triggered);
        Assert.False(clean.Single(c => c.Number == 12).Triggered);
    }

    [Fact]
    public void Life_extension_without_basis_triggers_m6()
    {
        var checks = ValuationMethodologyAlertRules.Evaluate(EmptyInput() with
        {
            LifeExtensionYears = 5m,
            LifeExtensionBasis = " ",
        });
        Assert.True(checks.Single(c => c.Number == 6).Triggered);

        var withBasis = ValuationMethodologyAlertRules.Evaluate(EmptyInput() with
        {
            LifeExtensionYears = 5m,
            LifeExtensionBasis = "صيانة شاملة موثقة",
        });
        Assert.False(withBasis.Single(c => c.Number == 6).Triggered);
    }

    [Fact]
    public void Developer_profit_and_indirect_sum_alerts_m13_m14_live()
    {
        var checks = ValuationMethodologyAlertRules.Evaluate(EmptyInput() with
        {
            DeveloperProfitPct = 25m,
            IndirectRatesSumPct = 48m,
        });
        Assert.True(checks.Single(c => c.Number == 13).Evaluated);
        Assert.True(checks.Single(c => c.Number == 13).Triggered);
        Assert.True(checks.Single(c => c.Number == 14).Triggered);

        var inRange = ValuationMethodologyAlertRules.Evaluate(EmptyInput() with
        {
            DeveloperProfitPct = 15m,
            IndirectRatesSumPct = 30m,
        });
        Assert.False(inRange.Single(c => c.Number == 13).Triggered);
        Assert.False(inRange.Single(c => c.Number == 14).Triggered);
    }

    private static ValuationMethodologyAlertInput EmptyInput() =>
        new(
            HasStructuresToValue: false,
            CostApproachRelevant: false,
            CostLines: [],
            AdoptedComparableCount: 1,
            ComparableWeightsSumTo100: true,
            ReconciliationWeightsSumTo100: true,
            HasReconciliationSaved: true,
            LiquidationDiscountPct: 0m,
            LiquidationDiscountRationale: null,
            AdoptedComparables: [new("أرض", false, 0m)]);
}

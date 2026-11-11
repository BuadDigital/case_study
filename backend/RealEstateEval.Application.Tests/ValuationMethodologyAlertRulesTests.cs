using RealEstateEval.Domain;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Application.Tests;

public class ValuationMethodologyAlertRulesTests
{
    [Fact]
    public void Evaluate_returns_24_alerts()
    {
        var checks = ValuationMethodologyAlertRules.Evaluate(EmptyInput());
        Assert.Equal(24, checks.Count);
        Assert.Equal(Enumerable.Range(1, 19).Concat([21, 22, 23, 24, 25]), checks.Select(c => c.Number));
    }

    [Fact]
    public void Hard_alerts_are_2_4_5_11_15_16_21_23()
    {
        // m2 (building ages missing) is hard since 2026-11-10 — an acknowledgement no longer clears it.
        foreach (var n in new[] { 2, 4, 5, 11, 15, 16, 21, 23 })
            Assert.True(ValuationMethodologyAlertSeverity.IsHard(n));
        // m3 (age beyond the extended life) now needs a rationale instead of blocking.
        foreach (var n in new[] { 1, 3, 6, 7, 8, 9, 10, 12, 13, 14, 17, 18, 19, 22, 24, 25 })
            Assert.False(ValuationMethodologyAlertSeverity.IsHard(n));
        Assert.True(ValuationMethodologyAlertSeverity.RequiresRationale(3));
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

        // Zero comparables belongs to hard gate m15, not m19.
        var zero = ValuationMethodologyAlertRules.Evaluate(
            EmptyInput() with { AdoptedComparableCount = 0 });
        Assert.False(zero.Single(c => c.Number == 19).Triggered);
        Assert.True(zero.Single(c => c.Number == 15).Triggered);
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
    public void Market_comparable_alerts_are_skipped_when_market_approach_is_off()
    {
        var checks = ValuationMethodologyAlertRules.Evaluate(EmptyInput() with
        {
            MarketApproachRelevant = false,
            AdoptedComparableCount = 0,
            AdoptedComparables = [],
            ComparableWeightsSumTo100 = false,
        });

        Assert.False(checks.Single(c => c.Number == 15).Evaluated);
        Assert.False(checks.Single(c => c.Number == 15).Triggered);
        Assert.False(checks.Single(c => c.Number == 15).BlocksIssuance);
        Assert.False(checks.Single(c => c.Number == 19).Evaluated);
        Assert.False(checks.Single(c => c.Number == 19).Triggered);
        Assert.False(checks.Single(c => c.Number == 17).Evaluated);
        // Comparable-weight half of m16 is skipped; EmptyInput recon weights stay 100%.
        Assert.False(checks.Single(c => c.Number == 16).Triggered);
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

    // 2026-11-11: the alert names the inventory table — an empty cost table means the inspector's
    // «جدول حصر المباني» was not filled, or was filled and never pulled.
    [Fact]
    public void No_cost_line_m1_says_where_the_problem_lies()
    {
        string? Detail(ValuationMethodologyAlertInput input) =>
            ValuationMethodologyAlertRules.Evaluate(input).Single(c => c.Number == 1).DetailAr;

        var costOn = EmptyInput() with { CostApproachRelevant = true, CostLines = [] };

        Assert.Equal(
            ValuationMethodologyAlertRules.NoCostLineInventoryEmptyAr,
            Detail(costOn with { HasStructuresToValue = false }));
        Assert.Equal(
            ValuationMethodologyAlertRules.NoCostLineInventoryNotPulledAr,
            Detail(costOn with { HasStructuresToValue = true }));
        Assert.Contains("جدول حصر المباني", ValuationMethodologyAlertRules.NoCostLineInventoryEmptyAr);
        Assert.Contains("جدول حصر المباني", ValuationMethodologyAlertRules.NoCostLineInventoryNotPulledAr);
    }

    [Fact]
    public void No_cost_line_m1_is_silent_when_the_cost_approach_is_off()
    {
        // An apartment valued by the market approach alone: buildings exist, no cost table needed.
        var checks = ValuationMethodologyAlertRules.Evaluate(EmptyInput() with
        {
            HasStructuresToValue = true,
            CostApproachRelevant = false,
            CostLines = [],
        });
        var m1 = checks.Single(c => c.Number == 1);
        Assert.False(m1.Triggered);
        Assert.False(m1.BlocksIssuance);
    }

    [Fact]
    public void Stale_cost_data_is_ignored_once_the_cost_approach_is_off()
    {
        // Ages, obsolescence, a negative line and out-of-range rates left from a cost approach
        // the appraiser later switched off.
        var stale = EmptyInput() with
        {
            CostApproachEnabled = false,
            CostLines = [new("building", "مبنى", -10m, 1000m, null, true)],
            ActualAgeYears = 40m,
            EconomicAgeYears = 0m,
            ExtendedLifeYears = 0m,
            TotalObsolescencePct = 130m,
            LifeExtensionYears = 5m,
            FunctionalObsolescencePct = 110m,
            UseRestrictionDiscountPct = 10m,
            DeveloperProfitPct = 40m,
            IndirectRatesSumPct = 60m,
        };
        var checks = ValuationMethodologyAlertRules.Evaluate(stale);
        foreach (var n in new[] { 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14 })
        {
            var check = checks.Single(c => c.Number == n);
            Assert.False(check.Triggered, $"m{n} should be skipped");
            Assert.False(check.BlocksIssuance, $"m{n} should not block");
        }

        // Same data with the cost approach on: the hard alerts come back.
        var live = ValuationMethodologyAlertRules.Evaluate(stale with { CostApproachEnabled = true });
        Assert.True(live.Single(c => c.Number == 4).BlocksIssuance);
        Assert.True(live.Single(c => c.Number == 5).BlocksIssuance);
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

    [Theory]
    [InlineData(CostLineItemKeys.RepeatedFloors, "")]
    [InlineData("", "دور متكرر")]
    public void Repeated_unit_cost_left_at_zero_inherits_the_first_floor_and_does_not_trigger_m9(
        string repeatedItemKey,
        string repeatedLabel)
    {
        // The reproduced case: first floor 1,500 SAR/m², repeated floors 1,800 m² left at 0
        // (the screen shows «موروثة من الدور الأول» and prices them at 1,500 → 2,700,000).
        var checks = ValuationMethodologyAlertRules.Evaluate(EmptyInput() with
        {
            CostApproachRelevant = true,
            CostLines =
            [
                new(BuildingStructureKinds.Floor, "الدور الأول", 600m, 1500m, null, true,
                    CostLineItemKeys.FirstFloor),
                new(BuildingStructureKinds.Floor, repeatedLabel, 1800m, 0m, null, true,
                    repeatedItemKey),
            ],
        });
        var m9 = checks.Single(c => c.Number == 9);
        Assert.True(m9.Evaluated);
        Assert.False(m9.Triggered);
    }

    [Fact]
    public void Repeated_unit_cost_typed_differently_by_item_key_still_triggers_m9()
    {
        var checks = ValuationMethodologyAlertRules.Evaluate(EmptyInput() with
        {
            CostApproachRelevant = true,
            CostLines =
            [
                new(BuildingStructureKinds.Floor, "الدور الأول", 600m, 1500m, null, true,
                    CostLineItemKeys.FirstFloor),
                new(BuildingStructureKinds.Floor, "", 1800m, 1400m, null, true,
                    CostLineItemKeys.RepeatedFloors),
            ],
        });
        Assert.True(checks.Single(c => c.Number == 9).Triggered);

        var same = ValuationMethodologyAlertRules.Evaluate(EmptyInput() with
        {
            CostApproachRelevant = true,
            CostLines =
            [
                new(BuildingStructureKinds.Floor, "الدور الأول", 600m, 1500m, null, true,
                    CostLineItemKeys.FirstFloor),
                new(BuildingStructureKinds.Floor, "", 1800m, 1500m, null, true,
                    CostLineItemKeys.RepeatedFloors),
            ],
        });
        Assert.False(same.Single(c => c.Number == 9).Triggered);
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
        Assert.False(checks.Single(c => c.Number == 3).IsHard);
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

 // Actual 60 over extended 50 → m3 (written rationale, not a hard block).
        var m3 = ValuationMethodologyAlertRules.Evaluate(EmptyInput() with
        {
            ActualAgeYears = 60m,
            EconomicAgeYears = 50m,
            ExtendedLifeYears = 50m,
        });
        Assert.True(m3.Single(c => c.Number == 3).Triggered);
        Assert.False(m3.Single(c => c.Number == 3).IsHard);
        Assert.True(m3.Single(c => c.Number == 3).BlocksIssuance); // until explained
        Assert.False(m3.Single(c => c.Number == 2).Triggered);
    }

    [Fact]
    public void Obsolescence_alerts_m4_m12_live()
    {
        // 130٪ that comes from physical depreciation is capped and explained (m3/m25);
        // m4 stays hard for typed functional + external obsolescence above 100٪.
        var physical = ValuationMethodologyAlertRules.Evaluate(EmptyInput() with
        {
            TotalObsolescencePct = 130m,
            FunctionalObsolescencePct = 20m,
            FunctionalObsolescenceRationale = "",
        });
        Assert.False(physical.Single(c => c.Number == 4).Triggered);
        Assert.True(physical.Single(c => c.Number == 25).Triggered);
        Assert.True(physical.Single(c => c.Number == 12).Triggered);

        var checks = ValuationMethodologyAlertRules.Evaluate(EmptyInput() with
        {
            TotalObsolescencePct = 130m,
            FunctionalObsolescencePct = 70m,
            ExternalObsolescencePct = 40m,
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

    /// <summary>A→Z #77 (2026-11-04): alert 23 covers the cost approach's land comparables.</summary>
    [Fact]
    public void Alert_23_blocks_a_cost_land_comparable_dated_after_the_valuation_date()
    {
        var input = EmptyInput() with
        {
            MarketApproachRelevant = false,
            AdoptedComparables = [],
            CostApproachEnabled = true,
            AdoptedCostLandComparables =
            [
                new("أرض", false, 0m, TransactionDate: new DateOnly(2026, 11, 2), ReferenceCode: "CMP-D1117064"),
            ],
            ComparableDateCutoff = new DateOnly(2026, 9, 15),
            Today = new DateOnly(2026, 11, 4),
        };

        var m23 = ValuationMethodologyAlertRules.Evaluate(input).Single(c => c.Number == 23);
        Assert.True(m23.Triggered);
        Assert.True(m23.BlocksIssuance);
        Assert.Contains("CMP-D1117064", m23.DetailAr);

        // Off when the cost approach is off.
        Assert.False(ValuationMethodologyAlertRules.Evaluate(input with { CostApproachEnabled = false })
            .Single(c => c.Number == 23).Triggered);
    }

    /// <summary>A→Z #78 (2026-11-04): an extra that adds nothing needs no rationale yet.</summary>
    [Fact]
    public void Alert_8_skips_an_unpriced_extra()
    {
        var unpriced = EmptyInput() with
        {
            CostLines = [new ValuationMethodologyAlertCostLineInput("other", "بند خاص", 1m, 0m, null, true, "custom")],
        };
        Assert.False(ValuationMethodologyAlertRules.Evaluate(unpriced).Single(c => c.Number == 8).Triggered);

        var priced = EmptyInput() with
        {
            CostLines = [new ValuationMethodologyAlertCostLineInput("other", "بند خاص", 1m, 5000m, null, true, "custom")],
        };
        Assert.True(ValuationMethodologyAlertRules.Evaluate(priced).Single(c => c.Number == 8).Triggered);
    }

    // ─── Grey areas 2026-11-10 ───

    /// <summary>Fix 5: blank building ages block issuance and an acknowledgement does not clear it.</summary>
    [Theory]
    [InlineData(null, 40)]
    [InlineData(10, null)]
    [InlineData(null, null)]
    public void Blank_building_ages_raise_a_hard_m2_that_an_acknowledgement_cannot_clear(
        int? actual, int? economic)
    {
        var input = EmptyInput() with
        {
            HasStructuresToValue = true,
            CostApproachRelevant = true,
            CostLines =
            [
                new(BuildingStructureKinds.Floor, "الدور الأرضي", 300m, 1800m, null, true, CostLineItemKeys.GroundFloor),
            ],
            ActualAgeYears = actual,
            EconomicAgeYears = economic,
            ExtendedLifeYears = economic,
            Resolutions = [new(ValuationMethodologyAlertCodes.ExtendedLifeZero, Acknowledged: true)],
        };

        var m2 = ValuationMethodologyAlertRules.Evaluate(input).Single(c => c.Number == 2);
        Assert.True(m2.Triggered);
        Assert.True(m2.IsHard);
        Assert.Equal(ValuationMethodologyAlertSeverityKinds.Hard, m2.SeverityKind);
        Assert.True(m2.BlocksIssuance);
        Assert.Equal("عمر المبنى الفعلي والعمر الاقتصادي مطلوبان لحساب الإهلاك", m2.LabelAr);
        Assert.Contains(CostDepreciationRules.IncompleteMessageAr, m2.DetailAr);
    }

    [Fact]
    public void Ages_entered_or_additions_only_or_an_excluded_floor_leave_m2_silent()
    {
        var withAges = EmptyInput() with
        {
            CostLines = [new(BuildingStructureKinds.Floor, "الدور الأرضي", 300m, 1800m, null, true, CostLineItemKeys.GroundFloor)],
            ActualAgeYears = 0m,
            EconomicAgeYears = 40m,
            ExtendedLifeYears = 40m,
        };
        Assert.False(ValuationMethodologyAlertRules.Evaluate(withAges).Single(c => c.Number == 2).Triggered);

        var fenceOnly = EmptyInput() with
        {
            CostLines = [new(BuildingStructureKinds.Fence, "السور", 120m, 300m, null, true, CostLineItemKeys.Fence)],
        };
        Assert.False(ValuationMethodologyAlertRules.Evaluate(fenceOnly).Single(c => c.Number == 2).Triggered);

        var excludedFloor = EmptyInput() with
        {
            CostLines = [new(BuildingStructureKinds.Floor, "الدور الأرضي", 300m, 1800m, null, false, CostLineItemKeys.GroundFloor)],
        };
        Assert.False(ValuationMethodologyAlertRules.Evaluate(excludedFloor).Single(c => c.Number == 2).Triggered);

        // The cost approach switched off: stale lines never block.
        var off = withAges with { CostApproachEnabled = false, ActualAgeYears = null, EconomicAgeYears = null };
        Assert.False(ValuationMethodologyAlertRules.Evaluate(off).Single(c => c.Number == 2).Triggered);
    }

    /// <summary>Fix 9: any built comparable against vacant land raises the hard m11.</summary>
    [Theory]
    [InlineData("عمارة سكنية", true)]
    [InlineData("محل تجاري", true)]
    [InlineData("مستودع", true)]
    [InlineData("معرض", true)]
    [InlineData("مبنى", true)]
    [InlineData("أرض", false)]
    [InlineData("أرض فضاء", false)]
    [InlineData("أرض تجارية", false)]
    public void Vacant_land_m11_fires_for_every_built_comparable_type(string type, bool fires)
    {
        var m11 = ValuationMethodologyAlertRules.Evaluate(EmptyInput() with
        {
            HasStructuresToValue = false,
            AdoptedComparables = [new(type, false, 0m, ReferenceCode: "CMP-26-7")],
        }).Single(c => c.Number == 11);

        Assert.Equal(fires, m11.Triggered);
        if (fires) Assert.Contains("CMP-26-7", m11.DetailAr);
    }

    /// <summary>m7/m9: the item key decides; a «custom» line named like a floor is not one.</summary>
    [Fact]
    public void Repeated_floors_alerts_read_the_item_key_before_the_label()
    {
        // A custom line named «الدور الأول» is not the first floor the cost approach derives from.
        var customNamedFirst = ValuationMethodologyAlertRules.Evaluate(EmptyInput() with
        {
            CostLines =
            [
                new(BuildingStructureKinds.Floor, "الدور الأول", 400m, 1500m, null, true, CostLineItemKeys.Custom),
                new(BuildingStructureKinds.Floor, "", 800m, 0m, null, true, CostLineItemKeys.RepeatedFloors),
            ],
        });
        Assert.True(customNamedFirst.Single(c => c.Number == 7).Triggered);

        // Keyed first floor with an unrelated label still counts; a key in another case too.
        var keyed = ValuationMethodologyAlertRules.Evaluate(EmptyInput() with
        {
            CostLines =
            [
                new(BuildingStructureKinds.Floor, "مسطح الطابق", 400m, 1500m, null, true, " First_Floor "),
                new(BuildingStructureKinds.Floor, "", 800m, 1700m, null, true, CostLineItemKeys.RepeatedFloors),
            ],
        });
        Assert.False(keyed.Single(c => c.Number == 7).Triggered);
        Assert.True(keyed.Single(c => c.Number == 9).Triggered);
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

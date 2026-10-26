using RealEstateEval.Domain;
using RealEstateEval.Shared.Web;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Application.Rules;
using RealEstateEval.Valuation.Application.Services;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// Round 2 (remaining findings): unexplained adjustments block issuance, unknown keys answer an
/// Arabic 400, a future-dated bank comparable is refused, bank rows carry a usage, and the alert 23
/// / liquidation / error-message wording.
/// </summary>
public class Round2SmallFixesTests
{
    // ------------------------------------------------ 1. unexplained adjustments / manual weights

    private static ValuationComparableSelectionDto Item(
        string reference,
        bool adopted,
        IReadOnlyList<ValuationComparableAdjustmentLineDto> lines,
        bool manualWeight = false,
        string? weightRationale = null) => new()
    {
        Id = Guid.NewGuid(),
        IsAdopted = adopted,
        Comparable = new ComparablePropertyDto
        {
            ReferenceCode = reference,
            ComparablePropertyType = "فيلا",
            TransactionKind = "executed",
            Source = "bourse",
            TransactionDate = "2026-01-01",
            District = "النرجس",
            IntakeChannel = "office",
            SourceCard = new ComparableSourceCardDto
            {
                IntakeChannel = "office",
                IntakeChannelLabelAr = "",
                Freshness = "recent",
                FreshnessLabelAr = "",
            },
        },
        Market = new ValuationComparableMarketDto
        {
            AdjustmentLines = lines,
            WeightIsManual = manualWeight,
            WeightPct = manualWeight ? 60m : null,
            EffectiveWeightPct = manualWeight ? 60m : 50m,
            WeightOverrideRationale = weightRationale,
        },
    };

    private static ValuationComparableAdjustmentLineDto Line(
        string key, string label, decimal pct, string rationale = "", bool included = true) => new()
    {
        FactorKey = key,
        LabelAr = label,
        Percent = pct,
        Rationale = rationale,
        IsIncluded = included,
    };

    [Fact]
    public void Every_unexplained_factor_and_manual_weight_of_an_adopted_comparable_is_named()
    {
        var list = new ValuationComparableSelectionListDto
        {
            FactorRationales =
            [
                new ValuationAdjustmentFactorRationaleDto
                {
                    SelectionContext = "market", FactorKey = "street", RationaleAr = "الشارع أعرض من شارع العقار",
                },
                new ValuationAdjustmentFactorRationaleDto
                {
                    SelectionContext = "market", FactorKey = "age", RationaleAr = "قصير",
                },
            ],
            Items =
            [
                Item("CMP-1", adopted: true,
                [
                    Line("location", "الموقع", 10m),                          // blank → named
                    Line("street", "الشارع", -5m),                            // factor rationale covers it
                    Line("age", "العمر", 3m),                                 // factor rationale too short
                    Line("finishing", "التشطيب", 4m, "اختلاف واضح في جودة التشطيب"), // own override
                    Line("view", "الإطلالة", 0m),                             // zero → nothing to explain
                    Line("shape", "الشكل", 6m, included: false),              // excluded
                ], manualWeight: true, weightRationale: ""),
                Item("CMP-2", adopted: true, [], manualWeight: true, weightRationale: "أحدث صفقة وأقرب موقع للعقار"),
                Item("CMP-3", adopted: false, [Line("location", "الموقع", 20m)], manualWeight: true),
            ],
        };

        var unexplained = ValuationIssuanceGateInputRules.UnexplainedAdjustments(list);

        Assert.Equal(["CMP-1: الموقع (+10٪)", "CMP-1: العمر (+3٪)", "CMP-1: الوزن اليدوي (60٪)"], unexplained);
    }

    [Fact]
    public void The_rationale_gate_blocks_issuance_and_names_every_item_but_passes_when_the_table_is_off()
    {
        var check = ValuationIssuanceGateRules.AdjustmentRationales(
            "market", "أسلوب السوق", true, ["CMP-1: الموقع (+10٪)", "CMP-1: الوزن اليدوي (60٪)"]);

        Assert.False(check.Passed);
        Assert.True(check.IsHard);
        Assert.Equal("adjustment_rationales_market", check.Code);
        Assert.Contains("CMP-1: الموقع (+10٪)، CMP-1: الوزن اليدوي (60٪)", check.DetailAr);
        Assert.Contains("10 أحرف", check.DetailAr);
        Assert.True(ValuationIssuanceGateRules.AdjustmentRationales("market", "أسلوب السوق", false, ["x"]).Passed);
        Assert.True(ValuationIssuanceGateRules.AdjustmentRationales("market", "أسلوب السوق", true, []).Passed);
        Assert.Empty(ValuationIssuanceGateInputRules.UnexplainedAdjustments(null));
    }

    [Fact]
    public void The_rationale_gate_is_the_appraisers_and_holds_the_hand_over()
    {
        var error = RealEstateEval.CaseStudy.Application.Rules.AppraisalHandOverGateRules.HandOverError(new()
        {
            Gates =
            [
                new RealEstateEval.Application.Contracts.ValuationIssuanceGateSnapshotItemDto
                {
                    Code = "adjustment_rationales_market",
                    LabelAr = "مبررات التسويات والأوزان اليدوية (أسلوب السوق)",
                    IsHard = true,
                    Passed = false,
                    DetailAr = "تسويات أو أوزان يدوية بلا مبرر (أسلوب السوق) — CMP-1: الموقع (+10٪)",
                },
            ],
        });

        Assert.Contains("CMP-1: الموقع (+10٪) — يعالجها: المقيّم", error!["issuanceGates"]);
    }

    // ------------------------------------------------ age rationales (alerts 6 / 10 / 12) — 10 characters

    private static ValuationMethodologyAlertInput CostInput(
        decimal extension = 0m, string? basis = null,
        decimal functional = 0m, string? functionalRationale = null,
        decimal restriction = 0m, string? restrictionRationale = null) => new(
        HasStructuresToValue: true,
        CostApproachRelevant: true,
        CostLines: [],
        AdoptedComparableCount: 1,
        ComparableWeightsSumTo100: true,
        ReconciliationWeightsSumTo100: true,
        HasReconciliationSaved: true,
        LiquidationDiscountPct: 0m,
        LiquidationDiscountRationale: null,
        AdoptedComparables: [],
        LifeExtensionYears: extension,
        LifeExtensionBasis: basis,
        FunctionalObsolescencePct: functional,
        FunctionalObsolescenceRationale: functionalRationale,
        UseRestrictionDiscountPct: restriction,
        UseRestrictionRationale: restrictionRationale);

    [Theory]
    [InlineData(null, true)]
    [InlineData("ترميم", true)]
    [InlineData("ترميم شامل للهيكل عام 2024", false)]
    public void Age_and_land_rationales_the_alerts_require_need_ten_characters(string? text, bool fires)
    {
        var checks = ValuationMethodologyAlertRules.Evaluate(
            CostInput(extension: 5m, basis: text, functional: 10m, functionalRationale: text,
                restriction: 10m, restrictionRationale: text));

        Assert.Equal(fires, checks.Single(c => c.Number == 6).Triggered);
        Assert.Equal(fires, checks.Single(c => c.Number == 10).Triggered);
        Assert.Equal(fires, checks.Single(c => c.Number == 12).Triggered);
    }

    [Fact]
    public void A_short_life_extension_basis_is_refused_at_save_but_blank_stays_a_draft()
    {
        var shortBasis = ValuationCostApproachRequestRules.Validate(new SaveValuationCostApproachRequest
        {
            LifeExtensionYears = 5m,
            LifeExtensionBasis = "ترميم",
        });
        Assert.Equal("بيان أساس تمديد العمر يجب ألا يقل عن 10 أحرف", shortBasis["lifeExtensionBasis"]);

        var blank = ValuationCostApproachRequestRules.Validate(new SaveValuationCostApproachRequest
        {
            LifeExtensionYears = 5m,
        });
        Assert.False(blank.ContainsKey("lifeExtensionBasis"));
    }

    // ------------------------------------------------ 3. small validations

    [Fact]
    public void An_unknown_valuation_date_mode_is_refused()
    {
        var errors = ValuationApproachSettingsRules.Validate(
            true, false, false, null, null, "فيلا",
            valuationPurposeKey: ValuationPurposeKeys.JudicialExecution,
            valuationDateMode: "xyz");
        Assert.Contains("نوع تاريخ التقييم غير معروف", errors["valuationDateMode"]);

        var ok = ValuationApproachSettingsRules.Validate(
            true, false, false, null, null, "فيلا",
            valuationPurposeKey: ValuationPurposeKeys.JudicialExecution,
            valuationDateMode: "issue");
        Assert.False(ok.ContainsKey("valuationDateMode"));
    }

    [Theory]
    [InlineData("xyz", true)]
    [InlineData("market", false)]
    [InlineData("LAND_WITHIN_COST", false)]
    [InlineData(null, false)]
    [InlineData("", false)]
    public void An_unknown_selection_context_is_refused(string? context, bool refused)
    {
        Assert.Equal(refused, ValuationComparableSelectionRequestRules.SelectionContextError(context) is not null);
    }

    [Fact]
    public void An_unknown_cost_structure_kind_is_refused()
    {
        var errors = ValuationCostApproachRequestRules.Validate(new SaveValuationCostApproachRequest
        {
            Lines =
            [
                new SaveValuationCostLineRequest { StructureKind = "xyz", Label = "بند", AreaSqm = 1m, UnitCostSar = 1m },
                new SaveValuationCostLineRequest { StructureKind = "Fence", Label = "سور", AreaSqm = 1m, UnitCostSar = 1m },
            ],
        });

        Assert.Contains("نوع المكوّن غير معروف", errors["lines[0].structureKind"]);
        Assert.False(errors.ContainsKey("lines[1].structureKind"));
    }

    [Fact]
    public void A_disposition_for_a_blank_or_unknown_alert_code_is_refused_but_a_retired_code_round_trips()
    {
        var errors = new Dictionary<string, string>();
        ValuationReconciliationService.AddAlertOverrideCodeErrors(
            [
                new ValuationMethodologyAlertOverrideDto { Code = "xyz", Acknowledged = true },
                new ValuationMethodologyAlertOverrideDto { Code = " ", Acknowledged = true },
                new ValuationMethodologyAlertOverrideDto { Code = ValuationMethodologyAlertCodes.LargeAdjustments, OverrideRationale = "مبرر كافٍ للتسوية" },
                new ValuationMethodologyAlertOverrideDto { Code = "m20_stale_comparable_no_time_adjustment", Acknowledged = true },
            ],
            errors);

        Assert.Equal(2, errors.Count);
        Assert.Contains("«xyz»", errors["methodologyAlertOverrides[0].code"]);
        Assert.Equal(ValuationReconciliationService.AlertCodeRequiredAr, errors["methodologyAlertOverrides[1].code"]);
        Assert.Equal(27, ValuationMethodologyAlertCodes.All.Count);
    }

    [Fact]
    public void A_zero_subject_area_is_refused_on_the_per_square_metre_basis_only()
    {
        var perSqm = ValuationComparableSelectionRequestRules.ValidateMarketApproach(
            new() { SubjectAreaSqm = 0m, AdjustmentBasis = "price_per_sqm" });
        Assert.Contains("أكبر من صفر", perSqm!["subjectAreaSqm"]);
        Assert.NotNull(ValuationComparableSelectionRequestRules.ValidateMarketApproach(new() { SubjectAreaSqm = 0m }));
        Assert.Null(ValuationComparableSelectionRequestRules.ValidateMarketApproach(
            new() { SubjectAreaSqm = 0m, AdjustmentBasis = "whole_property" }));
    }

    [Fact]
    public void A_bank_comparable_dated_after_today_is_refused()
    {
        var today = new DateOnly(2026, 10, 26);
        Assert.True(ComparablePropertyRules.IsFutureTransactionDate(new DateOnly(2027, 1, 1), today));
        Assert.False(ComparablePropertyRules.IsFutureTransactionDate(today, today));
    }

    [Theory]
    [InlineData("تجاري", "سكني", "فيلا", "تجاري")]
    [InlineData("", "سكني", "أرض", "سكني")]
    [InlineData(null, null, "فيلا", "سكني")]
    [InlineData(null, "", "معرض تجاري", "تجاري")]
    [InlineData(null, null, "أرض", "")]
    public void A_bank_row_carries_a_usage(string? usage, string? classification, string type, string expected)
    {
        Assert.Equal(expected, ComparablePropertyRules.UsageOrDefault(usage, classification, type));
    }

    // ------------------------------------------------ 4. wording

    [Fact]
    public void Alert_23_names_the_end_of_a_retrospective_period()
    {
        var input = new ValuationMethodologyAlertInput(
            HasStructuresToValue: false,
            CostApproachRelevant: false,
            CostLines: [],
            AdoptedComparableCount: 1,
            ComparableWeightsSumTo100: true,
            ReconciliationWeightsSumTo100: true,
            HasReconciliationSaved: true,
            LiquidationDiscountPct: 0m,
            LiquidationDiscountRationale: null,
            AdoptedComparables: [new("أرض", false, 0m, TransactionDate: new DateOnly(2025, 6, 1), ReferenceCode: "CMP-9")],
            ComparableDateCutoff: new DateOnly(2025, 3, 31),
            Today: new DateOnly(2026, 10, 26),
            ComparableDateCutoffIsPeriodEnd: true);

        var period = ValuationMethodologyAlertRules.Evaluate(input).Single(c => c.Number == 23);
        Assert.True(period.Triggered);
        Assert.Contains("نهاية فترة التقييم 2025/03/31", period.DetailAr);
        Assert.DoesNotContain("بعد تاريخ التقييم", period.DetailAr);

        var single = ValuationMethodologyAlertRules.Evaluate(input with { ComparableDateCutoffIsPeriodEnd = false })
            .Single(c => c.Number == 23);
        Assert.Contains("بعد تاريخ التقييم 2025/03/31", single.DetailAr);

        Assert.True(MarketApproachRules.ComparableDateCutoffIsPeriodEnd(
            "retrospective", new DateOnly(2025, 1, 1), new DateOnly(2025, 3, 31)));
        Assert.False(MarketApproachRules.ComparableDateCutoffIsPeriodEnd(
            "retrospective", new DateOnly(2025, 1, 1), null));
        Assert.False(MarketApproachRules.ComparableDateCutoffIsPeriodEnd(
            "issue", new DateOnly(2025, 1, 1), new DateOnly(2025, 3, 31)));
    }

    [Theory]
    [InlineData("orderly", "نسبة خصم التصفية المنظمة", "القيمة النهائية قبل خصم التصفية المنظمة")]
    [InlineData("forced", "نسبة خصم البيع القسري", "القيمة النهائية قبل خصم البيع القسري")]
    public void The_report_liquidation_fields_follow_the_premise(string premise, string pct, string before)
    {
        Assert.Equal(pct, ReconciliationLiquidationMessages.ReportFieldLabelAr("final.liquidation_discount_pct", premise));
        Assert.Equal(before, ReconciliationLiquidationMessages.ReportFieldLabelAr("final.opinion_before_liquidation", premise));
        Assert.Null(ReconciliationLiquidationMessages.ReportFieldLabelAr("final.opinion_value", premise));
    }

    [Fact]
    public void Several_field_messages_are_separated_not_glued()
    {
        var detail = ApiProblemExtensions.JoinMessages(
        [
            "مبرر التسوية للمقارن يجب ألا يقل عن 10 أحرف",
            "عامل التسوية مكرر على المقارن نفسه — سطر واحد لكل عامل",
            "عامل التسوية مكرر على المقارن نفسه — سطر واحد لكل عامل",
        ]);

        Assert.Equal(
            "مبرر التسوية للمقارن يجب ألا يقل عن 10 أحرف. عامل التسوية مكرر على المقارن نفسه — سطر واحد لكل عامل",
            detail);
        Assert.Equal("سطر.", ApiProblemExtensions.JoinMessages(["سطر."]));
    }
}

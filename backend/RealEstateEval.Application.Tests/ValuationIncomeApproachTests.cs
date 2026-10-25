using System.Reflection;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.Infrastructure.Services;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Application.Rules;
using RealEstateEval.Valuation.Application.Services;
using RealEstateEval.Valuation.Domain;
using RealEstateEval.Valuation.Infrastructure.Data.Contexts;
using RealEstateEval.Valuation.Infrastructure.Persistence;
using Xunit;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// D17 — income approach by direct capitalisation: the chain (EGI → NOI → value) by hand, the save
/// bounds (Arabic 400s, never 500s), the settings and freeze gates, alerts 26–28, the issuance gate
/// «أسلوب الدخل مكتمل», and the income row in the reconciliation (with market/cost, or alone).
/// </summary>
public class ValuationIncomeApproachTests
{
    // ─── the chain by hand ───

    [Fact]
    public void Hand_calculation_GPI_600k_vacancy_5_opex_20_pct_cap_7_5_gives_6_080_000()
    {
        var egi = IncomeApproachRules.EffectiveGrossIncome(600_000m, 5m, 0m);
        var opex = IncomeApproachRules.OperatingExpenses(OperatingExpenseModes.PctOfEgi, 0m, 20m, egi);
        var noi = IncomeApproachRules.NetOperatingIncome(egi, opex);

        Assert.Equal(30_000m, IncomeApproachRules.VacancyLoss(600_000m, 5m));
        Assert.Equal(570_000m, egi);
        Assert.Equal(114_000m, opex);
        Assert.Equal(456_000m, noi);
        Assert.Equal(6_080_000m, IncomeApproachRules.CapitalisedValue(noi, 7.5m));
        Assert.True(IncomeApproachRules.IsComplete(600_000m, 7.5m, noi));
    }

    [Fact]
    public void Expenses_as_an_amount_and_other_income_follow_the_formula()
    {
        // EGI = 500,000 × 0.9 + 20,000 = 470,000; NOI = 470,000 − 120,000 = 350,000; ÷ 8٪ = 4,375,000.
        var egi = IncomeApproachRules.EffectiveGrossIncome(500_000m, 10m, 20_000m);
        var opex = IncomeApproachRules.OperatingExpenses(OperatingExpenseModes.Amount, 120_000m, 99m, egi);

        Assert.Equal(470_000m, egi);
        Assert.Equal(120_000m, opex);
        Assert.Equal(4_375_000m, IncomeApproachRules.CapitalisedValue(IncomeApproachRules.NetOperatingIncome(egi, opex), 8m));
        Assert.Equal(25.53m, IncomeApproachRules.OperatingExpensesPctOfEgi(opex, egi));
    }

    [Fact]
    public void No_cap_rate_or_a_non_positive_NOI_yields_no_value()
    {
        Assert.Equal(0m, IncomeApproachRules.CapitalisedValue(456_000m, null));
        Assert.Equal(0m, IncomeApproachRules.CapitalisedValue(-1m, 7.5m));
        Assert.Equal(0m, IncomeApproachRules.CapitalisedValue(0m, 7.5m));
        Assert.False(IncomeApproachRules.IsComplete(600_000m, null, 456_000m));
        Assert.Null(IncomeApproachRules.OperatingExpensesPctOfEgi(10m, 0m));
    }

    // ─── request bounds ───

    [Theory]
    [InlineData("capitalisationRatePct", 0, "أكبر من 0")]
    [InlineData("capitalisationRatePct", 30.01, "30")]
    [InlineData("capitalisationRatePct", -2, "أكبر من 0")]
    [InlineData("capitalisationRatePct", 0.00001, "أكبر من 0")]
    [InlineData("vacancyCollectionLossPct", 101, "بين 0 و 100")]
    [InlineData("vacancyCollectionLossPct", -1, "بين 0 و 100")]
    [InlineData("operatingExpensesPct", 150, "بين 0 و 100")]
    [InlineData("grossPotentialIncome", -5, "≥ 0")]
    [InlineData("grossPotentialIncome", 1e15, "الحد المعقول")]
    [InlineData("otherIncome", 1e15, "الحد المعقول")]
    [InlineData("operatingExpensesAmount", 1e15, "الحد المعقول")]
    public void Out_of_bounds_inputs_are_refused_in_arabic(string key, double value, string expected)
    {
        var v = (decimal)value;
        var request = key switch
        {
            "capitalisationRatePct" => Valid() with { CapitalisationRatePct = v },
            "vacancyCollectionLossPct" => Valid() with { VacancyCollectionLossPct = v },
            "operatingExpensesPct" => Valid() with { OperatingExpensesPct = v },
            "grossPotentialIncome" => Valid() with { GrossPotentialIncome = v },
            "otherIncome" => Valid() with { OtherIncome = v },
            _ => Valid() with { OperatingExpensesAmount = v },
        };

        var errors = ValuationIncomeApproachRequestRules.Validate(request.ToRequest());

        Assert.Contains(expected, errors[key]);
    }

    [Fact]
    public void Bounds_accept_30_percent_100_percent_vacancy_and_a_missing_cap_rate()
    {
        Assert.Empty(ValuationIncomeApproachRequestRules.Validate((Valid() with { CapitalisationRatePct = 30m }).ToRequest()));
        Assert.Empty(ValuationIncomeApproachRequestRules.Validate((Valid() with { VacancyCollectionLossPct = 100m }).ToRequest()));
        Assert.Empty(ValuationIncomeApproachRequestRules.Validate((Valid() with { CapitalisationRatePct = null }).ToRequest()));
        var badMode = ValuationIncomeApproachRequestRules.Validate((Valid() with { Mode = "monthly" }).ToRequest());
        Assert.Contains("غير معروفة", badMode["operatingExpensesMode"]);
        var longRationale = ValuationIncomeApproachRequestRules.Validate(
            (Valid() with { Rationale = new string('م', 2001) }).ToRequest());
        Assert.Contains("2,000", longRationale["capRateRationale"]);
    }

    // ─── service ───

    [Fact]
    public async Task Save_is_refused_while_the_income_approach_is_off()
    {
        await using var contexts = TestDatabases.Create("income-off");
        var (service, requestId) = await NewServiceAsync(contexts.Valuation, incomeEnabled: false);

        var (result, errors) = await service.SaveAsync(requestId, Valid().ToRequest());

        Assert.Null(result);
        Assert.Equal(ValuationIncomeApproachService.NotEnabledAr, errors!["_"]);
        var dto = await service.GetAsync(requestId);
        Assert.False(dto!.IsSaved);
        Assert.False(dto.IncomeApproachEnabled);
    }

    [Fact]
    public async Task A_saved_income_approach_reloads_with_the_hand_calculated_chain()
    {
        await using var contexts = TestDatabases.Create("income-save");
        var (service, requestId) = await NewServiceAsync(contexts.Valuation, incomeEnabled: true);

        var (saved, errors) = await service.SaveAsync(requestId, Valid().ToRequest());

        Assert.Null(errors);
        Assert.NotNull(saved);
        var dto = await service.GetAsync(requestId);
        Assert.True(dto!.IsSaved);
        Assert.True(dto.IncomeApproachEnabled);
        Assert.Equal(570_000m, dto.EffectiveGrossIncome);
        Assert.Equal(114_000m, dto.OperatingExpensesTotal);
        Assert.Equal(20m, dto.OperatingExpensesPctOfEgi);
        Assert.Equal(456_000m, dto.NetOperatingIncome);
        Assert.Equal(6_080_000m, dto.IncomeValue);
        Assert.True(dto.IsComplete);
        Assert.Equal("عوائد صفقات مكاتب مماثلة في الحي", dto.CapRateRationale);
    }

    [Fact]
    public async Task A_draft_without_a_cap_rate_saves_but_is_not_complete()
    {
        await using var contexts = TestDatabases.Create("income-draft");
        var (service, requestId) = await NewServiceAsync(contexts.Valuation, incomeEnabled: true);

        var (saved, errors) = await service.SaveAsync(requestId, (Valid() with { CapitalisationRatePct = null }).ToRequest());

        Assert.Null(errors);
        Assert.Equal(456_000m, saved!.NetOperatingIncome);
        Assert.Equal(0m, saved.IncomeValue);
        Assert.False(saved.IsComplete);
    }

    [Fact]
    public async Task An_absurd_payload_is_a_field_error_and_nothing_is_stored()
    {
        await using var contexts = TestDatabases.Create("income-huge");
        var (service, requestId) = await NewServiceAsync(contexts.Valuation, incomeEnabled: true);

        var (_, errors) = await service.SaveAsync(requestId, (Valid() with { GrossPotentialIncome = 1e20m }).ToRequest());

        Assert.Contains("الحد المعقول", errors!["grossPotentialIncome"]);
        Assert.False((await service.GetAsync(requestId))!.IsSaved);
    }

    [Fact]
    public async Task A_done_request_is_locked_like_the_cost_approach()
    {
        await using var contexts = TestDatabases.Create("income-done");
        var (service, requestId) = await NewServiceAsync(contexts.Valuation, incomeEnabled: true);
        var vr = contexts.Valuation.ValuationRequests.Single(x => x.Id == requestId);
        vr.SubmitReport(DateTime.UtcNow);
        await contexts.Valuation.SaveChangesAsync();

        var (result, errors) = await service.SaveAsync(requestId, Valid().ToRequest());

        Assert.Null(result);
        Assert.Equal("طلب التقييم مكتمل", errors!["_"]);
    }

    // ─── alerts 26–28 ───

    [Fact]
    public void Alerts_26_to_28_have_their_severities()
    {
        Assert.True(ValuationMethodologyAlertSeverity.RequiresRationale(26));
        Assert.True(ValuationMethodologyAlertSeverity.RequiresAcknowledgement(27));
        Assert.True(ValuationMethodologyAlertSeverity.IsHard(28));
        Assert.False(ValuationMethodologyAlertSeverity.IsHard(26));
        Assert.False(ValuationMethodologyAlertSeverity.IsHard(27));
    }

    [Fact]
    public void Income_alerts_are_not_evaluated_while_the_approach_is_off()
    {
        var checks = ValuationMethodologyAlertRules.Evaluate(AlertInput(null));

        Assert.All(checks.Where(c => c.Number is >= 26 and <= 28), c => Assert.False(c.Evaluated));
    }

    [Theory]
    [InlineData(3.99, true)]
    [InlineData(4, false)]
    [InlineData(7.5, false)]
    [InlineData(12, false)]
    [InlineData(12.01, true)]
    public void Cap_rate_outside_4_to_12_needs_a_rationale(double cap, bool triggered)
    {
        var check = ValuationMethodologyAlertRules.Evaluate(AlertInput(Income(capRate: (decimal)cap)))
            .Single(c => c.Number == 26);

        Assert.Equal(triggered, check.Triggered);
        Assert.Equal(triggered, check.BlocksIssuance);
        Assert.Equal(ValuationMethodologyAlertSeverityKinds.RequireRationale, check.SeverityKind);
    }

    [Fact]
    public void A_written_rationale_clears_the_cap_rate_alert()
    {
        var input = AlertInput(Income(capRate: 14m)) with
        {
            Resolutions = [new ValuationMethodologyAlertResolution(
                ValuationMethodologyAlertCodes.CapRateOutOfRange,
                "عوائد أصول مماثلة عالية المخاطر في السوق المحلي")],
        };

        var check = ValuationMethodologyAlertRules.Evaluate(input).Single(c => c.Number == 26);

        Assert.True(check.Triggered);
        Assert.False(check.BlocksIssuance);
    }

    [Fact]
    public void Expenses_above_half_of_EGI_need_an_acknowledgement()
    {
        var over = ValuationMethodologyAlertRules.Evaluate(AlertInput(Income(opex: 300_000m))).Single(c => c.Number == 27);
        var half = ValuationMethodologyAlertRules.Evaluate(AlertInput(Income(opex: 285_000m))).Single(c => c.Number == 27);
        var acked = ValuationMethodologyAlertRules.Evaluate(AlertInput(Income(opex: 300_000m)) with
        {
            Resolutions = [new ValuationMethodologyAlertResolution(ValuationMethodologyAlertCodes.OpexOverHalfOfEgi, Acknowledged: true)],
        }).Single(c => c.Number == 27);

        Assert.True(over.Triggered);
        Assert.True(over.BlocksIssuance);
        Assert.Contains("52.63", over.DetailAr);
        Assert.False(half.Triggered);
        Assert.True(acked.Triggered);
        Assert.False(acked.BlocksIssuance);
    }

    [Fact]
    public void A_non_positive_NOI_is_a_hard_alert_that_no_disposition_clears()
    {
        var input = AlertInput(Income(opex: 570_000m)) with
        {
            Resolutions = [new ValuationMethodologyAlertResolution(ValuationMethodologyAlertCodes.NoiNotPositive, "سبب", true)],
        };

        var check = ValuationMethodologyAlertRules.Evaluate(input).Single(c => c.Number == 28);

        Assert.True(check.Triggered);
        Assert.True(check.IsHard);
        Assert.True(check.BlocksIssuance);
    }

    [Fact]
    public void The_gate_feeds_alerts_only_from_a_saved_income_approach()
    {
        Assert.Null(IncomeApproachAlertInputRules.AlertInput(null));
        Assert.Null(IncomeApproachAlertInputRules.AlertInput(new ValuationIncomeApproachDto { IsSaved = false }));
        var input = IncomeApproachAlertInputRules.AlertInput(new ValuationIncomeApproachDto
        {
            IsSaved = true,
            GrossPotentialIncome = 600_000m,
            EffectiveGrossIncome = 570_000m,
            OperatingExpensesTotal = 114_000m,
            NetOperatingIncome = 456_000m,
            CapitalisationRatePct = 7.5m,
        });
        Assert.Equal(new ValuationMethodologyAlertIncomeInput(600_000m, 570_000m, 114_000m, 456_000m, 7.5m), input);
    }

    [Fact]
    public void The_cap_rate_rationale_on_the_income_screen_clears_alert_26_unless_an_override_exists()
    {
        var dto = new ValuationIncomeApproachDto { IsSaved = true, CapRateRationale = "عوائد أصول مماثلة عالية المخاطر في السوق المحلي" };
        var fromScreen = new List<ValuationMethodologyAlertResolution>();
        IncomeApproachAlertInputRules.AddCapRateRationale(fromScreen, dto);
        var check = ValuationMethodologyAlertRules.Evaluate(AlertInput(Income(capRate: 14m)) with { Resolutions = fromScreen })
            .Single(c => c.Number == 26);
        Assert.False(check.BlocksIssuance);

        var overridden = new List<ValuationMethodologyAlertResolution>
        {
            new(ValuationMethodologyAlertCodes.CapRateOutOfRange, "مبرر محفوظ في لوحة التنبيهات"),
        };
        IncomeApproachAlertInputRules.AddCapRateRationale(overridden, dto);
        Assert.Single(overridden);
        Assert.Equal("مبرر محفوظ في لوحة التنبيهات", overridden[0].OverrideRationale);

        var none = new List<ValuationMethodologyAlertResolution>();
        IncomeApproachAlertInputRules.AddCapRateRationale(none, null);
        Assert.Empty(none);
    }

    // ─── issuance gate + hand-over ───

    [Fact]
    public void The_income_gate_passes_when_off_or_complete_and_blocks_when_enabled_and_incomplete()
    {
        Assert.True(ValuationIssuanceGateRules.IncomeApproachComplete(false, false).Passed);
        Assert.True(ValuationIssuanceGateRules.IncomeApproachComplete(true, true).Passed);
        var blocked = ValuationIssuanceGateRules.IncomeApproachComplete(true, false);
        Assert.False(blocked.Passed);
        Assert.True(blocked.IsHard);
        Assert.Equal("أسلوب الدخل مكتمل", blocked.LabelAr);
        Assert.Equal(ValuationIssuanceGateCodes.IncomeApproachComplete, blocked.Code);
    }

    [Fact]
    public void An_incomplete_income_approach_and_its_alerts_hold_up_the_hand_over_as_the_appraisers()
    {
        var blockers = AppraisalHandOverGateRules.Classify(new ValuationIssuanceGatesSnapshotDto
        {
            Gates =
            [
                new ValuationIssuanceGateSnapshotItemDto
                {
                    Code = ValuationIssuanceGateCodes.IncomeApproachComplete,
                    LabelAr = "أسلوب الدخل مكتمل",
                    Passed = false,
                    IsHard = true,
                },
            ],
            MethodologyAlerts =
            [
                new ValuationMethodologyAlertSnapshotItemDto
                {
                    Number = 28,
                    Code = ValuationMethodologyAlertCodes.NoiNotPositive,
                    LabelAr = "صافي الدخل التشغيلي صفر أو سالب",
                    BlocksIssuance = true,
                },
            ],
        });

        Assert.Equal(2, blockers.Count);
        Assert.All(blockers, b =>
        {
            Assert.True(b.BlocksHandOver);
            Assert.Equal(AppraisalHandOverGateRules.AppraiserOwnerAr, b.OwnerAr);
        });
    }

    // ─── reconciliation ───

    [Fact]
    public void Income_is_a_known_reconciliation_kind_after_market_and_cost()
    {
        Assert.True(ValuationApproachKinds.IsKnown("income"));
        Assert.Equal("أسلوب الدخل (رسملة مباشرة)", ValuationApproachKinds.LabelAr("income"));
        Assert.Equal(
            [ValuationApproachKinds.Market, ValuationApproachKinds.Cost, ValuationApproachKinds.Income],
            ValuationApproachSettingsRules.EnabledReconciliationKinds(true, true, true));
        Assert.Equal(
            [ValuationApproachKinds.Income],
            ValuationApproachSettingsRules.EnabledReconciliationKinds(false, false, true));
        Assert.Equal(3m, ValuationApproachKinds.ValueOf("income", 1m, 2m, 3m));
        Assert.Equal(2m, ValuationApproachKinds.ValueOf("cost", 1m, 2m, 3m));
        Assert.Equal(1m, ValuationApproachKinds.ValueOf("market", 1m, 2m, 3m));
    }

    [Fact]
    public void Suggested_weights_go_market_then_cost_then_income()
    {
        var kinds = new[] { ValuationApproachKinds.Market, ValuationApproachKinds.Income };
        var marketFirst = ReconciliationRules.SuggestWeights(kinds, 1_000_000m, 0m, 6_080_000m);
        var incomeOnly = ReconciliationRules.SuggestWeights(kinds, 0m, 0m, 6_080_000m);

        Assert.Equal(100m, marketFirst[ValuationApproachKinds.Market]);
        Assert.Equal(0m, marketFirst[ValuationApproachKinds.Income]);
        Assert.Equal(0m, incomeOnly[ValuationApproachKinds.Market]);
        Assert.Equal(100m, incomeOnly[ValuationApproachKinds.Income]);
    }

    [Fact]
    public async Task An_income_only_valuation_reconciles_the_income_value_at_100_percent()
    {
        await using var contexts = TestDatabases.Create("income-recon-alone");
        var requestId = await NewRequestAsync(contexts.Valuation, market: false, income: true);
        var service = ReconciliationService(contexts.Valuation, incomeValue: 6_080_000m);

        var read = await service.GetAsync(requestId);
        var row = Assert.Single(read!.Methods);
        Assert.Equal(ValuationApproachKinds.Income, row.ApproachKind);
        Assert.Equal("أسلوب الدخل (رسملة مباشرة)", row.LabelAr);
        Assert.Equal(100m, row.WeightPct);
        Assert.Equal(6_080_000m, read.IncomeOpinionValue);

        var (saved, errors) = await service.SaveAsync(requestId, new SaveValuationReconciliationRequest
        {
            Methods = [new SaveValuationReconciliationMethodRequest { ApproachKind = "income", WeightPct = 100m, IsIncluded = true }],
            MethodsRationale = "عقار مدرّ للدخل — أسلوب الدخل وحده",
            BasisOfValueKey = BasisOfValueKeys.Market,
        });

        Assert.Null(errors);
        Assert.Equal(6_080_000m, saved!.FinalOpinionValue);
    }

    [Fact]
    public async Task Income_weights_with_market_and_is_refused_once_switched_off()
    {
        await using var contexts = TestDatabases.Create("income-recon-weights");
        var requestId = await NewRequestAsync(contexts.Valuation, market: true, income: true);
        var service = ReconciliationService(contexts.Valuation, incomeValue: 6_080_000m);

        var read = await service.GetAsync(requestId);
        Assert.Equal(
            [ValuationApproachKinds.Market, ValuationApproachKinds.Income],
            read!.Methods.Select(m => m.ApproachKind).ToArray());

        var (saved, errors) = await service.SaveAsync(requestId, new SaveValuationReconciliationRequest
        {
            Methods =
            [
                new SaveValuationReconciliationMethodRequest { ApproachKind = "market", WeightPct = 50m, IsIncluded = true },
                new SaveValuationReconciliationMethodRequest { ApproachKind = "income", WeightPct = 50m, IsIncluded = true, SortOrder = 1 },
            ],
            MethodsRationale = "ترجيح متساوٍ",
            BasisOfValueKey = BasisOfValueKeys.Market,
        });
        Assert.Null(errors);
        // Market reads 0 here (no comparables), so 50٪ × 6,080,000 = 3,040,000.
        Assert.Equal(3_040_000m, saved!.WeightedValue);
        Assert.Equal(6_080_000m, saved.Methods.Single(m => m.ApproachKind == "income").ApproachValue);

        var settings = contexts.Valuation.ValuationApproachSettings.Single(s => s.ValuationRequestId == requestId);
        settings.IncomeApproachEnabled = false;
        await contexts.Valuation.SaveChangesAsync();
        var (_, offErrors) = await service.SaveAsync(requestId, new SaveValuationReconciliationRequest
        {
            Methods =
            [
                new SaveValuationReconciliationMethodRequest { ApproachKind = "market", WeightPct = 50m },
                new SaveValuationReconciliationMethodRequest { ApproachKind = "income", WeightPct = 50m, SortOrder = 1 },
            ],
            MethodsRationale = "ترجيح متساوٍ",
            BasisOfValueKey = BasisOfValueKeys.Market,
        });
        Assert.Contains("غير مفعَّل", offErrors!["methods[1].approachKind"]);
    }

    // ─── helpers ───

    private sealed record Input(
        decimal GrossPotentialIncome = 600_000m,
        decimal VacancyCollectionLossPct = 5m,
        decimal OtherIncome = 0m,
        string? Mode = OperatingExpenseModes.PctOfEgi,
        decimal OperatingExpensesAmount = 0m,
        decimal OperatingExpensesPct = 20m,
        decimal? CapitalisationRatePct = 7.5m,
        string? Rationale = "  عوائد صفقات مكاتب مماثلة في الحي ")
    {
        public SaveValuationIncomeApproachRequest ToRequest() => new()
        {
            GrossPotentialIncome = GrossPotentialIncome,
            VacancyCollectionLossPct = VacancyCollectionLossPct,
            OtherIncome = OtherIncome,
            OperatingExpensesMode = Mode,
            OperatingExpensesAmount = OperatingExpensesAmount,
            OperatingExpensesPct = OperatingExpensesPct,
            CapitalisationRatePct = CapitalisationRatePct,
            CapRateRationale = Rationale,
        };
    }

    private static Input Valid() => new();

    /// <summary>GPI 600,000 at 5٪ vacancy → EGI 570,000; opex and cap rate vary per test.</summary>
    private static ValuationMethodologyAlertIncomeInput Income(decimal capRate = 7.5m, decimal opex = 114_000m) =>
        new(600_000m, 570_000m, opex, 570_000m - opex, capRate);

    private static ValuationMethodologyAlertInput AlertInput(ValuationMethodologyAlertIncomeInput? income) =>
        new(
            HasStructuresToValue: true,
            CostApproachRelevant: false,
            CostLines: [],
            AdoptedComparableCount: 3,
            ComparableWeightsSumTo100: true,
            ReconciliationWeightsSumTo100: true,
            HasReconciliationSaved: true,
            LiquidationDiscountPct: 0m,
            LiquidationDiscountRationale: null,
            AdoptedComparables: [],
            Income: income);

    private static async Task<Guid> NewRequestAsync(ValuationDbContext db, bool market = true, bool income = true)
    {
        var id = Guid.NewGuid();
        db.ValuationRequests.Add(ValuationRequest.Create(
            id, $"VR-I-{id:N}"[..12], Guid.NewGuid(), "جدة", "مكتب", "مقيم", "2026-06-25", DateTime.UtcNow));
        db.ValuationApproachSettings.Add(new ValuationApproachSettings
        {
            Id = Guid.NewGuid(),
            ValuationRequestId = id,
            MarketApproachEnabled = market,
            CostApproachEnabled = false,
            IncomeApproachEnabled = income,
            ValuationPurposeKey = "other",
        });
        await db.SaveChangesAsync();
        return id;
    }

    private static async Task<(ValuationIncomeApproachService Service, Guid RequestId)> NewServiceAsync(
        ValuationDbContext db,
        bool incomeEnabled)
    {
        var id = await NewRequestAsync(db, income: incomeEnabled);
        var service = new ValuationIncomeApproachService(
            new ValuationIncomeApproachRepository(db),
            new ValuationReportFreezeGate(db));
        return (service, id);
    }

    private static ValuationReconciliationService ReconciliationService(ValuationDbContext db, decimal incomeValue) =>
        new(
            new ValuationReconciliationRepository(db),
            new ValuationReportFreezeGate(db),
            NullAnswers.Create<ICaseStudyLookup>(),
            new AuditLogWriter(),
            new RecordingAuditLogAppend(),
            NullAnswers.Create<IValuationComparableSelectionService>(),
            NullAnswers.Create<IValuationCostApproachService>(),
            new FixedIncome(incomeValue));

    /// <summary>The income approach as the reconciliation reads it — a fixed indicator.</summary>
    private sealed class FixedIncome(decimal value) : IValuationIncomeApproachService
    {
        public Task<ValuationIncomeApproachDto?> GetAsync(Guid valuationRequestId, CancellationToken cancellationToken = default) =>
            Task.FromResult<ValuationIncomeApproachDto?>(new ValuationIncomeApproachDto
            {
                ValuationRequestId = valuationRequestId,
                IsSaved = true,
                IncomeValue = value,
                IsComplete = value > 0m,
            });

        public Task<(ValuationIncomeApproachDto? Result, Dictionary<string, string>? Errors)> SaveAsync(
            Guid valuationRequestId,
            SaveValuationIncomeApproachRequest request,
            CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();
    }

    /// <summary>Every async read answers «nothing there» (null / empty).</summary>
    private class NullAnswers : DispatchProxy
    {
        public static T Create<T>() where T : class => DispatchProxy.Create<T, NullAnswers>();

        protected override object? Invoke(MethodInfo? targetMethod, object?[]? args)
        {
            var type = targetMethod!.ReturnType;
            if (type == typeof(Task)) return Task.CompletedTask;
            if (type.IsGenericType && type.GetGenericTypeDefinition() == typeof(Task<>))
            {
                var inner = type.GetGenericArguments()[0];
                var value = inner.IsValueType ? Activator.CreateInstance(inner) : EmptyListOrNull(inner);
                return typeof(Task).GetMethod(nameof(Task.FromResult))!.MakeGenericMethod(inner).Invoke(null, [value]);
            }
            throw new NotSupportedException(targetMethod.Name);
        }

        private static object? EmptyListOrNull(Type type) =>
            type.IsGenericType && type.GetGenericTypeDefinition() == typeof(IReadOnlyList<>)
                ? Array.CreateInstance(type.GetGenericArguments()[0], 0)
                : null;
    }
}

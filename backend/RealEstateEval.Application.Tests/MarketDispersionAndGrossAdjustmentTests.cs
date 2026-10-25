using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Application.Rules;
using RealEstateEval.Valuation.Application.Services;
using RealEstateEval.Valuation.Domain;
using RealEstateEval.Valuation.Infrastructure.Persistence;
using RealEstateEval.Valuation.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// Market approach fixes D4 (gross ±40٪), D5 (weights by gross), D6 (dispersion), D7 (no area
/// adjustment on the whole-property basis; land table always per m²), D8 (valuation date) and
/// D10 (property category) — with the numbers of the R2a/R2b/r5a/r8a journeys.
/// </summary>
public class MarketDispersionAndGrossAdjustmentTests
{
    // ─── D4: gross adjustment ───

    [Fact]
    public void Offsetting_plus_30_minus_30_is_a_61_63_pct_gross_adjustment_and_breaches_40()
    {
        // R2a comparable #5: market +1, area −0.63, location +30, access −30.
        var gross = MarketApproachRules.GrossAdjustmentPct([1m], [-0.63m, 30m, -30m]);
        Assert.Equal(61.63m, gross);
        Assert.False(MarketApproachRules.ExceedsLargeAdjustmentThreshold(-0.63m)); // the old net rule
        Assert.True(MarketApproachRules.ExceedsLargeAdjustmentThreshold(-0.63m, gross));
    }

    [Fact]
    public void A_sequential_market_adjustment_of_45_pct_alone_breaches_40()
    {
        var gross = MarketApproachRules.GrossAdjustmentPct([45m], [0m, 0m]);
        Assert.Equal(45m, gross);
        Assert.True(MarketApproachRules.ExceedsLargeAdjustmentThreshold(0m, gross));
        Assert.False(MarketApproachRules.ExceedsLargeAdjustmentThreshold(0m, 40m));
        // the net rule is kept as it was
        Assert.True(MarketApproachRules.ExceedsLargeAdjustmentThreshold(41m, 41m));
    }

    // ─── D6: dispersion ───

    private static readonly decimal[] R2aAdjusted = [857.30m, 857.15m, 805.10m, 1654.62m, 873.16m];
    private static readonly decimal[] R2aGross = [1.14m, 7.06m, 3m, 0.28m, 61.63m];

    [Fact]
    public void R2a_outlier_1650_per_sqm_deviates_93_pct_from_the_median()
    {
        Assert.Equal(857.30m, MarketApproachRules.Median(R2aAdjusted));
        var deviations = MarketApproachRules.DeviationFromMedianPcts(R2aAdjusted);
        Assert.Equal(93.0m, Math.Round(deviations[3], 1));
        Assert.Equal([false, false, false, true, false], MarketApproachRules.DispersionOutliers(R2aAdjusted));
        Assert.True(MarketApproachRules.IsDispersed(R2aAdjusted));
    }

    [Fact]
    public void R2a_without_the_outlier_is_not_dispersed()
    {
        decimal[] rates = [857.30m, 857.15m, 805.10m, 873.16m];
        Assert.True(MarketApproachRules.CoefficientOfVariationPct(rates) < 15m);
        Assert.False(MarketApproachRules.IsDispersed(rates));
    }

    [Fact]
    public void Two_rates_far_apart_are_dispersed_by_cv_but_neither_is_singled_out()
    {
        decimal[] rates = [800m, 1400m];
        Assert.Equal([false, false], MarketApproachRules.DispersionOutliers(rates));
        Assert.True(MarketApproachRules.CoefficientOfVariationPct(rates) > 15m);
        Assert.True(MarketApproachRules.IsDispersed(rates));
    }

    // ─── D5: weights by gross, outlier gets no automatic weight ───

    [Fact]
    public void R2a_old_net_weights_gave_the_outlier_30_pct()
    {
        // the evidence: net sums [-0.14, 5.56, -3, 0.28, -0.63] → [40, 5, 5, 30, 20]
        Assert.Equal([40m, 5m, 5m, 30m, 20m], MarketApproachRules.SuggestWeights([-0.14m, 5.56m, -3m, 0.28m, -0.63m]));
    }

    [Fact]
    public void R2a_gross_weights_give_the_outlier_and_the_offsetting_comparable_no_automatic_weight()
    {
        var weights = MarketApproachRules.SuggestWeights(R2aGross, R2aAdjusted);
        Assert.Equal([60m, 15m, 25m, 0m, 0m], weights);
        Assert.Equal(100m, weights.Sum());
    }

    [Fact]
    public void R2b_outlier_1400_per_sqm_no_longer_takes_65_pct()
    {
        decimal[] gross = [6.5m, 12m, 2m, 0m, 63m];
        decimal[] adjusted = [746.03m, 673.2m, 744.8m, 1400m, 741.74m];
        Assert.Equal([5m, 5m, 15m, 65m, 10m], MarketApproachRules.SuggestWeights([5m, 10m, -2m, 0m, 2m]));
        Assert.Equal([20m, 15m, 65m, 0m, 0m], MarketApproachRules.SuggestWeights(gross, adjusted));
    }

    // ─── D8: official valuation date ───

    [Fact]
    public void R5a_deal_age_is_measured_to_the_retrospective_valuation_date()
    {
        var today = new DateOnly(2026, 10, 25);
        var vd = MarketApproachRules.OfficialValuationDate("retrospective", new DateOnly(2026, 2, 25), today);
        Assert.Equal(new DateOnly(2026, 2, 25), vd);
        Assert.Equal(5, MarketApproachRules.DealAgeMonths(new DateOnly(2025, 10, 5), vd));
        Assert.Equal(13, MarketApproachRules.DealAgeMonths(new DateOnly(2025, 10, 5), today));
        Assert.Equal(2, MarketApproachRules.DealAgeMonths(new DateOnly(2025, 12, 20), vd));
        Assert.Equal(0, MarketApproachRules.DealAgeMonths(new DateOnly(2026, 6, 10), vd));
        Assert.Equal(1.67m, MarketApproachRules.SuggestMarketConditionsPct(5));
    }

    [Fact]
    public void Issuance_date_valuation_uses_today_and_a_period_cuts_off_at_its_end()
    {
        var today = new DateOnly(2026, 10, 25);
        Assert.Equal(today, MarketApproachRules.OfficialValuationDate("issue", new DateOnly(2026, 2, 25), today));
        Assert.Equal(today, MarketApproachRules.OfficialValuationDate("retrospective", null, today));
        Assert.Equal(
            new DateOnly(2026, 3, 31),
            MarketApproachRules.ComparableDateCutoff(
                "retrospective", new DateOnly(2026, 2, 25), new DateOnly(2026, 3, 31), today));
        Assert.Equal(today, MarketApproachRules.ComparableDateCutoff("issue", null, null, today));
    }

    // ─── D10: categories ───

    [Theory]
    [InlineData("أرض", null, PropertyCategoryRules.Land)]
    [InlineData("أرض", "تجاري", PropertyCategoryRules.Land)]
    [InlineData("أرض سكنية", "سكني", PropertyCategoryRules.Land)]
    [InlineData("فيلا", "سكني", PropertyCategoryRules.ResidentialBuilt)]
    [InlineData("شقة", null, PropertyCategoryRules.ResidentialBuilt)]
    [InlineData("عمارة", "تجاري سكني", PropertyCategoryRules.ResidentialBuilt)]
    [InlineData("معرض", "تجاري", PropertyCategoryRules.Commercial)]
    [InlineData("محل تجاري", null, PropertyCategoryRules.Commercial)]
    [InlineData("مستودع", null, PropertyCategoryRules.Industrial)]
    [InlineData("", "صناعي", PropertyCategoryRules.Industrial)]
    [InlineData("مبنى متعدد الاستخدامات", "تجاري سكني", null)]
    public void Categorizes_property_types(string type, string? usage, string? expected) =>
        Assert.Equal(expected, PropertyCategoryRules.Categorize(type, usage));

    // ─── BuildList: the R2a table end to end ───

    private static readonly Guid VrId = Guid.Parse("d4000001-0000-4000-8000-000000000001");

    private static ComparableProperty Comp(int n, string type, decimal area, decimal price, DateOnly date, string usage = "سكني") => new()
    {
        Id = Guid.Parse($"d4000000-0000-4000-8000-0000000000{n:00}"),
        ReferenceCode = $"CMP-R2A-{n}",
        ComparablePropertyType = type,
        Usage = usage,
        TransactionKind = ComparableTransactionKinds.Executed,
        Source = ComparableSources.Other,
        District = "الخالدية",
        AreaSqm = area,
        Price = price,
        PricePerSqm = Math.Round(price / area, 2),
        Latitude = 24.15m,
        Longitude = 47.31m,
        TransactionDate = date,
    };

    private static ValuationComparableSelection Row(ComparableProperty comp, int order, Dictionary<string, decimal> pct, string context = "market")
    {
        var id = Guid.NewGuid();
        var lines = MarketApproachRules.CreateStandardMarketLines(id).ToList();
        foreach (var (key, value) in pct)
        {
            var line = lines.FirstOrDefault(l => l.FactorKey == key);
            if (line is null)
            {
                line = new ValuationComparableAdjustmentLine
                {
                    Id = Guid.NewGuid(), SelectionId = id, FactorKey = key, LabelAr = key, IsIncluded = true, SortOrder = 50,
                };
                lines.Add(line);
            }

            line.Percent = value;
            line.IsIncluded = true;
        }

        return new ValuationComparableSelection
        {
            Id = id,
            ValuationRequestId = VrId,
            ComparablePropertyId = comp.Id,
            SelectionContext = context,
            SortOrder = order,
            IsAdopted = true,
            AdjustmentLines = lines,
        };
    }

    private static (List<ValuationComparableSelection> Rows, Dictionary<Guid, ComparableProperty> Comps) R2a(string context = "market")
    {
        var d = new DateOnly(2026, 8, 1);
        var comps = new[]
        {
            Comp(1, "أرض", 875m, 743_750m, d),
            Comp(2, "أرض", 1_000m, 800_000m, d),
            Comp(3, "أرض", 900m, 747_000m, d),
            Comp(4, "أرض", 950m, 1_567_500m, d),
            Comp(5, "أرض", 800m, 696_000m, d),
        };
        var rows = new List<ValuationComparableSelection>
        {
            Row(comps[0], 0, new() { ["market"] = 1m }, context),
            Row(comps[1], 1, new() { ["market"] = 1.5m, ["location"] = 5m }, context),
            Row(comps[2], 2, new() { ["attraction"] = -3m }, context),
            Row(comps[3], 3, new(), context),
            Row(comps[4], 4, new() { ["market"] = 1m, ["location"] = 30m, ["access"] = -30m }, context),
        };
        return (rows, comps.ToDictionary(c => c.Id));
    }

    private static ValuationRequest Request(string type = "أرض") =>
        ValuationRequest.Create(VrId, "VR-R2A", Guid.NewGuid(), "الخرج", type, "مقيم", "2026-10-25", DateTime.UtcNow);

    private static ValuationMarketApproach Header(string basis = MarketAdjustmentBasisKeys.PricePerSqm) => new()
    {
        Id = Guid.NewGuid(),
        ValuationRequestId = VrId,
        SubjectAreaSqm = 900m,
        AdjustmentBasis = basis,
    };

    [Fact]
    public void R2a_table_flags_the_offsetting_comparable_and_takes_the_outlier_out_of_the_weights()
    {
        var (rows, comps) = R2a();
        var list = ValuationComparableListBuilder.BuildList(
            Request(), rows, comps, new DateOnly(2026, 10, 25), Header(), "market", []);

        var after = list.Items.Select(i => i.Market!.PricePerSqmAfterDifference).ToList();
        Assert.Equal([857.30m, 857.15m, 805.10m, 1654.62m, 873.16m], after);
        Assert.Equal(
            [1.14m, 7.06m, 3m, 0.28m, 61.63m],
            list.Items.Select(i => i.Market!.GrossAdjustmentPct()).ToList());
        Assert.Equal(
            [false, false, false, false, true],
            list.Items.Select(i => i.Market!.ExceedsLargeAdjustmentThreshold).ToList());
        Assert.Equal(
            [60m, 15m, 25m, 0m, 0m],
            list.Items.Select(i => i.Market!.SuggestedWeightPct).ToList());
        Assert.True(list.WeightsSumTo100);
        // 857.30×0.60 + 857.15×0.15 + 805.10×0.25 = 844.23 → × 900 m²
        Assert.Equal(844.23m, list.WeightedPricePerSqm);
    }

    [Fact]
    public void Whole_property_basis_applies_no_area_adjustment()
    {
        var (rows, comps) = R2a();
        var list = ValuationComparableListBuilder.BuildList(
            Request(), rows, comps, new DateOnly(2026, 10, 25),
            Header(MarketAdjustmentBasisKeys.WholeProperty), "market", []);

        Assert.All(list.Items, i => Assert.Equal(0m, i.Market!.SuggestedAreaAdjustmentPct));
        Assert.All(list.Items, i => Assert.Equal(
            0m,
            i.Market!.AdjustmentLines.Single(l => l.FactorKey == MarketAdjustmentFactorKeys.Area).Percent));
        // comparable 1: 743,750 × 1.01 with no area line
        Assert.Equal(751_187.50m, list.Items[0].Market!.PricePerSqmAfterDifference);
    }

    [Fact]
    public void Land_table_inside_the_cost_approach_is_always_per_sqm()
    {
        var (rows, comps) = R2a("land_within_cost");
        var list = ValuationComparableListBuilder.BuildList(
            Request("فيلا"), rows, comps, new DateOnly(2026, 10, 25),
            Header(MarketAdjustmentBasisKeys.WholeProperty), "land_within_cost", []);

        Assert.Equal(MarketAdjustmentBasisKeys.PricePerSqm, list.AdjustmentBasis);
        Assert.Equal(857.30m, list.Items[0].Market!.PricePerSqmAfterDifference);
        Assert.Equal(-0.14m, list.Items[0].Market!.SuggestedAreaAdjustmentPct);
    }

    [Fact]
    public void Deal_age_follows_the_date_the_list_is_built_for()
    {
        var comp = Comp(1, "فيلا", 450m, 1_530_000m, new DateOnly(2025, 10, 5));
        var rows = new List<ValuationComparableSelection> { Row(comp, 0, new()) };
        var list = ValuationComparableListBuilder.BuildList(
            Request("فيلا"), rows, new Dictionary<Guid, ComparableProperty> { [comp.Id] = comp },
            new DateOnly(2026, 2, 25), Header(), "market", []);
        Assert.Equal(5, list.Items[0].Market!.DealAgeMonths);
    }

    // ─── Methodology alerts ───

    private static ValuationMethodologyAlertInput AlertInput(
        IReadOnlyList<ValuationMethodologyAlertComparableInput> comps,
        bool hasStructures = false,
        string? subjectType = null,
        DateOnly? cutoff = null,
        DateOnly? today = null,
        decimal? actualAge = null,
        decimal? economicAge = null,
        decimal? totalObsolescence = null,
        decimal functional = 0m,
        IReadOnlyList<ValuationMethodologyAlertResolution>? resolutions = null) =>
        new(
            HasStructuresToValue: hasStructures,
            CostApproachRelevant: hasStructures,
            CostLines: hasStructures
                ? [new ValuationMethodologyAlertCostLineInput("floor", "الدور الأرضي", 500m, 1600m, null, true, "ground_floor")]
                : [],
            AdoptedComparableCount: comps.Count,
            ComparableWeightsSumTo100: true,
            ReconciliationWeightsSumTo100: true,
            HasReconciliationSaved: false,
            LiquidationDiscountPct: 0m,
            LiquidationDiscountRationale: null,
            AdoptedComparables: comps,
            ActualAgeYears: actualAge,
            EconomicAgeYears: economicAge,
            ExtendedLifeYears: economicAge,
            TotalObsolescencePct: totalObsolescence,
            FunctionalObsolescencePct: functional,
            FunctionalObsolescenceRationale: functional > 0m ? "تصميم قديم" : null,
            Resolutions: resolutions,
            CostApproachEnabled: hasStructures,
            ComparableDateCutoff: cutoff,
            Today: today,
            SubjectPropertyType: subjectType);

    private static ValuationMethodologyAlertComparableInput AlertComp(
        string type,
        decimal rate,
        string reference,
        DateOnly? date = null,
        string? usage = null,
        bool exceeds = false,
        decimal net = 0m,
        decimal gross = 0m) =>
        new(type, exceeds, net, rate, date, usage, reference, gross);

    private static ValuationMethodologyAlertCheck Alert(IEnumerable<ValuationMethodologyAlertCheck> checks, int number) =>
        checks.Single(c => c.Number == number);

    [Fact]
    public void M17_fires_on_the_gross_breach_and_names_net_and_gross()
    {
        var checks = ValuationMethodologyAlertRules.Evaluate(AlertInput(
        [
            AlertComp("أرض", 857.30m, "CMP-1"),
            AlertComp("أرض", 873.16m, "CMP-5", exceeds: true, net: 0.37m, gross: 61.63m),
        ]));
        var m17 = Alert(checks, 17);
        Assert.True(m17.Triggered);
        Assert.Equal(ValuationMethodologyAlertSeverityKinds.RequireRationale, m17.SeverityKind);
        Assert.Contains("CMP-5", m17.DetailAr);
        Assert.Contains("الإجمالي 61.63٪", m17.DetailAr);
    }

    [Fact]
    public void M22_dispersion_fires_on_the_R2a_outlier_and_clears_with_a_rationale()
    {
        var comps = R2aAdjusted.Select((r, i) => AlertComp("أرض", r, $"CMP-R2A-{i + 1}")).ToList();
        var m22 = Alert(ValuationMethodologyAlertRules.Evaluate(AlertInput(comps)), 22);
        Assert.Equal("تشتّت المقارنات", m22.LabelAr);
        Assert.True(m22.Triggered);
        Assert.Equal(ValuationMethodologyAlertSeverityKinds.RequireRationale, m22.SeverityKind);
        Assert.True(m22.BlocksIssuance);
        Assert.Contains("CMP-R2A-4 ينحرف 93٪", m22.DetailAr);
        Assert.Contains("857", m22.DetailAr);

        var resolved = Alert(ValuationMethodologyAlertRules.Evaluate(AlertInput(
            comps,
            resolutions: [new(ValuationMethodologyAlertCodes.ComparableDispersion, "صفقة زاوية تجارية على طريق رئيسي — أُبقيت بوزن صفر للمرجعية")])), 22);
        Assert.False(resolved.BlocksIssuance);

        var clean = Alert(ValuationMethodologyAlertRules.Evaluate(AlertInput(
            comps.Where(c => c.ReferenceCode != "CMP-R2A-4").ToList())), 22);
        Assert.False(clean.Triggered);
    }

    [Fact]
    public void M23_hard_blocks_the_r5a_comparable_dated_after_the_retrospective_valuation_date()
    {
        var comps = new[]
        {
            AlertComp("فيلا", 3400m, "CMP-A", new DateOnly(2025, 10, 5)),
            AlertComp("فيلا", 3300m, "CMP-B", new DateOnly(2025, 12, 20)),
            AlertComp("فيلا", 3600m, "CMP-C", new DateOnly(2026, 6, 10)),
        };
        var m23 = Alert(ValuationMethodologyAlertRules.Evaluate(AlertInput(
            comps, cutoff: new DateOnly(2026, 2, 25), today: new DateOnly(2026, 10, 25))), 23);
        Assert.True(m23.Triggered);
        Assert.True(m23.IsHard);
        Assert.True(m23.BlocksIssuance);
        Assert.Contains("CMP-C بتاريخ 2026/06/10", m23.DetailAr);
        Assert.Contains("2026/02/25", m23.DetailAr);
        Assert.DoesNotContain("CMP-A", m23.DetailAr);

        // An issuance-date valuation (cutoff = today) is not evaluated.
        var issue = Alert(ValuationMethodologyAlertRules.Evaluate(AlertInput(
            comps, cutoff: new DateOnly(2026, 10, 25), today: new DateOnly(2026, 10, 25))), 23);
        Assert.False(issue.Evaluated);
        Assert.False(issue.BlocksIssuance);
    }

    [Fact]
    public void M24_flags_the_r8a_villa_and_land_comparables_of_a_showroom()
    {
        var comps = new[]
        {
            AlertComp("معرض", 11_000m, "CMP-S1", usage: "تجاري"),
            AlertComp("معرض", 10_400m, "CMP-S2", usage: "تجاري"),
            AlertComp("فيلا", 4_500m, "CMP-V", usage: "سكني"),
            AlertComp("أرض", 8_000m, "CMP-L", usage: "تجاري"),
        };
        var m24 = Alert(ValuationMethodologyAlertRules.Evaluate(AlertInput(
            comps, hasStructures: true, subjectType: "معرض")), 24);
        Assert.True(m24.Triggered);
        Assert.Equal(ValuationMethodologyAlertSeverityKinds.RequireRationale, m24.SeverityKind);
        Assert.Contains("«تجاري»", m24.DetailAr);
        Assert.Contains("CMP-V (فيلا — سكني مبني)", m24.DetailAr);
        Assert.Contains("CMP-L (أرض — أرض)", m24.DetailAr);
        Assert.DoesNotContain("CMP-S1", m24.DetailAr);

        // A villa compared with an apartment is the same category.
        var same = Alert(ValuationMethodologyAlertRules.Evaluate(AlertInput(
            [AlertComp("شقة", 4_500m, "CMP-1"), AlertComp("فيلا", 4_400m, "CMP-2")],
            hasStructures: true, subjectType: "فيلا")), 24);
        Assert.False(same.Triggered);

        // Vacant land keeps the hard m11 — m24 does not double it.
        var land = Alert(ValuationMethodologyAlertRules.Evaluate(AlertInput(
            [AlertComp("فيلا", 4_500m, "CMP-1")], subjectType: "أرض")), 24);
        Assert.False(land.Evaluated);
    }

    [Fact]
    public void M3_age_beyond_the_extended_life_needs_a_rationale_not_a_hard_block()
    {
        // R4a: built 1983 — actual 43 years on a 40-year economic life → physical 107.5٪.
        var input = AlertInput([], hasStructures: true, actualAge: 43m, economicAge: 40m, totalObsolescence: 107.5m);
        var checks = ValuationMethodologyAlertRules.Evaluate(input);
        var m3 = Alert(checks, 3);
        Assert.True(m3.Triggered);
        Assert.False(m3.IsHard);
        Assert.Equal(ValuationMethodologyAlertSeverityKinds.RequireRationale, m3.SeverityKind);
        Assert.False(Alert(checks, 4).Triggered); // physical depreciation alone is not m4
        Assert.True(Alert(checks, 25).Triggered);

        var resolved = ValuationMethodologyAlertRules.Evaluate(input with
        {
            MarketApproachRelevant = false,
            Resolutions =
            [
                new(ValuationMethodologyAlertCodes.EffectiveAgeExceedsLife, "المبنى قائم ومشغول — الإهلاك يُقصَر على 100٪"),
                new(ValuationMethodologyAlertCodes.DepreciationOver90, "عمارة 1983 بحالة متوسطة؛ القيمة في الأرض"),
            ],
        });
        Assert.False(ValuationMethodologyAlertRules.HasBlockingAlerts(resolved));
    }

    [Fact]
    public void M25_depreciation_above_90_pct_needs_a_rationale()
    {
        var at90 = Alert(ValuationMethodologyAlertRules.Evaluate(AlertInput(
            [], hasStructures: true, actualAge: 36m, economicAge: 40m, totalObsolescence: 90m)), 25);
        Assert.False(at90.Triggered);

        var over = Alert(ValuationMethodologyAlertRules.Evaluate(AlertInput(
            [], hasStructures: true, actualAge: 34m, economicAge: 40m, totalObsolescence: 95m, functional: 10m)), 25);
        Assert.True(over.Triggered);
        Assert.Equal(ValuationMethodologyAlertSeverityKinds.RequireRationale, over.SeverityKind);
        Assert.Contains("95٪", over.DetailAr);
    }

    [Fact]
    public void M4_stays_hard_for_typed_functional_plus_external_above_100()
    {
        var m4 = Alert(ValuationMethodologyAlertRules.Evaluate(AlertInput(
            [], hasStructures: true, actualAge: 10m, economicAge: 40m, totalObsolescence: 130m, functional: 105m)), 4);
        Assert.True(m4.Triggered);
        Assert.True(m4.IsHard);
    }

    [Fact]
    public void Severity_table_counts_8_hard_13_rationale_6_ack()
    {
        int[] numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 24, 25, 26, 27, 28];
        Assert.Equal(8, numbers.Count(ValuationMethodologyAlertSeverity.IsHard));
        Assert.Equal(13, numbers.Count(ValuationMethodologyAlertSeverity.RequiresRationale));
        Assert.Equal(6, numbers.Count(ValuationMethodologyAlertSeverity.RequiresAcknowledgement));
        var checks = ValuationMethodologyAlertRules.Evaluate(AlertInput([]));
        Assert.Equal(numbers, checks.Select(c => c.Number).ToArray());
    }

    // ─── D13: credential gate — this report's people only ───

    [Fact]
    public void Credential_gate_checks_the_report_participants_not_the_whole_roster()
    {
        OrganizationValuerRosterEntryDto V(string name, string role, string? staff = null, string? membership = "2027-06-30") => new()
        {
            Id = name, NameAr = name, Role = role, StaffUserId = staff, MembershipExpiresAt = membership, IsActive = true,
        };
        var roster = new[]
        {
            V("عماد رشيد صالح الرشيد", "certified"),
            V("عبدالله الكثيري", "valuer", staff: "u-abdullah"),
            V("سليمان عبد الله الصالحي", "reviewer"),
            V("أيمن أحمد مجرشي", "assistant"),
            V("محمد العساف", "valuer", membership: "2026-01-31"), // a colleague, expired
            V("مقيم آخر معتمد", "certified", membership: "2026-01-31"),
        };

        var people = ValuationIssuanceGateInputRules.ReportParticipants(
            roster, "عماد رشيد صالح الرشيد", "u-abdullah", null);
        Assert.Equal(
            ["عماد رشيد صالح الرشيد", "عبدالله الكثيري", "سليمان عبد الله الصالحي", "أيمن أحمد مجرشي"],
            people.Select(p => p.NameAr).ToArray());

        var gate = ValuationIssuanceGateRules.ParticipantCredentials(
            people.Select(p => new ValuationIssuanceGateRules.RosterParticipantCredentials(
                p.NameAr, "2027-03-10", p.MembershipExpiresAt)).ToList(),
            new DateOnly(2026, 10, 25));
        Assert.True(gate.Passed);

        // The assigned appraiser matched by name when the roster row has no staff account.
        var byName = ValuationIssuanceGateInputRules.ReportParticipants(
            roster, "عماد رشيد صالح الرشيد", null, "محمد العساف");
        Assert.Contains(byName, p => p.NameAr == "محمد العساف");
    }

    // ─── Selection service: PUT keeps saved work, duplicate factor → 400, import, D8 ───

    private sealed class FixedTime(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }

    private static ValuationComparableSelectionService Service(TestDatabases.ContextSet contexts) =>
        new(
            new ValuationComparableSelectionRepository(contexts.Valuation),
            new ValuationReportFreezeGate(contexts.Valuation),
            new StubOrganizationSettings(),
            new FixedTime(new DateTimeOffset(2026, 10, 25, 9, 0, 0, TimeSpan.Zero)));

    private static async Task<(ComparableProperty[] Comps, Guid PropertyId)> SeedAsync(
        TestDatabases.ContextSet contexts,
        string subjectType,
        params ComparableProperty[] comps)
    {
        var propertyId = Guid.NewGuid();
        contexts.Valuation.ValuationRequests.Add(ValuationRequest.Create(
            VrId, "VR-D4", propertyId, "الرياض", subjectType, "مقيم", "2026-10-25", DateTime.UtcNow));
        contexts.Valuation.ComparableProperties.AddRange(comps);
        await contexts.Valuation.SaveChangesAsync();
        return (comps, propertyId);
    }

    private static SaveValuationComparableMarketRequest MarketSave(
        ValuationComparableSelectionDto item,
        decimal location,
        decimal weight,
        params SaveValuationComparableAdjustmentLineRequest[] extra) =>
        new()
        {
            AdjustmentLines = item.Market!.AdjustmentLines
                .Select(l => new SaveValuationComparableAdjustmentLineRequest
                {
                    FactorKey = l.FactorKey,
                    LabelAr = l.LabelAr,
                    Percent = l.FactorKey == "location" ? location : l.Percent,
                    IsIncluded = l.IsIncluded,
                    SortOrder = l.SortOrder,
                })
                .Concat(extra)
                .ToList(),
            WeightIsManual = true,
            WeightPct = weight,
            WeightOverrideRationale = "أقرب المقارنات موقعاً ومساحة للعقار",
        };

    [Fact]
    public async Task Put_with_the_same_comparables_keeps_saved_adjustments_and_manual_weights()
    {
        await using var contexts = TestDatabases.Create("d-market-put-keeps");
        var d = new DateOnly(2026, 6, 1);
        var (comps, _) = await SeedAsync(contexts, "فيلا",
            Comp(1, "فيلا", 350m, 2_205_000m, d),
            Comp(2, "فيلا", 420m, 2_520_000m, d),
            Comp(3, "فيلا", 360m, 2_340_000m, d));
        var service = Service(contexts);
        var items = comps.Select((c, i) => new ValuationComparableSelectionItemRequest
        {
            ComparablePropertyId = c.Id, IsAdopted = true, SortOrder = i,
        }).ToList();

        var (first, errors) = await service.ReplaceAsync(
            VrId, new ReplaceValuationComparableSelectionsRequest { SelectionContext = "market", Items = items }, "u-1");
        Assert.Null(errors);

        // R1b: manual weights 40 / 25 / 35 with location adjustments.
        decimal[] weights = [40m, 25m, 35m];
        for (var i = 0; i < 3; i++)
        {
            var (_, saveErrors) = await service.SaveMarketAsync(
                VrId, first!.Items[i].Id, MarketSave(first.Items[i], -(i + 2), weights[i]));
            Assert.Null(saveErrors);
        }

        var before = (await service.ListAsync(VrId, "market"))!;
        var (after, putErrors) = await service.ReplaceAsync(
            VrId, new ReplaceValuationComparableSelectionsRequest { SelectionContext = "market", Items = items }, "u-1");
        Assert.Null(putErrors);

        Assert.Equal(
            before.Items.Select(i => i.Id).ToList(),
            after!.Items.Select(i => i.Id).ToList());
        Assert.Equal([40m, 25m, 35m], after.Items.Select(i => i.Market!.EffectiveWeightPct).ToList());
        Assert.Equal(
            [-2m, -3m, -4m],
            after.Items.Select(i => i.Market!.AdjustmentLines.Single(l => l.FactorKey == "location").Percent).ToList());
        Assert.Equal(before.MarketOpinionValue, after.MarketOpinionValue);

        // Dropping one comparable removes only that one.
        var (dropped, _) = await service.ReplaceAsync(
            VrId,
            new ReplaceValuationComparableSelectionsRequest { SelectionContext = "market", Items = items.Take(2).ToList() },
            "u-1");
        Assert.Equal(2, dropped!.Items.Count);
        Assert.Equal([40m, 25m], dropped.Items.Select(i => i.Market!.EffectiveWeightPct).ToList());
    }

    [Fact]
    public async Task Same_factor_twice_on_one_comparable_is_refused()
    {
        await using var contexts = TestDatabases.Create("d-market-dup-factor");
        var (comps, _) = await SeedAsync(contexts, "فيلا", Comp(1, "فيلا", 350m, 2_205_000m, new DateOnly(2026, 6, 1)));
        var service = Service(contexts);
        var (list, _) = await service.ReplaceAsync(
            VrId,
            new ReplaceValuationComparableSelectionsRequest
            {
                SelectionContext = "market",
                Items = [new() { ComparablePropertyId = comps[0].Id, IsAdopted = true }],
            },
            "u-1");
        var item = list!.Items[0];
        var save = MarketSave(item, 3m, 100m, new SaveValuationComparableAdjustmentLineRequest
        {
            FactorKey = "location", LabelAr = "الموقع", Percent = 3m, IsIncluded = true, SortOrder = 99,
        });

        var (result, errors) = await service.SaveMarketAsync(VrId, item.Id, save);
        Assert.Null(result);
        Assert.NotNull(errors);
        Assert.Contains(errors!, e => e.Value.Contains("مكرر", StringComparison.Ordinal));

        var reloaded = (await service.ListAsync(VrId, "market"))!;
        Assert.Single(reloaded.Items[0].Market!.AdjustmentLines, l => l.FactorKey == "location");
    }

    [Fact]
    public async Task Retrospective_valuation_measures_deal_age_to_the_valuation_date()
    {
        await using var contexts = TestDatabases.Create("d-market-retro-age");
        var (comps, _) = await SeedAsync(contexts, "فيلا",
            Comp(1, "فيلا", 450m, 1_530_000m, new DateOnly(2025, 10, 5)),
            Comp(2, "فيلا", 420m, 1_512_000m, new DateOnly(2026, 6, 10)));
        contexts.Valuation.ValuationApproachSettings.Add(new ValuationApproachSettings
        {
            Id = Guid.NewGuid(),
            ValuationRequestId = VrId,
            ValuationDateMode = ValuationDateModes.Retrospective,
            RetrospectiveDate = new DateOnly(2026, 2, 25),
        });
        await contexts.Valuation.SaveChangesAsync();
        var service = Service(contexts);
        var (list, _) = await service.ReplaceAsync(
            VrId,
            new ReplaceValuationComparableSelectionsRequest
            {
                SelectionContext = "market",
                Items = comps.Select(c => new ValuationComparableSelectionItemRequest { ComparablePropertyId = c.Id, IsAdopted = true }).ToList(),
            },
            "u-1");

        Assert.Equal([5, 0], list!.Items.Select(i => i.Market!.DealAgeMonths).ToList());
    }

    [Fact]
    public async Task A_linked_land_comparable_goes_to_the_land_table_of_a_built_subject()
    {
        await using var contexts = TestDatabases.Create("d-market-land-import");
        var d = new DateOnly(2026, 8, 1);
        var (comps, propertyId) = await SeedAsync(contexts, "شقة",
            Comp(1, "شقة", 165m, 760_000m, d),
            Comp(2, "أرض", 600m, 1_500_000m, d));
        foreach (var c in comps)
        {
            contexts.Valuation.PropertyComparableLinks.Add(new PropertyComparableLink
            {
                Id = Guid.NewGuid(), PropertyId = propertyId, ComparablePropertyId = c.Id, LinkedAtUtc = DateTime.UtcNow,
            });
        }

        await contexts.Valuation.SaveChangesAsync();
        var service = Service(contexts);

        var market = (await service.ListAsync(VrId, "market"))!;
        Assert.Equal([comps[0].Id], market.Items.Select(i => i.ComparablePropertyId).ToList());
        var land = (await service.ListAsync(VrId, "land_within_cost"))!;
        Assert.Equal([comps[1].Id], land.Items.Select(i => i.ComparablePropertyId).ToList());

        // A second read does not add it again.
        await service.ListAsync(VrId, "market");
        Assert.Single((await service.ListAsync(VrId, "land_within_cost"))!.Items);
    }

    private sealed class StubOrganizationSettings : IOrganizationSettingsService
    {
        public Task<OrganizationSettingsDto> GetAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult(new OrganizationSettingsDto());

        public Task<OrganizationSettingsDto> GetInternalAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult(new OrganizationSettingsDto());

        public Task<OrganizationSettingsDto> SaveAsync(
            SaveOrganizationSettingsRequest request,
            string actorId,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(new OrganizationSettingsDto());

        public Task<OrganizationSettingsDto> SyncStaffValuerAsync(
            SyncStaffValuerRequest request,
            string actorId,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(new OrganizationSettingsDto());
    }
}

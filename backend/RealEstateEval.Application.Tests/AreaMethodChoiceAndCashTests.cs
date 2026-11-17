using RealEstateEval.Domain;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Application.Rules;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// The appraiser picks each area line's method (Omar 2026-11-16, Taqeem curriculum 105 p. 53: the
/// method follows the appraiser's research, not a ratio ≥ 2 rule), and on the whole-property basis an
/// area line can be a cash amount — the area difference × a rate per m², added after the percent
/// chain (curriculum examples 16–17).
/// </summary>
public class AreaMethodChoiceAndCashTests
{
    private static readonly Guid VrId = Guid.Parse("e6000000-0000-4000-8000-000000000001");
    private static readonly DateOnly Date = new(2026, 11, 1);

    // ─── Choosing the method ───

    [Fact]
    public void The_appraisers_pick_wins_over_the_automatic_choice()
    {
        // Every ratio under 2 → the automatic choice is الأمثال.
        Assert.Equal("amthal", AreaAdjustmentRules.ResolveMethod(null, false, 900m, [800m, 1_000m]));
        Assert.Equal("multiplier", AreaAdjustmentRules.ResolveMethod("multiplier", false, 900m, [800m, 1_000m]));
        // A ratio of 4.5 → automatic المضاعف; the appraiser may still pick الأمثال.
        Assert.Equal("amthal", AreaAdjustmentRules.ResolveMethod("amthal", false, 900m, [200m]));
    }

    [Fact]
    public void A_cash_pick_counts_only_where_a_cash_amount_can_apply()
    {
        Assert.Equal("cash", AreaAdjustmentRules.ResolveMethod("cash", true, 900m, [800m]));
        // Per m² (cash not allowed) → back to the automatic choice.
        Assert.Equal("amthal", AreaAdjustmentRules.ResolveMethod("cash", false, 900m, [800m]));
    }

    [Fact]
    public void Curriculum_example_15_is_reproduced_when_the_appraiser_picks_the_multiplier()
    {
        // Subject 15,867 m²; comparables 19,930 / 7,956 / 30,556 m²; 5٪ per multiplier → 0 / −5 / +5.
        var (rows, comps) = Lands(19_930m, 7_956m, 30_556m);
        var header = LandHeader(15_867m);
        header.AreaAdjustmentMethod = AreaAdjustmentMethods.Multiplier;

        var list = ValuationComparableListBuilder.BuildList(
            Request("أرض"), rows, comps, Date, header, "market", [], subjectIsBuilt: false);

        Assert.Equal([0m, -5m, 5m], list.Items.Select(i => i.Market!.SuggestedAreaAdjustmentPct));
        Assert.Equal("multiplier", list.AreaAdjustmentMethodChoice);
        Assert.False(list.CashAreaAdjustmentAllowed);
    }

    [Fact]
    public void Without_a_pick_the_table_keeps_its_automatic_choice_and_old_figures()
    {
        var (rows, comps) = Lands(19_930m, 7_956m, 30_556m);
        var list = ValuationComparableListBuilder.BuildList(
            Request("أرض"), rows, comps, Date, LandHeader(15_867m), "market", [], subjectIsBuilt: false);

        // All ratios under 2 → الأمثال: +1.28 / −4.97 / +4.63.
        Assert.Equal([1.28m, -4.97m, 4.63m], list.Items.Select(i => i.Market!.SuggestedAreaAdjustmentPct));
        Assert.Equal("", list.AreaAdjustmentMethodChoice);
    }

    // ─── The cash amount ───

    [Fact]
    public void Curriculum_example_16_the_land_difference_is_added_in_riyals_after_the_percents()
    {
        // 2,500,000 + 10٪ (location) + (800 − 700) × 2,000 = 2,950,000. The buildings are equal.
        var (rows, comps) = Villas((price: 2_500_000m, building: 400m, land: 700m));
        SetPercent(rows[0], MarketAdjustmentFactorKeys.Location, 10m);
        var header = VillaHeader(building: 400m, land: 800m);
        header.LandAreaAdjustmentMethod = AreaAdjustmentMethods.Cash;
        header.LandAreaCashRateSar = 2_000m;

        var item = Build(rows, comps, header).Items[0].Market!;

        Assert.Equal(2_950_000m, item.PricePerSqmAfterDifference);
        Assert.Equal(200_000m, item.SuggestedLandAreaAdjustmentSar);
        Assert.Equal(200_000m, item.SumCashAdjustmentSar);
        Assert.Equal(10m, item.SumDifferencePct);
        var landLine = item.AdjustmentLines.Single(l => l.FactorKey == MarketAdjustmentFactorKeys.LandArea);
        Assert.Equal(200_000m, landLine.AmountSar);
        Assert.Equal(8m, landLine.Percent); // 200,000 ÷ 2,500,000
    }

    [Fact]
    public void Both_lines_in_cash_count_in_the_gross_adjustment_as_a_share_of_the_price()
    {
        // Subject: building 250 m² on 700 m²; comparable 600,000 for 200 m² on 600 m²; 750 ر.س/م² each.
        var (rows, comps) = Villas((price: 600_000m, building: 200m, land: 600m));
        SetPercent(rows[0], MarketAdjustmentFactorKeys.Location, 5m);
        var header = VillaHeader(building: 250m, land: 700m);
        header.AreaAdjustmentMethod = AreaAdjustmentMethods.Cash;
        header.AreaCashRateSar = 750m;
        header.LandAreaAdjustmentMethod = AreaAdjustmentMethods.Cash;
        header.LandAreaCashRateSar = 750m;

        var list = Build(rows, comps, header);
        var market = list.Items[0].Market!;

        // 600,000 × 1.05 + 37,500 + 75,000.
        Assert.Equal(742_500m, market.PricePerSqmAfterDifference);
        Assert.Equal(37_500m, market.SuggestedAreaAdjustmentSar);
        Assert.Equal(75_000m, market.SuggestedLandAreaAdjustmentSar);
        Assert.Equal(6.25m, market.SuggestedAreaAdjustmentPct);
        Assert.Equal(12.5m, market.SuggestedLandAreaAdjustmentPct);
        // 5 + 6.25 + 12.5.
        Assert.Equal(23.75m, market.GrossAdjustmentPct());
        Assert.True(list.CashAreaAdjustmentAllowed);
        Assert.Equal(750m, list.AreaCashRateSar);
    }

    [Fact]
    public void A_larger_comparable_is_lowered_by_the_amount()
    {
        var (rows, comps) = Villas((price: 700_000m, building: 280m, land: 750m));
        var header = VillaHeader(building: 250m, land: 700m);
        header.LandAreaAdjustmentMethod = AreaAdjustmentMethods.Cash;
        header.LandAreaCashRateSar = 750m;

        var market = Build(rows, comps, header).Items[0].Market!;

        Assert.Equal(-37_500m, market.SuggestedLandAreaAdjustmentSar);
    }

    [Fact]
    public void A_cash_line_without_a_rate_gives_nothing_until_one_is_entered()
    {
        var (rows, comps) = Villas((price: 600_000m, building: 250m, land: 600m));
        var header = VillaHeader(building: 250m, land: 700m);
        header.LandAreaAdjustmentMethod = AreaAdjustmentMethods.Cash;

        var market = Build(rows, comps, header).Items[0].Market!;

        Assert.Equal(0m, market.SuggestedLandAreaAdjustmentSar);
        Assert.Equal(600_000m, market.PricePerSqmAfterDifference);
    }

    [Fact]
    public void A_cash_line_the_appraiser_leaves_out_is_not_added()
    {
        var (rows, comps) = Villas((price: 600_000m, building: 250m, land: 600m));
        rows[0].AdjustmentLines.Add(new ValuationComparableAdjustmentLine
        {
            Id = Guid.NewGuid(),
            SelectionId = rows[0].Id,
            FactorKey = MarketAdjustmentFactorKeys.LandArea,
            LabelAr = MarketAdjustmentFactorKeys.DefaultLabelAr(MarketAdjustmentFactorKeys.LandArea),
            IsIncluded = false,
            SortOrder = 11,
        });
        var header = VillaHeader(building: 250m, land: 700m);
        header.LandAreaAdjustmentMethod = AreaAdjustmentMethods.Cash;
        header.LandAreaCashRateSar = 750m;

        var market = Build(rows, comps, header).Items[0].Market!;

        Assert.Equal(0m, market.SumCashAdjustmentSar);
        Assert.Equal(600_000m, market.PricePerSqmAfterDifference);
        // The line still says what it would have been.
        Assert.Equal(75_000m, market.SuggestedLandAreaAdjustmentSar);
    }

    [Fact]
    public void On_the_per_metre_basis_a_cash_pick_falls_back_to_a_percent()
    {
        var (rows, comps) = Villas((price: 600_000m, building: 200m, land: 600m));
        var header = VillaHeader(building: 250m, land: 700m, basis: MarketAdjustmentBasisKeys.PricePerSqm);
        header.LandAreaAdjustmentMethod = AreaAdjustmentMethods.Cash;
        header.LandAreaCashRateSar = 750m;

        var list = Build(rows, comps, header);
        var market = list.Items[0].Market!;

        Assert.False(list.CashAreaAdjustmentAllowed);
        Assert.NotEqual("cash", market.LandAreaAdjustmentMethod);
        Assert.Equal(0m, market.SumCashAdjustmentSar);
        // The pick stays stored, so it returns with the whole-property basis.
        Assert.Equal("cash", list.LandAreaAdjustmentMethodChoice);
    }

    // ─── Saving the header ───

    [Fact]
    public void A_method_is_stored_auto_clears_it_and_not_sending_keeps_it()
    {
        var header = VillaHeader(building: 250m, land: 700m);
        ValuationComparableSelectionRequestRules.ApplyMarketApproach(header, new()
        {
            SubjectAreaSqm = 250m,
            AreaAdjustmentMethod = " AMTHAL ",
            LandAreaAdjustmentMethod = "cash",
            LandAreaCashRateSar = 750m,
        });
        Assert.Equal("amthal", header.AreaAdjustmentMethod);
        Assert.Equal("cash", header.LandAreaAdjustmentMethod);
        Assert.Equal(750m, header.LandAreaCashRateSar);

        ValuationComparableSelectionRequestRules.ApplyMarketApproach(header, new() { SubjectAreaSqm = 250m });
        Assert.Equal("amthal", header.AreaAdjustmentMethod);
        Assert.Equal(750m, header.LandAreaCashRateSar);

        ValuationComparableSelectionRequestRules.ApplyMarketApproach(header, new()
        {
            SubjectAreaSqm = 250m,
            AreaAdjustmentMethod = "auto",
            LandAreaCashRateSar = 0m,
        });
        Assert.Null(header.AreaAdjustmentMethod);
        Assert.Null(header.LandAreaCashRateSar);
    }

    [Fact]
    public void An_unknown_method_or_a_negative_rate_is_refused_in_arabic()
    {
        var errors = ValuationComparableSelectionRequestRules.ValidateMarketApproach(new()
        {
            SubjectAreaSqm = 250m,
            AreaAdjustmentMethod = "cubic",
            LandAreaCashRateSar = -1m,
        });
        Assert.NotNull(errors);
        Assert.Equal("طريقة قياس تسوية المساحة غير معروفة", errors!["areaAdjustmentMethod"]);
        Assert.Contains("landAreaCashRateSar", errors.Keys);
        Assert.Null(ValuationComparableSelectionRequestRules.ValidateMarketApproach(new()
        {
            SubjectAreaSqm = 250m,
            AreaAdjustmentMethod = "auto",
            LandAreaAdjustmentMethod = "cash",
            LandAreaCashRateSar = 750m,
        }));
    }

    // ─── Helpers ───

    private static ValuationComparableSelectionListDto Build(
        List<ValuationComparableSelection> rows,
        Dictionary<Guid, ComparableProperty> comps,
        ValuationMarketApproach header) =>
        ValuationComparableListBuilder.BuildList(
            Request(), rows, comps, Date, header, "market", [], subjectIsBuilt: true);

    private static (List<ValuationComparableSelection>, Dictionary<Guid, ComparableProperty>) Villas(
        params (decimal price, decimal building, decimal land)[] deals)
    {
        var comps = deals
            .Select((d, i) => Comparable(i + 1, "فيلا", d.building, d.land, d.price))
            .ToArray();
        return (comps.Select(Row).ToList(), comps.ToDictionary(c => c.Id));
    }

    private static (List<ValuationComparableSelection>, Dictionary<Guid, ComparableProperty>) Lands(
        params decimal[] areas)
    {
        var comps = areas
            .Select((a, i) => Comparable(i + 1, "أرض", a, null, a * 400m))
            .ToArray();
        return (comps.Select(Row).ToList(), comps.ToDictionary(c => c.Id));
    }

    private static ComparableProperty Comparable(int n, string type, decimal area, decimal? land, decimal price) => new()
    {
        Id = Guid.Parse($"e6000000-0000-4000-8000-0000000001{n:00}"),
        ReferenceCode = $"CMP-CA-{n}",
        ComparablePropertyType = type,
        Usage = "سكني",
        TransactionKind = ComparableTransactionKinds.Executed,
        Source = ComparableSources.Other,
        District = "الملقا",
        AreaSqm = area,
        LandAreaSqm = land,
        Price = price,
        PricePerSqm = Math.Round(price / area, 2),
        Latitude = 24.8m,
        Longitude = 46.6m,
        TransactionDate = Date,
    };

    private static ValuationComparableSelection Row(ComparableProperty comp, int order)
    {
        var id = Guid.NewGuid();
        return new ValuationComparableSelection
        {
            Id = id,
            ValuationRequestId = VrId,
            ComparablePropertyId = comp.Id,
            SelectionContext = "market",
            SortOrder = order,
            IsAdopted = true,
            AdjustmentLines = MarketApproachRules.CreateStandardMarketLines(id).ToList(),
        };
    }

    private static void SetPercent(ValuationComparableSelection row, string key, decimal percent)
    {
        var line = row.AdjustmentLines.Single(l => l.FactorKey == key);
        line.Percent = percent;
        line.IsIncluded = true;
    }

    private static ValuationRequest Request(string type = "فيلا") =>
        ValuationRequest.Create(VrId, "VR-CA", Guid.NewGuid(), "الرياض", type, "مقيم", "2026-11-16", DateTime.UtcNow);

    private static ValuationMarketApproach VillaHeader(
        decimal building,
        decimal land,
        string basis = MarketAdjustmentBasisKeys.WholeProperty) => new()
    {
        Id = Guid.NewGuid(),
        ValuationRequestId = VrId,
        SubjectAreaSqm = building,
        AdjustmentBasis = basis,
        AreaFactorPct = 5m,
        TwoAreaAdjustments = true,
        SubjectLandAreaSqm = land,
        LandAreaFactorPct = 5m,
    };

    private static ValuationMarketApproach LandHeader(decimal area) => new()
    {
        Id = Guid.NewGuid(),
        ValuationRequestId = VrId,
        SubjectAreaSqm = area,
        AdjustmentBasis = MarketAdjustmentBasisKeys.PricePerSqm,
        AreaFactorPct = 5m,
    };
}

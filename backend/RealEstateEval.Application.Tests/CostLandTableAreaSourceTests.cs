using RealEstateEval.Domain;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Application.Rules;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// (round 2): the land table inside the cost approach compares each land comparable with
/// the whole building plot saved on the cost approach — never the market header, whose subject area the
/// screen's subject-area sync rewrites with the apartment's own area — and the apartment's land share
/// only multiplies the adjusted rate into the land value.
/// </summary>
public class CostLandTableAreaSourceTests
{
    private static readonly Guid VrId = Guid.Parse("d5000001-0000-4000-8000-000000000001");
    private static readonly DateOnly ValuationDate = new(2026, 10, 26);

    [Fact]
    public void The_plot_is_the_area_base_and_the_share_the_value_multiplier()
    {
        // Saved plot wins over whatever the market header holds.
        Assert.Equal(900m, CostApproachRules.LandTableSubjectAreaSqm(900m, 60m, 180m));
        // An apartment (share set) without a plot has no land area — the unit's 180 m² is not land.
        Assert.Null(CostApproachRules.LandTableSubjectAreaSqm(null, 60m, 180m));
        Assert.Null(CostApproachRules.LandTableSubjectAreaSqm(0m, 60m, 180m));
        // A property with its own land keeps the header (deed) area until a plot is saved.
        Assert.Equal(450m, CostApproachRules.LandTableSubjectAreaSqm(null, null, 450m));

        Assert.Equal(60m, CostApproachRules.LandTableValueAreaSqm(900m, 60m));
        Assert.Equal(900m, CostApproachRules.LandTableValueAreaSqm(900m, null));
        Assert.Null(CostApproachRules.LandTableValueAreaSqm(null, 60m));
    }

    [Fact]
    public void Vr542_land_is_adjusted_against_the_900_m2_plot_and_valued_on_the_60_m2_share()
    {
        // VR-542 (RT2-KAPT): apartment 180 m² (the market header after the subject-area sync), building plot
        // 900 m², share 60 m². L1 900 m² for 3,150,000 (2026-07-01), L2 750 m² for 2,700,000 (2026-05-10).
        var list = Vr542List(header: 180m, new CostLandAreas(900m, 60m));

        Assert.Equal(900m, list.SubjectAreaSqm);
        Assert.Equal(60m, list.ApartmentLandShareSqm);
        Assert.Equal([0m, -1m], list.Items.Select(i => i.Market!.SuggestedAreaAdjustmentPct));
        Assert.Equal(3_561.58m, list.WeightedPricePerSqm);
        // The table's land value is the rate × the share — the 3,205,422 (rate × plot) is gone.
        Assert.Equal(213_694.80m, list.MarketOpinionValueRaw);
        Assert.Equal(213_694.80m, CostApproachRules.LandValue(list.WeightedPricePerSqm, 900m, 60m));
    }

    [Fact]
    public void The_subject_area_sync_on_the_market_header_never_moves_the_land_table()
    {
        // Round-2 re-test: the screen PUT the apartment's 180 m² onto the header and the rate drifted
        // 3,561.58 → 3,951. With the plot saved on the cost approach the header no longer matters.
        var before = Vr542List(header: 900m, new CostLandAreas(900m, 60m));
        var afterSync = Vr542List(header: 180m, new CostLandAreas(900m, 60m));

        Assert.Equal(before.WeightedPricePerSqm, afterSync.WeightedPricePerSqm);
        Assert.Equal(before.MarketOpinionValueRaw, afterSync.MarketOpinionValueRaw);
        Assert.Equal(
            before.Items.Select(i => i.Market!.SuggestedAreaAdjustmentPct),
            afterSync.Items.Select(i => i.Market!.SuggestedAreaAdjustmentPct));
    }

    [Fact]
    public void An_apartment_without_a_plot_gets_no_area_base_and_no_land_value()
    {
        var list = Vr542List(header: 180m, new CostLandAreas(null, 60m));

        Assert.Null(list.SubjectAreaSqm);
        Assert.All(list.Items, i => Assert.Equal(0m, i.Market!.SuggestedAreaAdjustmentPct));
        Assert.Equal(0m, list.MarketOpinionValueRaw);
    }

    [Fact]
    public void The_market_table_keeps_the_header_area_and_ignores_the_cost_land()
    {
        var comp = Comp(Guid.NewGuid(), 900m, 900_000m, new DateOnly(2026, 8, 1));
        var comps = new Dictionary<Guid, ComparableProperty> { [comp.Id] = comp };

        var market = ValuationComparableListBuilder.BuildList(
            Request(), [Row(comp, ComparableSelectionContexts.Market)], comps, ValuationDate,
            Header(150m), ComparableSelectionContexts.Market, [], costLand: new CostLandAreas(900m, 60m));

        Assert.Equal(150m, market.SubjectAreaSqm);
        Assert.Null(market.ApartmentLandShareSqm);
        Assert.NotEqual(0m, market.Items[0].Market!.SuggestedAreaAdjustmentPct);
    }

    private static ValuationComparableSelectionListDto Vr542List(decimal header, CostLandAreas costLand)
    {
        var l1 = Comp(Guid.Parse("d5000000-0000-4000-8000-000000000011"), 900m, 3_150_000m, new DateOnly(2026, 7, 1));
        var l2 = Comp(Guid.Parse("d5000000-0000-4000-8000-000000000012"), 750m, 2_700_000m, new DateOnly(2026, 5, 10));
        var comps = new Dictionary<Guid, ComparableProperty> { [l1.Id] = l1, [l2.Id] = l2 };
        var head = Header(header);
        head.AnnualMarketRatePct = 3m;
        return ValuationComparableListBuilder.BuildList(
            Request(),
            // As in the journey: the time adjustments the screen suggested (3٪ a year) and weights 65/35.
            [
                Row(l1, ComparableSelectionContexts.LandWithinCost, 0, marketPct: 0.96m, weightPct: 65m),
                Row(l2, ComparableSelectionContexts.LandWithinCost, 1, marketPct: 1.39m, weightPct: 35m),
            ],
            comps,
            ValuationDate,
            head,
            ComparableSelectionContexts.LandWithinCost,
            [],
            costLand: costLand);
    }

    private static ComparableProperty Comp(Guid id, decimal area, decimal price, DateOnly date) => new()
    {
        Id = id,
        ReferenceCode = $"CMP-{id.ToString("N")[..8]}",
        ComparablePropertyType = "أرض",
        Usage = "سكني",
        TransactionKind = ComparableTransactionKinds.Executed,
        Source = ComparableSources.Other,
        District = "الصحافة",
        AreaSqm = area,
        Price = price,
        PricePerSqm = Math.Round(price / area, 2),
        Latitude = 24.80m,
        Longitude = 46.63m,
        TransactionDate = date,
    };

    private static ValuationComparableSelection Row(
        ComparableProperty comp,
        string context,
        int sortOrder = 0,
        decimal marketPct = 0m,
        decimal? weightPct = null)
    {
        var id = Guid.NewGuid();
        var lines = MarketApproachRules.CreateStandardMarketLines(id).ToList();
        foreach (var line in lines.Where(l => l.FactorKey == MarketAdjustmentFactorKeys.Market))
            line.Percent = marketPct;
        return new ValuationComparableSelection
        {
            Id = id,
            ValuationRequestId = VrId,
            ComparablePropertyId = comp.Id,
            SelectionContext = context,
            SortOrder = sortOrder,
            IsAdopted = true,
            WeightPct = weightPct,
            WeightIsManual = weightPct is not null,
            AdjustmentLines = lines,
        };
    }

    private static ValuationRequest Request() =>
        ValuationRequest.Create(VrId, "VR-542", Guid.NewGuid(), "الرياض", "شقة", "مقيم", "2026-10-26", DateTime.UtcNow);

    private static ValuationMarketApproach Header(decimal subjectArea) => new()
    {
        Id = Guid.NewGuid(),
        ValuationRequestId = VrId,
        SubjectAreaSqm = subjectArea,
        AdjustmentBasis = MarketAdjustmentBasisKeys.PricePerSqm,
    };
}

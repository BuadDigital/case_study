using RealEstateEval.Domain;
using RealEstateEval.Valuation.Application.Rules;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// Round 2, item 7: a comparable hard alert 23 blocks (dealt after the valuation date) gets automatic
/// weight 0, like an outlier — the remaining comparables share the 100٪.
/// </summary>
public class ComparableAfterValuationDateWeightTests
{
    private static readonly Guid VrId = Guid.Parse("d7000001-0000-4000-8000-000000000001");

    [Fact]
    public void A_blocked_comparable_gets_no_automatic_weight()
    {
        var plain = MarketApproachRules.SuggestWeights([0m, 0m, 0m], [1000m, 1000m, 1000m]);
        var blocked = MarketApproachRules.SuggestWeights([0m, 0m, 0m], [1000m, 1000m, 1000m], [false, true, false]);

        Assert.Equal(100m, plain.Sum());
        Assert.Equal(0m, blocked[1]);
        Assert.Equal(100m, blocked.Sum());
        Assert.Equal(blocked[0], blocked[2]);

        // One usable comparable carries everything; when all are blocked nothing is suggested.
        Assert.Equal([100m, 0m], MarketApproachRules.SuggestWeights([5m, 0m], [1000m, 1000m], [false, true]));
        Assert.Equal([0m, 0m], MarketApproachRules.SuggestWeights([5m, 0m], [1000m, 1000m], [true, true]));
        // Without a blocked list the weights are exactly what they were.
        Assert.Equal(plain, MarketApproachRules.SuggestWeights([0m, 0m, 0m], [1000m, 1000m, 1000m], null));
    }

    [Fact]
    public void The_hard_cutoff_exists_only_for_a_valuation_date_before_today()
    {
        var today = new DateOnly(2026, 10, 26);
        Assert.Equal(new DateOnly(2026, 6, 30), MarketApproachRules.HardComparableDateCutoff(
            ValuationDateModes.Retrospective, new DateOnly(2026, 6, 1), new DateOnly(2026, 6, 30), today));
        Assert.Null(MarketApproachRules.HardComparableDateCutoff(ValuationDateModes.Issue, null, null, today));
        Assert.Null(MarketApproachRules.HardComparableDateCutoff(
            ValuationDateModes.Retrospective, today, null, today));
    }

    [Fact]
    public void The_market_list_gives_a_comparable_dealt_after_the_cutoff_weight_zero()
    {
        var before = Comp("d7000000-0000-4000-8000-000000000001", new DateOnly(2026, 5, 1));
        var before2 = Comp("d7000000-0000-4000-8000-000000000002", new DateOnly(2026, 5, 20));
        var after = Comp("d7000000-0000-4000-8000-000000000003", new DateOnly(2026, 8, 1));
        var comps = new[] { before, before2, after }.ToDictionary(c => c.Id);
        var rows = comps.Values.Select(c => Row(c, ComparableSelectionContexts.Market)).ToList();

        var list = ValuationComparableListBuilder.BuildList(
            Request(), rows, comps, new DateOnly(2026, 6, 1), Header(), ComparableSelectionContexts.Market, [],
            hardComparableDateCutoff: new DateOnly(2026, 6, 30));

        var byComp = list.Items.ToDictionary(i => i.ComparablePropertyId);
        Assert.Equal(0m, byComp[after.Id].Market!.EffectiveWeightPct);
        Assert.Equal(100m, byComp[before.Id].Market!.EffectiveWeightPct + byComp[before2.Id].Market!.EffectiveWeightPct);

        // The land table inside the cost approach is not alert 23's: its weights are unchanged.
        var landRows = comps.Values.Select(c => Row(c, ComparableSelectionContexts.LandWithinCost)).ToList();
        var land = ValuationComparableListBuilder.BuildList(
            Request(), landRows, comps, new DateOnly(2026, 6, 1), Header(), ComparableSelectionContexts.LandWithinCost, [],
            hardComparableDateCutoff: new DateOnly(2026, 6, 30));
        Assert.NotEqual(0m, land.Items.Single(i => i.ComparablePropertyId == after.Id).Market!.EffectiveWeightPct);
    }

    private static ComparableProperty Comp(string id, DateOnly date) => new()
    {
        Id = Guid.Parse(id),
        ReferenceCode = "CMP-" + id[^4..],
        ComparablePropertyType = "أرض",
        Usage = "سكني",
        TransactionKind = ComparableTransactionKinds.Executed,
        Source = ComparableSources.Other,
        District = "الخالدية",
        AreaSqm = 500m,
        Price = 500_000m,
        PricePerSqm = 1000m,
        Latitude = 24.15m,
        Longitude = 47.31m,
        TransactionDate = date,
    };

    private static ValuationComparableSelection Row(ComparableProperty comp, string context)
    {
        var id = Guid.NewGuid();
        return new ValuationComparableSelection
        {
            Id = id,
            ValuationRequestId = VrId,
            ComparablePropertyId = comp.Id,
            SelectionContext = context,
            SortOrder = 0,
            IsAdopted = true,
            AdjustmentLines = MarketApproachRules.CreateStandardMarketLines(id).ToList(),
        };
    }

    private static ValuationRequest Request() =>
        ValuationRequest.Create(VrId, "VR-M23", Guid.NewGuid(), "الرياض", "أرض", "مقيم", "2026-10-25", DateTime.UtcNow);

    private static ValuationMarketApproach Header() => new()
    {
        Id = Guid.NewGuid(),
        ValuationRequestId = VrId,
        SubjectAreaSqm = 500m,
        AdjustmentBasis = MarketAdjustmentBasisKeys.PricePerSqm,
    };
}

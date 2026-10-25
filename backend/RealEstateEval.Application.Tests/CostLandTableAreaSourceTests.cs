using RealEstateEval.Domain;
using RealEstateEval.Valuation.Application.Rules;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// The land table inside the cost approach compares each land comparable with the land the cost
/// approach values (the apartment's land share when saved) — not with the market header's subject
/// area, which for an apartment is its floor area.
/// </summary>
public class CostLandTableAreaSourceTests
{
    private static readonly Guid VrId = Guid.Parse("d5000001-0000-4000-8000-000000000001");

    [Fact]
    public void The_land_table_uses_the_apartment_land_share_and_the_market_table_keeps_the_header_area()
    {
        Assert.Equal(60m, ValuationComparableListBuilder.AreaAdjustmentSubjectAreaSqm(
            180m, ComparableSelectionContexts.LandWithinCost, 60m));
        Assert.Equal(180m, ValuationComparableListBuilder.AreaAdjustmentSubjectAreaSqm(
            180m, ComparableSelectionContexts.LandWithinCost, null));
        Assert.Equal(180m, ValuationComparableListBuilder.AreaAdjustmentSubjectAreaSqm(
            180m, ComparableSelectionContexts.LandWithinCost, 0m));
        Assert.Equal(180m, ValuationComparableListBuilder.AreaAdjustmentSubjectAreaSqm(
            180m, ComparableSelectionContexts.Market, 60m));
        Assert.Equal(0m, ValuationComparableListBuilder.AreaAdjustmentSubjectAreaSqm(
            null, ComparableSelectionContexts.Market, null));
    }

    [Fact]
    public void An_apartments_land_comparables_are_area_adjusted_against_its_land_share()
    {
        var comp = Comp(900m, 900_000m);
        var comps = new Dictionary<Guid, ComparableProperty> { [comp.Id] = comp };

        // Apartment: floor area 150 m² on the market header, 900 m² land share saved on the cost.
        var withShare = ValuationComparableListBuilder.BuildList(
            Request(), [Row(comp, ComparableSelectionContexts.LandWithinCost)], comps, new DateOnly(2026, 10, 25),
            Header(150m), ComparableSelectionContexts.LandWithinCost, [], costApartmentLandShareSqm: 900m);
        Assert.Equal(0m, withShare.Items[0].Market!.SuggestedAreaAdjustmentPct);

        // Without a saved share the header area still applies (150 vs 900 m² → an area adjustment).
        var headerOnly = ValuationComparableListBuilder.BuildList(
            Request(), [Row(comp, ComparableSelectionContexts.LandWithinCost)], comps, new DateOnly(2026, 10, 25),
            Header(150m), ComparableSelectionContexts.LandWithinCost, []);
        Assert.NotEqual(0m, headerOnly.Items[0].Market!.SuggestedAreaAdjustmentPct);

        // The market table never reads the cost land share.
        var market = ValuationComparableListBuilder.BuildList(
            Request(), [Row(comp, ComparableSelectionContexts.Market)], comps, new DateOnly(2026, 10, 25),
            Header(150m), ComparableSelectionContexts.Market, [], costApartmentLandShareSqm: 900m);
        Assert.Equal(
            headerOnly.Items[0].Market!.SuggestedAreaAdjustmentPct,
            market.Items[0].Market!.SuggestedAreaAdjustmentPct);
        // The land table's subject area (the cost land area source) is unchanged for the cost screen.
        Assert.Equal(150m, withShare.SubjectAreaSqm);
    }

    private static ComparableProperty Comp(decimal area, decimal price) => new()
    {
        Id = Guid.Parse("d5000000-0000-4000-8000-000000000001"),
        ReferenceCode = "CMP-LAND-1",
        ComparablePropertyType = "أرض",
        Usage = "سكني",
        TransactionKind = ComparableTransactionKinds.Executed,
        Source = ComparableSources.Other,
        District = "الخالدية",
        AreaSqm = area,
        Price = price,
        PricePerSqm = Math.Round(price / area, 2),
        Latitude = 24.15m,
        Longitude = 47.31m,
        TransactionDate = new DateOnly(2026, 8, 1),
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
        ValuationRequest.Create(VrId, "VR-LAND", Guid.NewGuid(), "الرياض", "شقة", "مقيم", "2026-10-25", DateTime.UtcNow);

    private static ValuationMarketApproach Header(decimal subjectArea) => new()
    {
        Id = Guid.NewGuid(),
        ValuationRequestId = VrId,
        SubjectAreaSqm = subjectArea,
        AdjustmentBasis = MarketAdjustmentBasisKeys.PricePerSqm,
    };
}

using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Valuation.Application.Services;
using RealEstateEval.Valuation.Domain;
using RealEstateEval.Valuation.Infrastructure.Data.Contexts;
using RealEstateEval.Valuation.Infrastructure.Persistence;
using Xunit;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// Production 2026-11-01 (962010002726, PO-075833): a land comparable entered inside a property
/// registered as a building, valued «أرض فقط», was adopted in the land table that scope never shows.
/// </summary>
public sealed class LinkedLandComparableRoutingTests
{
    private const string Market = ComparableSelectionContexts.Market;
    private const string Land = ComparableSelectionContexts.LandWithinCost;

    [Fact]
    public async Task A_farm_valued_as_land_only_shows_its_land_comparable_adopted_in_the_market_table()
    {
        await using var contexts = TestDatabases.Create("linked-land-only");
        var (selections, id) = await SeedAsync(contexts.Valuation, "مزرعة", cost: false, CostScopeKeys.LandOnly);

        var market = await selections.ListAsync(id, Market);

        Assert.True(Assert.Single(market!.Items).IsAdopted);
        Assert.Empty((await selections.ListAsync(id, Land))!.Items);
    }

    [Fact]
    public async Task A_header_saved_for_the_whole_villa_moves_to_per_sqm_when_its_land_comparable_arrives()
    {
        await using var contexts = TestDatabases.Create("linked-land-only-basis");
        var (selections, id) = await SeedAsync(contexts.Valuation, "فيلا", cost: false, CostScopeKeys.LandOnly);
        contexts.Valuation.ValuationMarketApproaches.Add(new ValuationMarketApproach
        {
            Id = Guid.NewGuid(),
            ValuationRequestId = id,
            SubjectAreaSqm = 900m,
            AdjustmentBasis = MarketAdjustmentBasisKeys.WholeProperty,
            AnnualMarketRatePct = 3m,
        });
        await contexts.Valuation.SaveChangesAsync();

        var market = await selections.ListAsync(id, Market);

        Assert.Equal(MarketAdjustmentBasisKeys.PricePerSqm, market!.AdjustmentBasis);
    }

    [Fact]
    public async Task A_villa_valued_with_its_buildings_keeps_land_comparables_in_the_land_table()
    {
        await using var contexts = TestDatabases.Create("linked-land-and-building");
        var (selections, id) = await SeedAsync(contexts.Valuation, "فيلا", cost: true, CostScopeKeys.LandAndBuilding);

        var market = await selections.ListAsync(id, Market);

        Assert.Empty(market!.Items);
        Assert.True(Assert.Single((await selections.ListAsync(id, Land))!.Items).IsAdopted);
    }

    [Fact]
    public async Task With_the_cost_approach_off_a_whole_villa_shows_the_land_comparable_unadopted()
    {
        await using var contexts = TestDatabases.Create("linked-market-whole");
        var (selections, id) = await SeedAsync(contexts.Valuation, "فيلا", cost: false, CostScopeKeys.LandAndBuilding);

        var market = await selections.ListAsync(id, Market);

        Assert.False(Assert.Single(market!.Items).IsAdopted);
    }

    [Fact]
    public async Task A_comparable_stuck_in_the_hidden_land_table_reaches_the_market_table_on_the_next_read()
    {
        await using var contexts = TestDatabases.Create("linked-stuck");
        var (selections, id) = await SeedAsync(contexts.Valuation, "مزرعة", cost: true, CostScopeKeys.LandAndBuilding);
        await selections.ListAsync(id, Market);
        var settings = contexts.Valuation.ValuationApproachSettings.Single(x => x.ValuationRequestId == id);
        settings.CostApproachEnabled = false;
        settings.CostScopeKey = CostScopeKeys.LandOnly;
        await contexts.Valuation.SaveChangesAsync();

        var market = await selections.ListAsync(id, Market);

        Assert.True(Assert.Single(market!.Items).IsAdopted);
    }

    [Theory]
    [InlineData(null, null, true)]
    [InlineData(true, CostScopeKeys.LandAndBuilding, true)]
    [InlineData(false, CostScopeKeys.LandAndBuilding, false)]
    [InlineData(true, CostScopeKeys.BuildingOnly, false)]
    [InlineData(false, CostScopeKeys.LandOnly, false)]
    public void The_land_table_counts_only_when_it_is_on_screen(bool? cost, string? scope, bool expected)
    {
        Assert.Equal(expected, LinkedComparableRules.LandTableIsShown(cost, scope));
    }

    private static async Task<(ValuationComparableSelectionService Selections, Guid RequestId)> SeedAsync(
        ValuationDbContext db,
        string propertyType,
        bool cost,
        string scope)
    {
        var id = Guid.NewGuid();
        var propertyId = Guid.NewGuid();
        db.ValuationRequests.Add(ValuationRequest.Create(
            id, "VR-900", propertyId, "الأفلاج", propertyType, "مقيم", "2026-11-01", DateTime.UtcNow));
        db.ValuationApproachSettings.Add(new ValuationApproachSettings
        {
            Id = Guid.NewGuid(),
            ValuationRequestId = id,
            CostApproachEnabled = cost,
            CostScopeKey = scope,
        });
        var compId = Guid.NewGuid();
        db.ComparableProperties.Add(new ComparableProperty
        {
            Id = compId,
            ReferenceCode = $"CMP-{compId.ToString("N")[..8].ToUpperInvariant()}",
            ComparablePropertyType = "أرض",
            TransactionKind = ComparableTransactionKinds.Executed,
            Source = ComparableSources.Other,
            City = "الأفلاج",
            District = "أوسيله",
            AreaSqm = 5000m,
            Price = 500_000m,
            PricePerSqm = 100m,
            Latitude = 22.28m,
            Longitude = 46.73m,
            TransactionDate = new DateOnly(2026, 9, 1),
            IsActive = true,
        });
        db.PropertyComparableLinks.Add(new PropertyComparableLink
        {
            Id = Guid.NewGuid(),
            PropertyId = propertyId,
            ComparablePropertyId = compId,
            LinkedAtUtc = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();

        var selections = new ValuationComparableSelectionService(
            new ValuationComparableSelectionRepository(db),
            new ValuationReportFreezeGate(db),
            ValuationSettingsAndPriorBankFeedTests.Proxy.Of<IOrganizationSettingsService>((method, _) =>
                method.ReturnType == typeof(Task<OrganizationSettingsDto>)
                    ? Task.FromResult(new OrganizationSettingsDto())
                    : null));
        return (selections, id);
    }
}

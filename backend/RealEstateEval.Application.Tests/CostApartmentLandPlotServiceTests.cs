using System.Reflection;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Application.Services;
using RealEstateEval.Valuation.Domain;
using RealEstateEval.Valuation.Infrastructure.Data.Contexts;
using RealEstateEval.Valuation.Infrastructure.Persistence;
using Xunit;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// End to end over the real selection and cost services (in-memory store), on the VR-542
/// journey: an apartment of 180 m² whose building stands on a 900 m² plot, with a 60 m² share. The land
/// comparables are adjusted against the plot saved on the cost approach, the land value is the adjusted
/// rate × the share, and the screen's subject-area sync (a market-approach PUT of 180 m²) moves nothing.
/// </summary>
public class CostApartmentLandPlotServiceTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 26, 9, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task Vr542_land_value_is_the_adjusted_rate_times_the_share_and_the_header_sync_never_moves_it()
    {
        await using var contexts = TestDatabases.Create("cost-apartment-plot");
        var (cost, selections, requestId) = await Vr542Async(contexts.Valuation);

        var (saved, errors) = await cost.SaveAsync(requestId, Save(plot: 900m, share: 60m));

        Assert.Null(errors);
        Assert.Equal(900m, saved!.BuildingPlotAreaSqm);
        Assert.Equal(60m, saved.ApartmentLandShareSqm);
        Assert.Equal(900m, saved.LandAreaSqm);
        Assert.Equal(3_561.58m, saved.LandUnitRateFromMarket);
        Assert.Equal(213_694.80m, saved.LandValueFromMarket);
        Assert.True(saved.LandEstimateComplete);
        var land = await selections.ListAsync(requestId, ComparableSelectionContexts.LandWithinCost);
        Assert.Equal([0m, -1m], land!.Items.Select(i => i.Market!.SuggestedAreaAdjustmentPct));
        Assert.Equal(213_694.80m, land.MarketOpinionValueRaw);

        // The screen's subject-area sync writes the apartment's own area onto the market header —
        // first as the plot (the round-2 workaround), then back to 180 m².
        foreach (var headerArea in new[] { 900m, 180m })
        {
            var (_, syncErrors) = await selections.SaveMarketApproachAsync(requestId, new SaveValuationMarketApproachRequest
            {
                SubjectAreaSqm = headerArea,
                AdjustmentBasis = MarketAdjustmentBasisKeys.PricePerSqm,
            });
            Assert.Null(syncErrors);
            var read = await cost.GetAsync(requestId);
            Assert.Equal(900m, read!.BuildingPlotAreaSqm);
            Assert.Equal(3_561.58m, read.LandUnitRateFromMarket);
            Assert.Equal(213_694.80m, read.LandValueFromMarket);
        }

        // The stored row keeps the plot untouched by the header writes.
        contexts.Valuation.ChangeTracker.Clear();
        var row = contexts.Valuation.ValuationCostApproaches.Single(x => x.ValuationRequestId == requestId);
        Assert.Equal(900m, row.BuildingPlotAreaSqm);
        Assert.Equal(213_694.80m, row.LandValueFromMarket);
    }

    [Fact]
    public async Task An_apartment_share_without_a_plot_leaves_the_land_incomplete()
    {
        await using var contexts = TestDatabases.Create("cost-apartment-no-plot");
        var (cost, _, requestId) = await Vr542Async(contexts.Valuation);

        var (saved, errors) = await cost.SaveAsync(requestId, Save(plot: null, share: 60m));

        Assert.Null(errors);
        Assert.Null(saved!.BuildingPlotAreaSqm);
        Assert.Equal(0m, saved.LandAreaSqm);
        Assert.False(saved.LandEstimateComplete);
    }

    [Theory]
    [InlineData(0.0, null, "buildingPlotAreaSqm")]
    [InlineData(-5.0, null, "buildingPlotAreaSqm")]
    [InlineData(20_000_000.0, null, "buildingPlotAreaSqm")]
    [InlineData(50.0, 60.0, "apartmentLandShareSqm")]
    public async Task An_impossible_plot_or_a_share_above_the_plot_is_refused_in_arabic(
        double plot,
        double? share,
        string key)
    {
        await using var contexts = TestDatabases.Create($"cost-apartment-bad-{key}-{plot}");
        var (cost, _, requestId) = await Vr542Async(contexts.Valuation);

        var (_, errors) = await cost.SaveAsync(requestId, Save((decimal)plot, (decimal?)share));

        Assert.NotNull(errors);
        Assert.Contains("قطعة الأرض", errors[key]);
    }

    private static SaveValuationCostApproachRequest Save(decimal? plot, decimal? share) => new()
    {
        Lines =
        [
            new SaveValuationCostLineRequest
            {
                StructureKind = BuildingStructureKinds.Floor,
                ItemKey = CostLineItemKeys.Custom,
                Label = "مسطح الشقة مع نصيبها من الخدمات",
                AreaSqm = 180m,
                Unit = CostLineUnits.Sqm,
                UnitCostSar = 2200m,
            },
        ],
        RefreshLandFromLandComps = true,
        ApartmentLandShareSqm = share,
        BuildingPlotAreaSqm = plot,
    };

    private static async Task<(ValuationCostApproachService Cost, ValuationComparableSelectionService Selections, Guid RequestId)>
        Vr542Async(ValuationDbContext db)
    {
        var id = Guid.NewGuid();
        db.ValuationRequests.Add(ValuationRequest.Create(
            id, "VR-542", Guid.NewGuid(), "الرياض", "شقة", "مقيم", "2026-10-26", DateTime.UtcNow));
        db.ValuationApproachSettings.Add(new ValuationApproachSettings
        {
            Id = Guid.NewGuid(),
            ValuationRequestId = id,
            CostApproachEnabled = true,
            CostScopeKey = CostScopeKeys.LandAndBuilding,
        });
        // The market header holds the apartment's own area — what the subject-area sync writes.
        db.ValuationMarketApproaches.Add(new ValuationMarketApproach
        {
            Id = Guid.NewGuid(),
            ValuationRequestId = id,
            SubjectAreaSqm = 180m,
            AdjustmentBasis = MarketAdjustmentBasisKeys.WholeProperty,
            AnnualMarketRatePct = 3m,
        });
        AddLandComp(db, id, 900m, 3_150_000m, new DateOnly(2026, 7, 1), marketPct: 0.96m, weightPct: 65m, sort: 0);
        AddLandComp(db, id, 750m, 2_700_000m, new DateOnly(2026, 5, 10), marketPct: 1.39m, weightPct: 35m, sort: 1);
        await db.SaveChangesAsync();

        var clock = new FixedClock(Now);
        var selections = new ValuationComparableSelectionService(
            new ValuationComparableSelectionRepository(db),
            new ValuationReportFreezeGate(db),
            ValuationSettingsAndPriorBankFeedTests.Proxy.Of<IOrganizationSettingsService>((method, _) =>
                method.ReturnType == typeof(Task<OrganizationSettingsDto>)
                    ? Task.FromResult(new OrganizationSettingsDto())
                    : null),
            clock);
        var cost = new ValuationCostApproachService(
            new ValuationCostApproachRepository(db),
            new ValuationReportFreezeGate(db),
            ValuationSettingsAndPriorBankFeedTests.Proxy.Of<ICaseStudyLookup>((_, _) => null),
            selections,
            clock);
        return (cost, selections, id);
    }

    private static void AddLandComp(
        ValuationDbContext db,
        Guid requestId,
        decimal area,
        decimal price,
        DateOnly date,
        decimal marketPct,
        decimal weightPct,
        int sort)
    {
        var compId = Guid.NewGuid();
        db.ComparableProperties.Add(new ComparableProperty
        {
            Id = compId,
            ReferenceCode = $"CMP-{compId.ToString("N")[..8].ToUpperInvariant()}",
            ComparablePropertyType = "أرض",
            Usage = "سكني",
            TransactionKind = ComparableTransactionKinds.Executed,
            Source = ComparableSources.Other,
            City = "الرياض",
            District = "الصحافة",
            AreaSqm = area,
            Price = price,
            PricePerSqm = Math.Round(price / area, 2),
            Latitude = 24.80m,
            Longitude = 46.63m,
            TransactionDate = date,
            IsActive = true,
        });
        var selectionId = Guid.NewGuid();
        var lines = MarketApproachRules.CreateStandardMarketLines(selectionId).ToList();
        foreach (var line in lines.Where(l => l.FactorKey == MarketAdjustmentFactorKeys.Market))
            line.Percent = marketPct;
        db.ValuationComparableSelections.Add(new ValuationComparableSelection
        {
            Id = selectionId,
            ValuationRequestId = requestId,
            ComparablePropertyId = compId,
            SelectionContext = ComparableSelectionContexts.LandWithinCost,
            SortOrder = sort,
            IsAdopted = true,
            WeightPct = weightPct,
            WeightIsManual = true,
            SelectedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow,
            AdjustmentLines = lines,
        });
    }

    private sealed class FixedClock(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }
}

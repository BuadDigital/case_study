using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Application.Rules;
using RealEstateEval.Valuation.Application.Services;
using RealEstateEval.Valuation.Domain;
using RealEstateEval.Valuation.Infrastructure.Data.Contexts;
using RealEstateEval.Valuation.Infrastructure.Persistence;
using Xunit;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// Omar 2026-11-12: «أرض العقار، سواء قمت بتقييمها لوحدها أو كجزء من طريقة التكلفة، التسويات واحدة —
/// الأرض هي الأرض وقيمتها ثابتة». A subject valued as land has one table: «تقدير قيمة الأرض فضاءً»
/// inside the cost approach is the market table's own rows.
/// </summary>
public sealed class OneLandTableTests
{
    private const string Market = ComparableSelectionContexts.Market;
    private const string Land = ComparableSelectionContexts.LandWithinCost;
    private const string User = "appraiser-1";

    [Fact]
    public async Task The_land_table_of_a_land_is_the_market_table_with_its_adjustments_and_weights()
    {
        await using var contexts = TestDatabases.Create("one-land-read");
        var seed = await SeedAsync(contexts.Valuation, "أرض سكنية");
        var a = await seed.AdoptAsync(Market, seed.LandA);
        await seed.AdoptAsync(Market, seed.LandB);
        await seed.TuneAsync(a.Id, percent: -7.5m, rationale: "الموقع أدنى من موضوع التقييم", weight: 60m, price: 480_000m);

        var market = await seed.Selections.ListAsync(seed.RequestId, Market);
        var land = await seed.Selections.ListAsync(seed.RequestId, Land);

        Assert.True(land!.LandSharedWithMarket);
        Assert.False(market!.LandSharedWithMarket);
        Assert.Equal(Land, land.SelectionContext);
        Assert.Equal(market.Items.Select(i => i.Id), land.Items.Select(i => i.Id));
        Assert.Equal(2, land.AdoptedCount);
        // One set of adjustments, so one rate per m² of land in both approaches.
        Assert.Equal(market.WeightedPricePerSqm, land.WeightedPricePerSqm);
        var line = land.Items.Single(i => i.Id == a.Id).Market!.AdjustmentLines
            .Single(l => l.FactorKey == MarketAdjustmentFactorKeys.Location);
        Assert.Equal(-7.5m, line.Percent);
    }

    /// <summary>
    /// What is shared is the comparison itself: every comparable's adjustments and adjusted amount, and
    /// the weights. What each approach then does with the result is its own: the market approach
    /// multiplies by its area and rounds; the cost approach multiplies by the plot it holds, unrounded.
    /// Caught 2026-11-12: the land view recomputed the area adjustment against the cost approach's
    /// plot and always per m², so the same rows gave a different rate than the market table.
    /// </summary>
    [Theory]
    [InlineData(MarketAdjustmentBasisKeys.PricePerSqm)]
    [InlineData(MarketAdjustmentBasisKeys.WholeProperty)]
    public async Task The_comparison_is_one_whatever_area_or_basis_each_approach_holds(string marketBasis)
    {
        await using var contexts = TestDatabases.Create($"one-land-comparison-{marketBasis}");
        var seed = await SeedAsync(contexts.Valuation, "أرض");
        var a = await seed.AdoptAsync(Market, seed.LandA);
        await seed.AdoptAsync(Market, seed.LandB);
        await seed.TuneAsync(a.Id, percent: -7.5m, rationale: "الموقع أدنى من موضوع التقييم", weight: 60m, price: 480_000m);
        // The market table measures the subject as 1,000 m² (the comparables are 500 m², so the area
        // adjustment is not zero); the cost approach holds a plot of 600 m².
        var header = contexts.Valuation.ValuationMarketApproaches.Single(h => h.ValuationRequestId == seed.RequestId);
        header.SubjectAreaSqm = 1000m;
        header.AdjustmentBasis = marketBasis;
        contexts.Valuation.ValuationCostApproaches.Add(new ValuationCostApproach
        {
            Id = Guid.NewGuid(),
            ValuationRequestId = seed.RequestId,
            BuildingPlotAreaSqm = 600m,
        });
        await contexts.Valuation.SaveChangesAsync();

        var market = await seed.Selections.ListAsync(seed.RequestId, Market);
        var land = await seed.Selections.ListAsync(seed.RequestId, Land);

        // Shared: the comparison.
        Assert.Equal(marketBasis, land!.AdjustmentBasis);
        Assert.Equal(market!.WeightedPricePerSqm, land.WeightedPricePerSqm);
        Assert.Equal(
            market.Items.Select(i => (i.Id, i.Market!.SuggestedAreaAdjustmentPct, i.Market.PricePerSqmAfterDifference, i.Market.EffectiveWeightPct)),
            land.Items.Select(i => (i.Id, i.Market!.SuggestedAreaAdjustmentPct, i.Market.PricePerSqmAfterDifference, i.Market.EffectiveWeightPct)));
        if (marketBasis == MarketAdjustmentBasisKeys.PricePerSqm)
            Assert.Contains(market.Items, i => i.Market!.SuggestedAreaAdjustmentPct != 0m);
        // So the cost approach's rate per m² of land is the market table's.
        static decimal Rate(ValuationComparableSelectionListDto list) =>
            CostApproachRules.LandUnitRateFromAdoptedComps(
                list.Items.Select(i => (i.Market!.PricePerSqmAfterDifference, i.EffectiveAreaSqm, i.Market.EffectiveWeightPct)),
                list.AdjustmentBasis);
        Assert.Equal(Rate(market), Rate(land));

        // Each approach's own: the cost approach multiplies by its plot and does not round.
        Assert.Equal(1000m, market.SubjectAreaSqm);
        Assert.Equal(600m, land.SubjectAreaSqm);
        Assert.Equal(land.MarketOpinionValueRaw, land.MarketOpinionValue);
    }

    [Fact]
    public async Task Every_write_through_the_land_table_lands_in_the_market_table()
    {
        await using var contexts = TestDatabases.Create("one-land-write");
        var seed = await SeedAsync(contexts.Valuation, "أرض");

        await seed.AdoptAsync(Land, seed.LandA);
        var (rationale, rationaleErrors) = await seed.Selections.SaveFactorRationaleAsync(
            seed.RequestId,
            new SaveAdjustmentFactorRationaleRequest
            {
                SelectionContext = Land,
                FactorKey = MarketAdjustmentFactorKeys.Location,
                RationaleAr = "مبرر عامل الموقع لكل المقارنات",
            },
            User);

        Assert.Null(rationaleErrors);
        Assert.Equal(Land, rationale!.SelectionContext);
        Assert.Equal(
            [Market],
            contexts.Valuation.ValuationComparableSelections
                .Where(s => s.ValuationRequestId == seed.RequestId)
                .Select(s => s.SelectionContext)
                .ToList());
        Assert.Equal(
            Market,
            contexts.Valuation.ValuationAdjustmentFactorRationales
                .Single(r => r.ValuationRequestId == seed.RequestId).SelectionContext);
        // The market approach shows what the cost approach's land section entered, and the reverse.
        var market = await seed.Selections.ListAsync(seed.RequestId, Market);
        Assert.Equal([seed.LandA], market!.Items.Select(i => i.ComparablePropertyId));
        Assert.Single(market.FactorRationales);

        var (removed, removeError) = await seed.Selections.SetAdoptedAsync(
            seed.RequestId, seed.LandA, false, User, default, Land);
        Assert.Null(removeError);
        Assert.False(removed!.IsAdopted);
        var (ok, error) = await seed.Selections.RemoveAsync(seed.RequestId, seed.LandA, default, Land);
        Assert.True(ok, error);
        Assert.Empty((await seed.Selections.ListAsync(seed.RequestId, Market))!.Items);
    }

    [Fact]
    public async Task A_built_subject_keeps_two_tables()
    {
        await using var contexts = TestDatabases.Create("one-land-villa");
        var seed = await SeedAsync(contexts.Valuation);
        await seed.AdoptAsync(Market, seed.Villa);
        await seed.AdoptAsync(Land, seed.LandA);

        var land = await seed.Selections.ListAsync(seed.RequestId, Land);

        Assert.False(land!.LandSharedWithMarket);
        Assert.Equal([seed.LandA], land.Items.Select(i => i.ComparablePropertyId));
        Assert.Equal(
            [seed.Villa],
            (await seed.Selections.ListAsync(seed.RequestId, Market))!.Items.Select(i => i.ComparablePropertyId));
    }

    [Fact]
    public async Task A_land_deed_with_a_building_on_it_keeps_two_tables()
    {
        // «أرض تجارية + مستودع»: the market table compares warehouses, which say nothing about the land.
        await using var contexts = TestDatabases.Create("one-land-warehouse");
        var seed = await SeedAsync(
            contexts.Valuation, "أرض تجارية", Inventory(Line(BuildingStructureKinds.Floor, "1000", "المستودع")));
        await seed.AdoptAsync(Market, seed.Villa);
        await seed.AdoptAsync(Land, seed.LandA);

        var land = await seed.Selections.ListAsync(seed.RequestId, Land);

        Assert.False(land!.LandSharedWithMarket);
        Assert.Equal([seed.LandA], land.Items.Select(i => i.ComparablePropertyId));
    }

    [Fact]
    public async Task A_fence_on_the_land_does_not_split_the_table_and_the_inspected_type_decides()
    {
        await using var contexts = TestDatabases.Create("one-land-fence");
        // Recorded as a villa at intake, found to be a fenced land at the inspection.
        var seed = await SeedAsync(
            contexts.Valuation,
            "فيلا",
            Inventory(Line(BuildingStructureKinds.Fence, "120"), inspectedType: "أرض"));
        await seed.AdoptAsync(Market, seed.LandA);

        var land = await seed.Selections.ListAsync(seed.RequestId, Land);

        Assert.True(land!.LandSharedWithMarket);
        Assert.Equal([seed.LandA], land.Items.Select(i => i.ComparablePropertyId));
    }

    [Theory]
    [InlineData("أرض", false, true)]
    [InlineData("أرض سكنية", false, true)]
    [InlineData("أرض تجارية", true, false)]
    [InlineData("فيلا", false, false)]
    [InlineData("", false, false)]
    public void A_subject_is_valued_as_land_when_its_deed_is_land_and_nothing_is_built(
        string propertyType, bool hasFloor, bool expected)
    {
        var inventory = hasFloor
            ? new[] { Line(BuildingStructureKinds.Floor, "400") }
            : [Line(BuildingStructureKinds.Fence, "120")];

        Assert.Equal(expected, SubjectLandRules.IsValuedAsLand(propertyType, inventory));
    }

    private static CaseStudyBuildingInventoryLineDto Line(string kind, string? area, string? label = null) =>
        new() { StructureKind = kind, Label = label ?? kind, AreaSqm = area };

    /// <summary>The case-study service answering with this inventory (and inspected type) for any property.</summary>
    private static ICaseStudyLookup Inventory(CaseStudyBuildingInventoryLineDto line, string? inspectedType = null) =>
        ValuationSettingsAndPriorBankFeedTests.Proxy.Of<ICaseStudyLookup>((method, _) =>
            method.ReturnType == typeof(Task<CaseStudyValuationPropertyContextDto?>)
                ? Task.FromResult<CaseStudyValuationPropertyContextDto?>(new CaseStudyValuationPropertyContextDto
                {
                    InspectedPropertyType = inspectedType ?? "",
                    BuildingInventoryLines = [line],
                })
                : null);

    private sealed record Seed(
        ValuationDbContext Db,
        ValuationComparableSelectionService Selections,
        Guid RequestId,
        Guid LandA,
        Guid LandB,
        Guid Villa)
    {
        public async Task<ValuationComparableSelection> AdoptAsync(string context, Guid comparableId, bool adopted = true)
        {
            var (_, error) = await Selections.SetAdoptedAsync(RequestId, comparableId, adopted, User, default, context);
            Assert.Null(error);
            // A land's row lives in the market table whichever table it was adopted through.
            var rows = Db.ValuationComparableSelections
                .Where(s => s.ValuationRequestId == RequestId && s.ComparablePropertyId == comparableId)
                .ToList();
            return rows.SingleOrDefault(s => s.SelectionContext == context)
                ?? rows.Single(s => s.SelectionContext == Market);
        }

        /// <summary>Writes what the appraiser tunes on one row: a location adjustment, a manual weight, a price override.</summary>
        public async Task TuneAsync(Guid selectionId, decimal percent, string rationale, decimal weight, decimal? price)
        {
            var row = Db.ValuationComparableSelections.Single(s => s.Id == selectionId);
            row.WeightPct = weight;
            row.WeightIsManual = true;
            row.WeightOverrideRationale = "وزن يدوي لقرب المقارن";
            row.PriceOverrideSar = price;
            var line = Db.ValuationComparableAdjustmentLines
                .Single(l => l.SelectionId == selectionId && l.FactorKey == MarketAdjustmentFactorKeys.Location);
            line.Percent = percent;
            line.Rationale = rationale;
            await Db.SaveChangesAsync();
        }
    }

    /// <summary>
    /// A valuation with the cost approach on (land and buildings), two land comparables and a villa
    /// in the bank. <paramref name="caseStudy"/> answers for the property's inventory and inspected type.
    /// </summary>
    private static async Task<Seed> SeedAsync(
        ValuationDbContext db,
        string propertyType = "فيلا",
        ICaseStudyLookup? caseStudy = null)
    {
        var id = Guid.NewGuid();
        db.ValuationRequests.Add(ValuationRequest.Create(
            id, "VR-950", Guid.NewGuid(), "النرجس", propertyType, "مقيم", "2026-11-01", DateTime.UtcNow));
        db.ValuationApproachSettings.Add(new ValuationApproachSettings
        {
            Id = Guid.NewGuid(),
            ValuationRequestId = id,
            CostApproachEnabled = true,
            CostScopeKey = CostScopeKeys.LandAndBuilding,
        });
        Guid Comparable(string type)
        {
            var compId = Guid.NewGuid();
            db.ComparableProperties.Add(new ComparableProperty
            {
                Id = compId,
                ReferenceCode = $"CMP-{compId.ToString("N")[..8].ToUpperInvariant()}",
                ComparablePropertyType = type,
                TransactionKind = ComparableTransactionKinds.Executed,
                Source = ComparableSources.Other,
                City = "الرياض",
                District = "النرجس",
                AreaSqm = 500m,
                Price = 500_000m,
                PricePerSqm = 1000m,
                Latitude = 24.83m,
                Longitude = 46.67m,
                TransactionDate = new DateOnly(2026, 9, 1),
                IsActive = true,
            });
            return compId;
        }
        var landA = Comparable("أرض");
        var landB = Comparable("أرض");
        var villa = Comparable("فيلا");
        await db.SaveChangesAsync();

        var selections = new ValuationComparableSelectionService(
            new ValuationComparableSelectionRepository(db),
            new ValuationReportFreezeGate(db),
            ValuationSettingsAndPriorBankFeedTests.Proxy.Of<IOrganizationSettingsService>((method, _) =>
                method.ReturnType == typeof(Task<OrganizationSettingsDto>)
                    ? Task.FromResult(new OrganizationSettingsDto())
                    : null),
            caseStudy: caseStudy);
        return new Seed(db, selections, id, landA, landB, villa);
    }
}

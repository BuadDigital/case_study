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
/// Ruling 2026-11-11: the land valuation by comparable sales is the same work in the market approach
/// and inside the cost approach, so the appraiser copies it from one table to the other instead of
/// entering it twice — a snapshot, each table edited freely afterwards. Since 2026-11-12 this is for
/// built subjects only (the seed is a villa): a subject valued as land has one table for both
/// (<see cref="OneLandTableTests"/>).
/// </summary>
public sealed class CopyLandComparablesTableTests
{
    private const string Market = ComparableSelectionContexts.Market;
    private const string Land = ComparableSelectionContexts.LandWithinCost;
    private const string User = "appraiser-1";

    [Fact]
    public async Task The_land_table_goes_to_the_market_table_with_its_adjustments_weights_and_overrides()
    {
        await using var contexts = TestDatabases.Create("copy-land-to-market");
        var seed = await SeedAsync(contexts.Valuation);
        var landA = await seed.AdoptAsync(Land, seed.LandA);
        await seed.AdoptAsync(Land, seed.LandB);
        await seed.TuneAsync(landA.Id, percent: -7.5m, rationale: "الموقع أدنى من موضوع التقييم", weight: 60m, price: 480_000m);
        contexts.Valuation.ValuationAdjustmentFactorRationales.Add(new ValuationAdjustmentFactorRationale
        {
            Id = Guid.NewGuid(),
            ValuationRequestId = seed.RequestId,
            SelectionContext = Land,
            FactorKey = MarketAdjustmentFactorKeys.Location,
            RationaleAr = "مبرر عامل الموقع لكل المقارنات",
        });
        await contexts.Valuation.SaveChangesAsync();

        var (result, errors) = await seed.Selections.CopyTableAsync(
            seed.RequestId, new CopyValuationComparableTableRequest { FromContext = Land, ToContext = Market }, User);

        Assert.Null(errors);
        Assert.Equal(2, result!.CopiedCount);
        Assert.Equal(0, result.SkippedBuiltCount);
        var copied = contexts.Valuation.ValuationComparableSelections
            .Where(s => s.ValuationRequestId == seed.RequestId && s.SelectionContext == Market)
            .OrderBy(s => s.SortOrder)
            .ToList();
        Assert.Equal([seed.LandA, seed.LandB], copied.Select(s => s.ComparablePropertyId));
        Assert.All(copied, s => Assert.True(s.IsAdopted));
        var a = copied[0];
        Assert.Equal(60m, a.WeightPct);
        Assert.True(a.WeightIsManual);
        Assert.Equal(480_000m, a.PriceOverrideSar);
        var line = contexts.Valuation.ValuationComparableAdjustmentLines
            .Single(l => l.SelectionId == a.Id && l.FactorKey == MarketAdjustmentFactorKeys.Location);
        Assert.Equal(-7.5m, line.Percent);
        Assert.Equal("الموقع أدنى من موضوع التقييم", line.Rationale);
        Assert.Equal(
            "مبرر عامل الموقع لكل المقارنات",
            contexts.Valuation.ValuationAdjustmentFactorRationales
                .Single(r => r.ValuationRequestId == seed.RequestId && r.SelectionContext == Market).RationaleAr);
    }

    [Fact]
    public async Task The_copy_is_a_snapshot_the_source_keeps_its_own_rows()
    {
        await using var contexts = TestDatabases.Create("copy-snapshot");
        var seed = await SeedAsync(contexts.Valuation);
        var source = await seed.AdoptAsync(Land, seed.LandA);
        await seed.Selections.CopyTableAsync(
            seed.RequestId, new CopyValuationComparableTableRequest { FromContext = Land, ToContext = Market }, User);

        var target = contexts.Valuation.ValuationComparableSelections
            .Single(s => s.ValuationRequestId == seed.RequestId && s.SelectionContext == Market);
        Assert.NotEqual(source.Id, target.Id);
        await seed.TuneAsync(target.Id, percent: 12m, rationale: "تعديل في جدول السوق وحده", weight: 100m, price: null);

        var sourceLine = contexts.Valuation.ValuationComparableAdjustmentLines
            .Single(l => l.SelectionId == source.Id && l.FactorKey == MarketAdjustmentFactorKeys.Location);
        Assert.Equal(0m, sourceLine.Percent);
        Assert.Single(contexts.Valuation.ValuationComparableSelections
            .Where(s => s.ValuationRequestId == seed.RequestId && s.SelectionContext == Land));
    }

    [Fact]
    public async Task Only_land_goes_into_the_land_table_and_the_unadopted_rows_stay_behind()
    {
        await using var contexts = TestDatabases.Create("copy-market-to-land");
        var seed = await SeedAsync(contexts.Valuation);
        await seed.AdoptAsync(Market, seed.LandA);
        await seed.AdoptAsync(Market, seed.Villa);
        await seed.AdoptAsync(Market, seed.LandB, adopted: false);

        var (result, errors) = await seed.Selections.CopyTableAsync(
            seed.RequestId, new CopyValuationComparableTableRequest { FromContext = Market, ToContext = Land }, User);

        Assert.Null(errors);
        Assert.Equal(1, result!.CopiedCount);
        Assert.Equal(1, result.SkippedBuiltCount);
        Assert.Equal(
            [seed.LandA],
            contexts.Valuation.ValuationComparableSelections
                .Where(s => s.ValuationRequestId == seed.RequestId && s.SelectionContext == Land)
                .Select(s => s.ComparablePropertyId));
    }

    [Fact]
    public async Task A_target_with_comparables_is_replaced_only_when_the_appraiser_confirms()
    {
        await using var contexts = TestDatabases.Create("copy-replace");
        var seed = await SeedAsync(contexts.Valuation);
        await seed.AdoptAsync(Land, seed.LandA);
        await seed.AdoptAsync(Market, seed.LandB);

        var (refused, refusal) = await seed.Selections.CopyTableAsync(
            seed.RequestId, new CopyValuationComparableTableRequest { FromContext = Land, ToContext = Market }, User);
        Assert.Null(refused);
        Assert.Equal(ValuationComparableSelectionService.CopyTargetNotEmptyAr, refusal!["replace"]);
        Assert.Equal(
            [seed.LandB],
            contexts.Valuation.ValuationComparableSelections
                .Where(s => s.ValuationRequestId == seed.RequestId && s.SelectionContext == Market)
                .Select(s => s.ComparablePropertyId));

        var (replaced, errors) = await seed.Selections.CopyTableAsync(
            seed.RequestId,
            new CopyValuationComparableTableRequest { FromContext = Land, ToContext = Market, Replace = true },
            User);
        Assert.Null(errors);
        Assert.Equal(1, replaced!.CopiedCount);
        Assert.Equal(
            [seed.LandA],
            contexts.Valuation.ValuationComparableSelections
                .Where(s => s.ValuationRequestId == seed.RequestId && s.SelectionContext == Market)
                .Select(s => s.ComparablePropertyId));
    }

    [Fact]
    public async Task Nothing_adopted_in_the_source_copies_nothing_and_never_empties_the_target()
    {
        await using var contexts = TestDatabases.Create("copy-empty-source");
        var seed = await SeedAsync(contexts.Valuation);
        await seed.AdoptAsync(Market, seed.LandB);

        var (result, errors) = await seed.Selections.CopyTableAsync(
            seed.RequestId,
            new CopyValuationComparableTableRequest { FromContext = Land, ToContext = Market, Replace = true },
            User);

        Assert.Null(result);
        Assert.Equal(ValuationComparableSelectionService.CopyNothingToCopyAr, errors!["_"]);
        Assert.Single(contexts.Valuation.ValuationComparableSelections
            .Where(s => s.ValuationRequestId == seed.RequestId && s.SelectionContext == Market));
    }

    [Fact]
    public async Task The_same_table_and_an_unknown_table_are_refused()
    {
        await using var contexts = TestDatabases.Create("copy-bad-contexts");
        var seed = await SeedAsync(contexts.Valuation);
        await seed.AdoptAsync(Land, seed.LandA);

        var (_, same) = await seed.Selections.CopyTableAsync(
            seed.RequestId, new CopyValuationComparableTableRequest { FromContext = Land, ToContext = Land }, User);
        Assert.True(same!.ContainsKey("toContext"));

        var (_, unknown) = await seed.Selections.CopyTableAsync(
            seed.RequestId, new CopyValuationComparableTableRequest { FromContext = "xyz", ToContext = Market }, User);
        Assert.True(unknown!.ContainsKey("fromContext"));
    }

    internal sealed record Seed(
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
    internal static async Task<Seed> SeedAsync(
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

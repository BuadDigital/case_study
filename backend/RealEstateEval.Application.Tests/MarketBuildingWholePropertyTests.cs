using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Application.Rules;
using RealEstateEval.Valuation.Domain;
using RealEstateEval.Valuation.Infrastructure.Data.Contexts;
using RealEstateEval.Valuation.Infrastructure.Services;
using Proxy = RealEstateEval.Application.Tests.ValuationSettingsAndPriorBankFeedTests.Proxy;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// 2026-10-29 ruling: a building compared with buildings is the market approach for the whole property —
/// its price includes its land, which is not mentioned. The market table opens on the whole-property
/// basis for a building, its header area is the floor area, and nothing on the land side reads it.
/// Any land valued on its own enters the land bank; the building enters as a building comparable.
/// </summary>
public class MarketBuildingWholePropertyTests
{
    [Theory]
    [InlineData("فيلا", null, MarketAdjustmentBasisKeys.WholeProperty)]
    [InlineData("عمارة", CostScopeKeys.LandAndBuilding, MarketAdjustmentBasisKeys.WholeProperty)]
    [InlineData("شقة سكنية", null, MarketAdjustmentBasisKeys.WholeProperty)]
    [InlineData("مستودع", CostScopeKeys.BuildingOnly, MarketAdjustmentBasisKeys.WholeProperty)]
    [InlineData("أرض سكنية", null, MarketAdjustmentBasisKeys.PricePerSqm)]
    [InlineData("ارض تجارية", CostScopeKeys.LandAndBuilding, MarketAdjustmentBasisKeys.PricePerSqm)]
    // A derelict villa valued as land is compared with land.
    [InlineData("فيلا", CostScopeKeys.LandOnly, MarketAdjustmentBasisKeys.PricePerSqm)]
    public void A_new_market_table_opens_on_whole_property_for_a_building(
        string propertyType, string? scope, string expected)
    {
        Assert.Equal(expected, MarketAdjustmentBasisKeys.DefaultFor(propertyType, scope));

        var header = ValuationComparableSelectionRequestRules.SeedMarketApproach(
            Guid.NewGuid(), new OrganizationValuationSettingsDto(), propertyType, scope);
        Assert.Equal(expected, header.AdjustmentBasis);
    }

    [Fact]
    public void A_built_subject_never_takes_the_land_table_area_from_the_market_header()
    {
        // The header holds the floor area (820) — the land table waits for the saved plot.
        Assert.Null(CostApproachRules.LandTableSubjectAreaSqm(null, null, 820m, headerIsLandArea: false));
        Assert.Equal(600m, CostApproachRules.LandTableSubjectAreaSqm(600m, null, 820m, headerIsLandArea: false));
        // Land keeps its header (its deed area) as before.
        Assert.Equal(450m, CostApproachRules.LandTableSubjectAreaSqm(null, null, 450m));
    }

    [Fact]
    public void A_building_enters_the_bank_by_its_floor_area_or_not_at_all()
    {
        Assert.Equal(820m, PriorValuationBankRules.SubjectAreaSqm("عمارة", "600", 820m, subjectIsLand: false));
        // No floor area on the header: never the deed's land area.
        Assert.Equal(0m, PriorValuationBankRules.SubjectAreaSqm("عمارة", "600", null, subjectIsLand: false));
        Assert.Equal(600m, PriorValuationBankRules.SubjectAreaSqm("أرض", "600", null, subjectIsLand: true));
        Assert.Equal("مبنى", PriorValuationBankRules.BuildingComparableType("أرض تجارية"));
        Assert.Equal("عمارة", PriorValuationBankRules.BuildingComparableType("عمارة"));
        // A land deed names its building from the inventory: the largest floor line that is a building.
        Assert.Equal("مستودع", PriorValuationBankRules.BuildingComparableType(
            "أرض تجارية",
            [Line(BuildingStructureKinds.Floor, "200", "مكتب الحارس"), Line(BuildingStructureKinds.Floor, "1000", "المستودع الرئيسي")]));
        Assert.Equal("معرض", PriorValuationBankRules.BuildingComparableType(
            "أرض", [Line(BuildingStructureKinds.Floor, "300", "مساحة المعرض")]));
        Assert.Equal("مبنى", PriorValuationBankRules.BuildingComparableType(
            "أرض", [Line(BuildingStructureKinds.Floor, "300", "الدور الأرضي")]));
    }

    [Fact]
    public void A_floor_annex_or_basement_with_an_area_is_a_building_a_fence_is_not()
    {
        Assert.True(PriorValuationBankRules.HasFloorArea([Line(BuildingStructureKinds.Floor, "1000")]));
        Assert.True(PriorValuationBankRules.HasFloorArea([Line(BuildingStructureKinds.Annex, "٤٠")]));
        Assert.False(PriorValuationBankRules.HasFloorArea([Line(BuildingStructureKinds.Fence, "120")]));
        Assert.False(PriorValuationBankRules.HasFloorArea([Line(BuildingStructureKinds.Floor, "")]));
        Assert.False(PriorValuationBankRules.HasFloorArea(null));
    }

    [Fact]
    public async Task Commercial_land_with_a_warehouse_feeds_its_land_and_its_building()
    {
        await using var contexts = TestDatabases.Create("prior-bank-land-and-building");
        var db = contexts.Valuation;
        var propertyId = Guid.NewGuid();
        var id = NewRequest(db, propertyId, CostScopeKeys.LandAndBuilding);
        await db.SaveChangesAsync();

        Assert.True(await Feeder(db, marketHeaderArea: 1_000m, landRate: 2_400m, plot: 1_500m).FeedAsync(id));

        db.ChangeTracker.Clear();
        var rows = db.ComparableProperties.Where(c => c.SourcePropertyId == propertyId).ToList();
        var building = Assert.Single(rows, r => r.ComparablePropertyType == "مستودع");
        Assert.Equal(1_000m, building.AreaSqm);
        Assert.Equal(3_372_000m, building.Price);
        Assert.Equal(3_372m, building.PricePerSqm);
        var land = Assert.Single(rows, r => r.ComparablePropertyType == "أرض");
        Assert.Equal(1_500m, land.AreaSqm);
        Assert.Equal(2_400m, land.PricePerSqm);
        Assert.Equal(3_600_000m, land.Price);
    }

    [Fact]
    public async Task The_same_deed_valued_as_land_only_feeds_one_land_row_and_retires_the_building()
    {
        await using var contexts = TestDatabases.Create("prior-bank-land-only-again");
        var db = contexts.Valuation;
        var propertyId = Guid.NewGuid();
        var id = NewRequest(db, propertyId, CostScopeKeys.LandAndBuilding);
        await db.SaveChangesAsync();
        Assert.True(await Feeder(db, marketHeaderArea: 1_000m, landRate: 2_400m, plot: 1_500m).FeedAsync(id));

        var settings = db.ValuationApproachSettings.Single(s => s.ValuationRequestId == id);
        settings.CostScopeKey = CostScopeKeys.LandOnly;
        await db.SaveChangesAsync();
        Assert.True(await Feeder(db, marketHeaderArea: 1_500m, landRate: 0m, plot: 0m).FeedAsync(id));

        db.ChangeTracker.Clear();
        var active = db.ComparableProperties.Where(c => c.SourcePropertyId == propertyId && c.IsActive).ToList();
        var land = Assert.Single(active);
        Assert.Equal("أرض", land.ComparablePropertyType);
        Assert.Equal(1_500m, land.AreaSqm);
        Assert.Equal(3_372_000m, land.Price);
    }

    private static CaseStudyBuildingInventoryLineDto Line(string kind, string? area, string? label = null) =>
        new() { StructureKind = kind, Label = label ?? kind, AreaSqm = area };

    private static Guid NewRequest(ValuationDbContext db, Guid propertyId, string scope)
    {
        var id = Guid.NewGuid();
        db.ValuationRequests.Add(ValuationRequest.Create(
            id, "VR-807", propertyId, "الرياض", "أرض تجارية", "مقيم", "2026-10-28", DateTime.UtcNow));
        db.ValuationApproachSettings.Add(new ValuationApproachSettings
        {
            Id = Guid.NewGuid(),
            ValuationRequestId = id,
            CostScopeKey = scope,
            CostApproachEnabled = true,
            ValuationPurposeKey = ValuationPurposeKeys.SalePurchase,
        });
        return id;
    }

    private static PriorValuationBankFeeder Feeder(
        ValuationDbContext db,
        decimal marketHeaderArea,
        decimal landRate,
        decimal plot)
    {
        var lookup = Proxy.Of<ICaseStudyLookup>((method, _) =>
            method.Name == nameof(ICaseStudyLookup.GetValuationPropertyContextAsync)
                ? Task.FromResult<CaseStudyValuationPropertyContextDto?>(new CaseStudyValuationPropertyContextDto
                {
                    PoNumber = "PO-AZ-2026-013",
                    City = "الرياض",
                    District = "السلي",
                    PropertyType = "أرض تجارية",
                    Area = "1500",
                    BuildingInventoryLines = [Line(BuildingStructureKinds.Floor, "1000", "المستودع")],
                    LatestWorkspace = new CaseStudyInspectionWorkspaceDto { MapLatitude = 24.6m, MapLongitude = 46.8m },
                })
                : null);
        var reconciliation = Proxy.Of<IValuationReconciliationService>((method, _) =>
            method.Name == nameof(IValuationReconciliationService.GetAsync)
                ? Task.FromResult<ValuationReconciliationDto?>(new ValuationReconciliationDto
                {
                    FinalOpinionValue = 3_372_000m,
                    BasisOfValueKey = BasisOfValueKeys.Market,
                })
                : null);
        var selections = Proxy.Of<IValuationComparableSelectionService>((method, args) =>
        {
            if (method.Name != nameof(IValuationComparableSelectionService.ListAsync)) return null;
            if (args?.Length == 2)
                return Task.FromResult<ValuationComparableSelectionListDto?>(
                    new ValuationComparableSelectionListDto { SubjectAreaSqm = marketHeaderArea });
            // The land table inside the cost approach: one adopted land comparable, the adjusted rate, the plot.
            return Task.FromResult<ValuationComparableSelectionListDto?>(new ValuationComparableSelectionListDto
            {
                SubjectAreaSqm = plot,
                WeightedPricePerSqm = landRate,
                Items = [new ValuationComparableSelectionDto { IsAdopted = true }],
            });
        });
        return new PriorValuationBankFeeder(
            db, lookup, reconciliation, selections, new FixedClock(new DateTimeOffset(2026, 10, 29, 9, 0, 0, TimeSpan.Zero)));
    }

    private sealed class FixedClock(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }
}

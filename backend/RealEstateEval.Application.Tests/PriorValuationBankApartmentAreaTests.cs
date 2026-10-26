using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Domain;
using RealEstateEval.Valuation.Infrastructure.Data.Contexts;
using RealEstateEval.Valuation.Infrastructure.Services;
using Xunit;
using Proxy = RealEstateEval.Application.Tests.ValuationSettingsAndPriorBankFeedTests.Proxy;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// Round-2 re-test (VR-542): the approved apartment entered the comparables bank with the building plot
/// as its area — 900 m² at 1,077.78 SAR/m² instead of its own 180 m² at about 5,389. A bank row carries
/// the subject's own figures: the apartment's own area and value, land the land figures.
/// </summary>
public class PriorValuationBankApartmentAreaTests
{
    [Fact]
    public void An_apartment_uses_its_own_deed_area_and_anything_else_the_market_area()
    {
        Assert.Equal(180m, PriorValuationBankRules.SubjectAreaSqm("شقة", "180", 900m));
        Assert.Equal(180m, PriorValuationBankRules.SubjectAreaSqm("شقة سكنية", "١٨٠", 900m));
        // No usable deed area: the market table's area is all there is.
        Assert.Equal(900m, PriorValuationBankRules.SubjectAreaSqm("شقة", "", 900m));
        Assert.Equal(450m, PriorValuationBankRules.SubjectAreaSqm("فيلا", "400", 450m));
        Assert.Equal(400m, PriorValuationBankRules.SubjectAreaSqm("أرض", "400", null));
        Assert.Equal(0m, PriorValuationBankRules.SubjectAreaSqm("فيلا", null, null));
    }

    [Fact]
    public async Task Vr542_enters_the_bank_at_180_m2_and_5388_89_per_m2()
    {
        await using var contexts = TestDatabases.Create("prior-bank-apartment");
        var db = contexts.Valuation;
        var propertyId = Guid.NewGuid();
        var id = Guid.NewGuid();
        db.ValuationRequests.Add(ValuationRequest.Create(
            id, "VR-542", propertyId, "الرياض", "شقة", "مقيم", "2026-10-26", DateTime.UtcNow));
        db.ValuationApproachSettings.Add(new ValuationApproachSettings
        {
            Id = Guid.NewGuid(),
            ValuationRequestId = id,
            CostScopeKey = CostScopeKeys.LandAndBuilding,
            ValuationPurposeKey = ValuationPurposeKeys.Sale,
        });
        await db.SaveChangesAsync();

        Assert.True(await Feeder(db, marketHeaderArea: 900m).FeedAsync(id));

        db.ChangeTracker.Clear();
        var row = Assert.Single(db.ComparableProperties.Where(c => c.SourcePropertyId == propertyId));
        Assert.Equal("شقة", row.ComparablePropertyType);
        Assert.Equal(180m, row.AreaSqm);
        Assert.Equal(970_000m, row.Price);
        Assert.Equal(5_388.89m, row.PricePerSqm);
    }

    private static PriorValuationBankFeeder Feeder(ValuationDbContext db, decimal marketHeaderArea)
    {
        var lookup = Proxy.Of<ICaseStudyLookup>((method, _) =>
            method.Name == nameof(ICaseStudyLookup.GetValuationPropertyContextAsync)
                ? Task.FromResult<CaseStudyValuationPropertyContextDto?>(new CaseStudyValuationPropertyContextDto
                {
                    PoNumber = "RT2-KAPT-1792995365444",
                    City = "الرياض",
                    District = "الصحافة",
                    PropertyType = "شقة",
                    Area = "180",
                    LatestWorkspace = new CaseStudyInspectionWorkspaceDto { MapLatitude = 24.804m, MapLongitude = 46.637m },
                })
                : null);
        var reconciliation = Proxy.Of<IValuationReconciliationService>((method, _) =>
            method.Name == nameof(IValuationReconciliationService.GetAsync)
                ? Task.FromResult<ValuationReconciliationDto?>(new ValuationReconciliationDto
                {
                    FinalOpinionValue = 970_000m,
                    BasisOfValueKey = BasisOfValueKeys.Market,
                })
                : null);
        var selections = Proxy.Of<IValuationComparableSelectionService>((method, args) =>
            method.Name == nameof(IValuationComparableSelectionService.ListAsync) && args?.Length == 2
                ? Task.FromResult<ValuationComparableSelectionListDto?>(new ValuationComparableSelectionListDto
                {
                    SubjectAreaSqm = marketHeaderArea,
                })
                : null);
        return new PriorValuationBankFeeder(
            db, lookup, reconciliation, selections, new FixedClock(new DateTimeOffset(2026, 10, 26, 9, 0, 0, TimeSpan.Zero)));
    }

    private sealed class FixedClock(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }
}

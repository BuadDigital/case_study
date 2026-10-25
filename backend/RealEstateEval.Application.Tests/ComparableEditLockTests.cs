using RealEstateEval.CaseStudy.Infrastructure.Persistence;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Application.Services;
using RealEstateEval.Valuation.Domain;
using RealEstateEval.Valuation.Infrastructure.Persistence;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// A valuation reads the bank row live: editing a comparable that a handed-over, approved or
/// deposited valuation adopted rewrote that valuation's value (1,010,000 → 2,110,000 in QA).
/// </summary>
public class ComparableEditLockTests
{
    [Fact]
    public async Task A_comparable_adopted_by_a_closed_valuation_cannot_be_edited()
    {
        var (service, comparableId) = Arrange(closed: true);

        var (result, errors) = await service.UpdateAsync(comparableId, Edit(price: 3_000_000m));

        Assert.Null(result);
        Assert.Equal(ComparablePropertyService.UsedByClosedValuationAr, errors!["_"]);
    }

    [Fact]
    public async Task A_comparable_used_only_by_an_open_valuation_can_still_be_edited()
    {
        var (service, comparableId) = Arrange(closed: false);

        var (result, errors) = await service.UpdateAsync(comparableId, Edit(price: 3_000_000m));

        Assert.Null(errors);
        Assert.Equal(3_000_000m, result!.Price);
    }

    private static UpsertComparablePropertyRequest Edit(decimal price) => new()
    {
        ComparablePropertyType = "أرض",
        TransactionKind = ComparableTransactionKinds.Offer,
        PriceDescription = ComparablePriceDescriptions.Som,
        Source = ComparableSources.Other,
        IntakeChannel = ComparableIntakeChannels.Office,
        District = "مشرف",
        TransactionDate = "2026-06-01",
        AreaSqm = 1_000m,
        Price = price,
        Latitude = 24.09m,
        Longitude = 47.27m,
    };

    private static (ComparablePropertyService Service, Guid ComparableId) Arrange(bool closed)
    {
        var contexts = TestDatabases.Create("comparable-edit-lock");
        var comparableId = Guid.NewGuid();
        contexts.Valuation.ComparableProperties.Add(new ComparableProperty
        {
            Id = comparableId,
            ReferenceCode = "CMP-LOCK0001",
            ComparablePropertyType = "أرض",
            TransactionKind = ComparableTransactionKinds.Offer,
            PriceDescription = ComparablePriceDescriptions.Som,
            Source = ComparableSources.Other,
            District = "مشرف",
            AreaSqm = 1_000m,
            Price = 1_000_000m,
            PricePerSqm = 1_000m,
            Latitude = 24.09m,
            Longitude = 47.27m,
            TransactionDate = new DateOnly(2026, 6, 1),
        });
        var requestId = Guid.NewGuid();
        contexts.Valuation.ValuationRequests.Add(ValuationRequest.Create(
            requestId, "VR-L1", Guid.NewGuid(), "الخرج", "أرض", "مقيم", "2026-06-25", DateTime.UtcNow));
        contexts.Valuation.ValuationComparableSelections.Add(new ValuationComparableSelection
        {
            Id = Guid.NewGuid(),
            ValuationRequestId = requestId,
            ComparablePropertyId = comparableId,
            IsAdopted = true,
        });
        contexts.Valuation.SaveChanges();

        var service = new ComparablePropertyService(
            new ComparablePropertyRepository(contexts.Valuation),
            new CaseStudyLookup(contexts.CaseStudy),
            freeze: new StubFreeze(closed ? requestId : null));
        return (service, comparableId);
    }

    private sealed class StubFreeze(Guid? closedRequestId) : IValuationReportFreezeGate
    {
        public Task<bool> IsFrozenAsync(Guid valuationRequestId, CancellationToken cancellationToken = default) =>
            Task.FromResult(valuationRequestId == closedRequestId);

        public Task<string?> GetFrozenMessageAsync(
            Guid valuationRequestId, Guid propertyId, CancellationToken cancellationToken = default) =>
            Task.FromResult(valuationRequestId == closedRequestId ? "مغلق" : null);
    }
}

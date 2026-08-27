using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Integration;
using RealEstateEval.Infrastructure.Services;
using RealEstateEval.Shared.Contracts;
using RealEstateEval.Valuation.Domain;
using RealEstateEval.Valuation.Infrastructure.Data.Contexts;
using RealEstateEval.Valuation.Infrastructure.Services;
using RealEstateEval.Valuation.Infrastructure.Integration;

namespace RealEstateEval.Application.Tests;

public class ValuationRequestServiceTests
{
    [Fact]
    public async Task RecordImpediment_marks_request_as_fail()
    {
        await using var db = CreateDb();
        var id = Guid.Parse("a1000001-0000-4000-8000-000000000001");
        db.ValuationRequests.Add(OpenRequest(id, "VR-500"));
        await db.SaveChangesAsync();

        var service = CreateService(db);

        var (result, error) = await service.RecordImpedimentAsync(
            id,
            new() { Reason = "تعذّر الوصول للعقار" });

        Assert.Null(error);
        Assert.NotNull(result);
        Assert.Equal("fail", result!.Status);

        var row = await db.ValuationRequests.SingleAsync();
        Assert.Equal(ValuationRequestStatus.Failed, row.Status);
    }

    [Fact]
    public async Task Create_numbers_the_request_and_queues_the_created_event()
    {
        await using var db = CreateDb();
        var service = CreateService(db);

        var (result, error) = await service.CreateAsync(new SaveValuationRequestRequest
        {
            PropId = Guid.NewGuid().ToString(),
            Area = "جدة",
            Type = "فيلا",
            Appraiser = "مقيم",
            Status = ValuationRequestStatuses.Progress,
            Date = "2026-07-29",
        });

        Assert.Null(error);
        Assert.NotNull(result);
        Assert.StartsWith("VR-", result!.DisplayId);
        Assert.Equal(IntegrationEventTypes.ValuationRequestCreated, (await db.OutboxMessages.SingleAsync()).EventType);
    }

    [Fact]
    public async Task GetOpenByProperty_matches_guid_format_variants()
    {
        await using var db = CreateDb();
        var propertyId = Guid.Parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
        db.ValuationRequests.Add(ValuationRequest.Create(
            Guid.Parse("a1000001-0000-4000-8000-000000000003"),
            "VR-510",
            propertyId.ToString("D"),
            "جدة",
            "فيلا",
            "مقيم",
            "2026-08-19",
            DateTime.UtcNow));
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var found = await service.GetOpenByPropertyAsync(propertyId.ToString("D").ToUpperInvariant());
        Assert.NotNull(found);
        Assert.Equal("VR-510", found!.DisplayId);
    }

    [Fact]
    public async Task EnsureOpen_returns_existing_without_creating_a_second()
    {
        await using var db = CreateDb();
        var propertyId = Guid.Parse("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
        db.ValuationRequests.Add(ValuationRequest.Create(
            Guid.Parse("a1000001-0000-4000-8000-000000000004"),
            "VR-511",
            propertyId.ToString("D"),
            "جدة",
            "فيلا",
            "مقيم",
            "2026-08-19",
            DateTime.UtcNow));
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var (result, error) = await service.EnsureOpenByPropertyAsync(new SaveValuationRequestRequest
        {
            PropId = propertyId.ToString("D"),
            Area = "جدة",
            Type = "فيلا",
            Appraiser = "مقيم",
            Status = ValuationRequestStatuses.Progress,
            Date = "2026-08-19",
        });

        Assert.Null(error);
        Assert.NotNull(result);
        Assert.Equal("VR-511", result!.DisplayId);
        Assert.Equal(1, await db.ValuationRequests.CountAsync());
    }

    [Fact]
    public async Task RecordImpediment_rejects_without_reason()
    {
        await using var db = CreateDb();
        var id = Guid.Parse("a1000001-0000-4000-8000-000000000002");
        db.ValuationRequests.Add(OpenRequest(id, "VR-501"));
        await db.SaveChangesAsync();

        var service = CreateService(db);

        var (result, error) = await service.RecordImpedimentAsync(
            id,
            new() { Reason = "   " });

        Assert.Equal("reason_required", error);
        Assert.Null(result);
    }

    private static ValuationRequest OpenRequest(Guid id, string displayId) =>
        ValuationRequest.Create(
            id,
            displayId,
            Guid.NewGuid().ToString(),
            "جدة",
            "فيلا",
            "مقيم",
            "2026-06-25",
            DateTime.UtcNow);

    private static ValuationDbContext CreateDb() => TestDatabases.Valuation("valuation-request");

 /// <summary>
 /// The Valuation context cannot read Case Study tables, so the PO number arrives through
 /// the owner interface.
 /// </summary>
    private static ValuationRequestService CreateService(ValuationDbContext db) =>
        new(
            db,
            new ValuationOutboxPublisher(db, NullLogger<ValuationOutboxPublisher>.Instance),
            new StubPoNumberLookup("PO-900"));

    private sealed class StubPoNumberLookup(string poNumber) : IPropertyPoNumberLookup
    {
        public Task<string> ResolveForPropertyAsync(
            string propertyId,
            CancellationToken cancellationToken = default) => Task.FromResult(poNumber);
    }
}

using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Integration;
using RealEstateEval.Infrastructure.Services;
using RealEstateEval.Shared.Contracts;

namespace RealEstateEval.Application.Tests;

public class ValuationRequestServiceTests
{
    [Fact]
    public async Task RecordImpediment_marks_request_as_fail()
    {
        await using var db = CreateDb();
        var id = Guid.Parse("a1000001-0000-4000-8000-000000000001");
        db.ValuationRequests.Add(new ValuationRequest
        {
            Id = id,
            DisplayId = "VR-500",
            PropertyId = Guid.NewGuid().ToString(),
            Area = "جدة",
            PropertyType = "فيلا",
            Appraiser = "مقيم",
            Status = "progress",
            RequestDate = "2026-06-25",
            UpdatedAtUtc = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();

        var service = new ValuationRequestService(
            db,
            new OutboxIntegrationEventPublisher(
                db,
                NullLogger<OutboxIntegrationEventPublisher>.Instance));

        var (result, error) = await service.RecordImpedimentAsync(
            id,
            new() { Reason = "تعذّر الوصول للعقار" });

        Assert.Null(error);
        Assert.NotNull(result);
        Assert.Equal("fail", result!.Status);

        var row = await db.ValuationRequests.SingleAsync();
        Assert.Equal("fail", row.Status);
    }

    [Fact]
    public async Task RecordImpediment_rejects_without_reason()
    {
        await using var db = CreateDb();
        var id = Guid.Parse("a1000001-0000-4000-8000-000000000002");
        db.ValuationRequests.Add(new ValuationRequest
        {
            Id = id,
            DisplayId = "VR-501",
            PropertyId = Guid.NewGuid().ToString(),
            Area = "جدة",
            PropertyType = "فيلا",
            Appraiser = "مقيم",
            Status = "progress",
            RequestDate = "2026-06-25",
            UpdatedAtUtc = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();

        var service = new ValuationRequestService(
            db,
            new OutboxIntegrationEventPublisher(
                db,
                NullLogger<OutboxIntegrationEventPublisher>.Instance));

        var (result, error) = await service.RecordImpedimentAsync(
            id,
            new() { Reason = "   " });

        Assert.Equal("reason_required", error);
        Assert.Null(result);
    }

    private static ApplicationDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase($"valuation-request-{Guid.NewGuid():N}")
            .Options;
        return new ApplicationDbContext(options);
    }
}

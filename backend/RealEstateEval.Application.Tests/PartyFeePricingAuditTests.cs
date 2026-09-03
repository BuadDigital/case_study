using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Services;
using RealEstateEval.Financial.Infrastructure.Data.Contexts;
using RealEstateEval.Financial.Application.Services;
using RealEstateEval.Financial.Infrastructure.Services;
using RealEstateEval.Financial.Domain;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// Pricing is configuration with direct financial effect. These tests prove that its tables,
/// tier schedules, and assignment sets leave deliberate before/after evidence attributed to the
/// actor, in the same context that commits the business change.
/// </summary>
public class PartyFeePricingAuditTests
{
    [Fact]
    public async Task Creating_a_table_records_the_actor_and_complete_after_snapshot()
    {
        await using var db = CreateDb();
        var service = TestPricing.Create(db);

        var created = await service.CreateAsync(
            new CreatePartyFeePricingTableRequest
            {
                Category = PartyFeePricingCategories.CourtVisit,
                Name = "عقد المراجعين",
            },
            actorId: "admin-1");

        var audit = await db.Set<AuditLog>().SingleAsync(a =>
            a.Action == "PRICING_TABLE_CREATED"
            && a.EntityId == created.Id.ToString());
        Assert.Equal("admin-1", audit.ActorId);
        Assert.Equal(nameof(PartyFeePricingTable), audit.EntityType);
        Assert.Equal("null", audit.BeforeJson);
        using var after = JsonDocument.Parse(audit.AfterJson);
        Assert.Equal("عقد المراجعين", after.RootElement.GetProperty("name").GetString());
        Assert.Equal(
            PartyFeePricingCategories.CourtVisit,
            after.RootElement.GetProperty("category").GetString());
    }

    [Fact]
    public async Task Replacing_tiers_records_the_old_and_new_schedules()
    {
        await using var db = CreateDb();
        var service = TestPricing.Create(db);
        await service.ListAsync();
        await service.SaveAsync(
            PartyFeePricingService.DefaultEngineeringTableId,
            EngineeringRequest((500m, 800m), (null, 1500m)),
            actorId: "pricing-admin");

        await service.SaveAsync(
            PartyFeePricingService.DefaultEngineeringTableId,
            EngineeringRequest((400m, 900m), (null, 1600m)),
            actorId: "pricing-admin");

        var audit = await db.Set<AuditLog>()
            .Where(a =>
                a.Action == "PRICING_TABLE_UPDATED"
                && a.EntityId == PartyFeePricingService.DefaultEngineeringTableId.ToString())
            .OrderByDescending(a => a.CreatedAtUtc)
            .FirstAsync();
        Assert.Equal("pricing-admin", audit.ActorId);

        using var before = JsonDocument.Parse(audit.BeforeJson);
        using var after = JsonDocument.Parse(audit.AfterJson);
        var oldTiers = before.RootElement.GetProperty("areaTiers");
        var newTiers = after.RootElement.GetProperty("areaTiers");
        Assert.Equal(800m, oldTiers[0].GetProperty("feeSar").GetDecimal());
        Assert.Equal(500m, oldTiers[0].GetProperty("maxAreaM2").GetDecimal());
        Assert.Equal(900m, newTiers[0].GetProperty("feeSar").GetDecimal());
        Assert.Equal(400m, newTiers[0].GetProperty("maxAreaM2").GetDecimal());
    }

    [Fact]
    public async Task Reassigning_parties_records_the_category_before_and_after()
    {
        await using var db = CreateDb();
        var service = TestPricing.Create(db);
        await service.ListAsync();
        var first = PartyFeePricingService.DefaultCourtVisitTableId;
        var second = await service.CreateAsync(
            new CreatePartyFeePricingTableRequest
            {
                Category = PartyFeePricingCategories.CourtVisit,
                Name = "ثانٍ",
            });
        await service.SetAssignmentsAsync(first, ["reviewer-1"], actorId: "admin-2");

        await service.SetAssignmentsAsync(
            second.Id,
            ["reviewer-1", "reviewer-2"],
            actorId: "admin-2");

        var audit = await db.Set<AuditLog>()
            .Where(a =>
                a.Action == "PRICING_ASSIGNMENTS_REPLACED"
                && a.EntityId == second.Id.ToString())
            .OrderByDescending(a => a.CreatedAtUtc)
            .FirstAsync();
        Assert.Equal("admin-2", audit.ActorId);
        using var before = JsonDocument.Parse(audit.BeforeJson);
        using var after = JsonDocument.Parse(audit.AfterJson);
        Assert.Contains(
            before.RootElement.EnumerateArray(),
            row => row.GetProperty("tableId").GetGuid() == first
                   && row.GetProperty("assigneeId").GetString() == "reviewer-1");
        Assert.Equal(
            ["reviewer-1", "reviewer-2"],
            after.RootElement.EnumerateArray()
                .Where(row => row.GetProperty("tableId").GetGuid() == second.Id)
                .Select(row => row.GetProperty("assigneeId").GetString()!)
                .ToArray());
    }

    private static PartyFeePricingDto EngineeringRequest(
        params (decimal? MaxAreaM2, decimal FeeSar)[] tiers) =>
        new()
        {
            Id = PartyFeePricingService.DefaultEngineeringTableId,
            Name = "افتراضي",
            AreaTiers = tiers
                .Select((tier, index) => new PartyFeePricingTierDto
                {
                    SortOrder = index,
                    MaxAreaM2 = tier.MaxAreaM2,
                    FeeSar = tier.FeeSar,
                })
                .ToList(),
        };

    private static FinancialDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<FinancialDbContext>()
            .UseInMemoryDatabase($"party-fee-pricing-audit-{Guid.NewGuid():N}")
            .Options);
}

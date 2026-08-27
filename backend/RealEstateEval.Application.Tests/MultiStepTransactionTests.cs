using Microsoft.EntityFrameworkCore;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Services;
using RealEstateEval.Financial.Infrastructure.Data.Contexts;
using RealEstateEval.Financial.Domain;
using RealEstateEval.Financial.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

public class MultiStepTransactionTests
{
    [Fact]
    public async Task Pricing_delete_of_active_table_promotes_another_in_one_save()
    {
        await using var db = CreateDb();
        var category = "engineering";
        var active = new PartyFeePricingTable
        {
            Id = Guid.NewGuid(),
            Category = category,
            Name = "Active",
            IsActive = true,
            UpdatedAtUtc = DateTime.UtcNow,
        };
        var standby = new PartyFeePricingTable
        {
            Id = Guid.NewGuid(),
            Category = category,
            Name = "Standby",
            IsActive = false,
            UpdatedAtUtc = DateTime.UtcNow,
        };
        db.PartyFeePricingTables.AddRange(active, standby);
        await db.SaveChangesAsync();

        var service = new PartyFeePricingService(db);
        Assert.True(await service.DeleteAsync(active.Id));

        Assert.False(await db.PartyFeePricingTables.AnyAsync(x => x.Id == active.Id));
        var promoted = await db.PartyFeePricingTables.AsNoTracking()
            .SingleAsync(x => x.Id == standby.Id);
        Assert.True(promoted.IsActive);
    }

    [Fact]
    public async Task Transaction_helper_runs_without_a_transaction_on_in_memory()
    {
        await using var db = CreateDb();
        var ran = false;

        await DbContextTransaction.ExecuteInTransactionAsync(
            db,
            _ =>
            {
                ran = true;
                return Task.CompletedTask;
            });

        Assert.True(ran);
    }

    private static FinancialDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<FinancialDbContext>()
            .UseInMemoryDatabase($"multi-step-tx-{Guid.NewGuid():N}")
            .Options;
        return new FinancialDbContext(options);
    }
}

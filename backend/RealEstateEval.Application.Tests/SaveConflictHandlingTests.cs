using Microsoft.EntityFrameworkCore;
using Npgsql;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Valuation.Domain;
using RealEstateEval.Valuation.Infrastructure.Data.Contexts;

namespace RealEstateEval.Application.Tests;

public class SaveConflictHandlingTests
{
    [Fact]
    public void Unique_violations_are_attributed_to_the_index_that_declared_the_rule()
    {
        var failure = new DbUpdateException(
            "insert failed",
            UniqueViolation(DatabaseIndexNames.ValuationRequestOpenPerProperty));

        Assert.True(PostgresErrors.IsUniqueViolation(
            failure,
            DatabaseIndexNames.ValuationRequestOpenPerProperty));
        Assert.False(PostgresErrors.IsUniqueViolation(
            failure,
            DatabaseIndexNames.ValuationRequestDisplayId));
    }

    [Fact]
    public void Other_database_failures_are_not_mistaken_for_a_lost_race()
    {
        var failure = new DbUpdateException(
            "insert failed",
            new PostgresException("boom", "ERROR", "ERROR", "23503"));

        Assert.Null(PostgresErrors.ViolatedUniqueIndex(failure));
    }

    [Fact]
    public async Task Rolling_back_a_failed_attempt_leaves_the_callers_own_work_pending()
    {
        await using var db = CreateDb();
        var stored = Row("VR-500", "property-1");
        db.ValuationRequests.Add(stored);
        await db.SaveChangesAsync();

 // What the caller staged before handing the context to a service.
        Assert.Equal(ValuationRequestTransition.Applied, stored.RecordImpediment(DateTime.UtcNow));
        var callerRow = Row("VR-501", "property-2");
        db.ValuationRequests.Add(callerRow);

        var checkpoint = ChangeTrackerCheckpoint.Capture(db);

 // What the service stages and then loses on a unique index.
        db.ValuationRequests.Add(Row("VR-502", "property-3"));
        var refreshed = await db.ValuationRequests.SingleAsync(x => x.DisplayId == "VR-500");
        checkpoint.Rollback();

        Assert.Equal(EntityState.Added, db.Entry(callerRow).State);
        Assert.Equal(EntityState.Modified, db.Entry(stored).State);
        Assert.Equal(ValuationRequestStatus.Failed, stored.Status);
        Assert.Same(stored, refreshed);
        Assert.DoesNotContain(
            db.ChangeTracker.Entries<ValuationRequest>(),
            entry => entry.Entity.DisplayId == "VR-502");

        await db.SaveChangesAsync();
        Assert.Equal(2, await db.ValuationRequests.CountAsync());
    }

    private static ValuationRequest Row(string displayId, string propertyId) =>
        ValuationRequest.Create(
            Guid.NewGuid(),
            displayId,
            propertyId,
            area: "",
            propertyType: "",
            appraiser: "",
            requestDate: "",
            DateTime.UtcNow);

    private static PostgresException UniqueViolation(string constraintName) =>
        new(
            "duplicate key value violates unique constraint",
            "ERROR",
            "ERROR",
            "23505",
            constraintName: constraintName);

    private static ValuationDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<ValuationDbContext>()
            .UseInMemoryDatabase($"save-conflict-{Guid.NewGuid():N}")
            .Options;
        return new ValuationDbContext(options);
    }
}

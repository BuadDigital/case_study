using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// The InMemory provider ignores indexes, so these assert the relational model that the
/// PostgreSQL migration is generated from.
/// </summary>
public class DatabaseIndexRulesTests
{
    [Fact]
    public void Assignee_and_creator_lookups_are_indexed()
    {
        using var db = CreateRelationalModel();

        Assert.NotNull(FindIndex(db, typeof(WorkflowTask), "AssigneeId"));
        Assert.NotNull(FindIndex(db, typeof(OperationsTask), "CreatedBy"));
        Assert.NotNull(FindIndex(db, typeof(OperationsTask), "PoNumber"));
    }

    [Fact]
    public void A_property_can_only_hold_one_open_valuation_request()
    {
        using var db = CreateRelationalModel();

        var index = FindIndex(db, typeof(ValuationRequest), "PropertyId");

        Assert.NotNull(index);
        Assert.True(index.IsUnique);
        Assert.Equal("\"Status\" <> 'done'", index.GetFilter());
        Assert.Equal(
            DatabaseIndexNames.ValuationRequestOpenPerProperty,
            index.GetDatabaseName());
    }

    [Fact]
    public void Valuation_display_ids_are_unique_and_drawn_from_a_sequence()
    {
        using var db = CreateRelationalModel();

        var index = FindIndex(db, typeof(ValuationRequest), "DisplayId");
        Assert.NotNull(index);
        Assert.True(index.IsUnique);

        var sequence = db.Model.FindSequence(
            DatabaseSequences.ValuationRequestDisplayId,
            DatabaseSchemas.Valuation);
        Assert.NotNull(sequence);
        Assert.Equal(DatabaseSequences.ValuationRequestDisplayIdStart, sequence.StartValue);
        Assert.Equal(1, sequence.IncrementBy);
    }

    [Fact]
    public void A_user_can_only_hold_one_unread_notification_per_source_event()
    {
        using var db = CreateRelationalModel();

        var index = FindIndex(db, typeof(UserNotification), "UserId", "SourceEvent");

        Assert.NotNull(index);
        Assert.True(index.IsUnique);
        Assert.Equal(
            "\"SourceEvent\" IS NOT NULL AND \"ReadAtUtc\" IS NULL",
            index.GetFilter());
        Assert.Equal(
            DatabaseIndexNames.UserNotificationUnreadSourceEvent,
            index.GetDatabaseName());
    }

    [Fact]
    public void Outbox_backlog_is_indexed_by_the_dispatcher_claim_order_only()
    {
        using var db = CreateRelationalModel();
        var outbox = db.Model.FindEntityType(typeof(OutboxMessage))!;

        var pending = outbox.GetIndexes().Single(index =>
            index.GetDatabaseName() == DatabaseIndexNames.OutboxPendingByCreatedAt);
        Assert.Equal(["CreatedAtUtc"], pending.Properties.Select(p => p.Name));
        Assert.Equal(
            "\"ProcessedAtUtc\" IS NULL AND \"DeadLetteredAtUtc\" IS NULL",
            pending.GetFilter());

        // The unfiltered composite it replaces indexed every message ever published.
        Assert.DoesNotContain(
            outbox.GetIndexes(),
            index => index.Properties.Count == 3
                && index.Properties[0].Name == "ProcessedAtUtc");
    }

    private static IIndex? FindIndex(DbContext db, Type entity, params string[] properties) =>
        db.Model.FindEntityType(entity)!.GetIndexes()
            .SingleOrDefault(index =>
                index.Properties.Select(p => p.Name).SequenceEqual(properties));

    private static ApplicationDbContext CreateRelationalModel()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql("Host=localhost;Database=model_only;Username=test;Password=test")
            .Options;
        return new ApplicationDbContext(options);
    }
}

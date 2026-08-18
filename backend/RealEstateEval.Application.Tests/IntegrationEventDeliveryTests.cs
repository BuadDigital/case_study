using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Integration;
using RealEstateEval.Shared.Contracts;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// Integration event delivery is at-least-once, so these cover the pieces that keep a
/// redelivered message from being applied twice.
/// </summary>
public class IntegrationEventDeliveryTests
{
    private const string Consumer = "test.consumer";

    [Fact]
    public async Task Inbox_claims_an_event_once()
    {
        await using var db = CreateDb();
        var inbox = CreateInbox(db);
        var eventId = Guid.NewGuid();

        var first = await inbox.TryBeginAsync(Consumer, eventId, "some.event.v1");
        var second = await inbox.TryBeginAsync(Consumer, eventId, "some.event.v1");

        Assert.True(first);
        Assert.False(second);
    }

    [Fact]
    public async Task Inbox_lets_each_consumer_handle_the_same_event()
    {
        await using var db = CreateDb();
        var inbox = CreateInbox(db);
        var eventId = Guid.NewGuid();

        Assert.True(await inbox.TryBeginAsync("consumer-a", eventId, "some.event.v1"));
        Assert.True(await inbox.TryBeginAsync("consumer-b", eventId, "some.event.v1"));
    }

    [Fact]
    public async Task Releasing_a_claim_allows_a_retry()
    {
        await using var db = CreateDb();
        var inbox = CreateInbox(db);
        var eventId = Guid.NewGuid();

        await inbox.TryBeginAsync(Consumer, eventId, "some.event.v1");
        await inbox.ReleaseAsync(Consumer, eventId);

        Assert.True(await inbox.TryBeginAsync(Consumer, eventId, "some.event.v1"));
    }

    [Fact]
    public async Task Releasing_an_unknown_claim_is_a_no_op()
    {
        await using var db = CreateDb();
        var inbox = CreateInbox(db);

        await inbox.ReleaseAsync(Consumer, Guid.NewGuid());

        Assert.Empty(await db.ProcessedIntegrationEvents.ToListAsync());
    }

    [Fact]
    public void Envelope_reader_reads_the_serialized_envelope()
    {
        var envelope = new IntegrationEventEnvelope<ValuationRequestCreatedPayload>(
            Guid.NewGuid(),
            IntegrationEventTypes.ValuationRequestCreated,
            DateTimeOffset.UtcNow,
            new ValuationRequestCreatedPayload("vr-1", Guid.NewGuid().ToString(), "PO-1"));

        var read = IntegrationEventEnvelopeReader.TryReadMetadata(
            JsonSerializer.Serialize(envelope),
            out var eventId,
            out var eventType);

        Assert.True(read);
        Assert.Equal(envelope.EventId, eventId);
        Assert.Equal(IntegrationEventTypes.ValuationRequestCreated, eventType);
    }

    [Fact]
    public void Envelope_reader_accepts_camel_case_payloads()
    {
        var id = Guid.NewGuid();
        var json = """{"eventId":"ID","eventType":"some.event.v1","payload":{}}"""
            .Replace("ID", id.ToString());

        Assert.True(IntegrationEventEnvelopeReader.TryReadMetadata(json, out var eventId, out var eventType));
        Assert.Equal(id, eventId);
        Assert.Equal("some.event.v1", eventType);
    }

    [Theory]
    [InlineData("not json at all")]
    [InlineData("[]")]
    [InlineData("""{"eventType":"some.event.v1"}""")]
    [InlineData("""{"eventId":"00000000-0000-0000-0000-000000000000","eventType":"a"}""")]
    [InlineData("""{"eventId":"not-a-guid","eventType":"a"}""")]
    [InlineData("""{"eventId":"6f9619ff-8b86-d011-b42d-00c04fc964ff"}""")]
    public void Envelope_reader_rejects_messages_it_cannot_deduplicate(string json)
    {
        Assert.False(IntegrationEventEnvelopeReader.TryReadMetadata(json, out _, out _));
    }

    private static IntegrationEventInbox CreateInbox(MessagingDbContext db) =>
        new(db, NullLogger<IntegrationEventInbox>.Instance);

    private static MessagingDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<MessagingDbContext>()
            .UseInMemoryDatabase($"event-delivery-{Guid.NewGuid():N}")
            .Options;
        return new MessagingDbContext(options);
    }
}

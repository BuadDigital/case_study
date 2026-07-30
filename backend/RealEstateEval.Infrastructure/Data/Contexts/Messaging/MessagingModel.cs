using Microsoft.EntityFrameworkCore;
using RealEstateEval.Domain;

namespace RealEstateEval.Infrastructure.Data.Contexts;

/// <summary>
/// The <c>messaging</c> schema mapping. Decision D5 makes the outbox per-producer and the
/// inbox per-consumer: every context that publishes maps <c>OutboxMessages</c> so a business
/// write and the event it raises land in one <c>SaveChanges</c>, and every context that
/// consumes maps <c>ProcessedIntegrationEvents</c> and owns the rows carrying its own
/// consumer name. These are the only tables allowed in more than one context.
/// </summary>
internal static class MessagingModel
{
    public static ModelBuilder ApplyOutboxModel(this ModelBuilder builder)
    {
        builder.Entity<OutboxMessage>(e =>
        {
            e.ToTable("OutboxMessages", DatabaseSchemas.Messaging);
            e.Property(x => x.EventType).HasMaxLength(128);
            e.Property(x => x.PayloadJson).HasColumnType("jsonb");
            e.Property(x => x.Error).HasMaxLength(2000);
            e.Property(x => x.LockedBy).HasMaxLength(128);
            e.HasIndex(x => x.ProcessedAtUtc);
            e.HasIndex(x => x.CreatedAtUtc);
            // Drives the dispatcher claim query: unprocessed, not dead-lettered, oldest first.
            // Partial so the index only ever holds the backlog instead of every message the
            // system has published, which also lets the claim read rows already in claim order.
            e.HasIndex(x => x.CreatedAtUtc, DatabaseIndexNames.OutboxPendingByCreatedAt)
                .HasFilter("\"ProcessedAtUtc\" IS NULL AND \"DeadLetteredAtUtc\" IS NULL");
        });

        return builder;
    }

    public static ModelBuilder ApplyInboxModel(this ModelBuilder builder)
    {
        builder.Entity<ProcessedIntegrationEvent>(e =>
        {
            e.ToTable("ProcessedIntegrationEvents", DatabaseSchemas.Messaging);
            // Composite key is the dedupe guarantee: the insert fails if the same consumer
            // already handled the event, which is how redelivery is detected.
            e.HasKey(x => new { x.Consumer, x.EventId });
            e.Property(x => x.Consumer).HasMaxLength(128);
            e.Property(x => x.EventType).HasMaxLength(128);
            e.HasIndex(x => x.ProcessedAtUtc);
        });

        return builder;
    }
}

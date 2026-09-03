using Microsoft.EntityFrameworkCore;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Infrastructure.Data.Contexts;

/// <summary>
/// The <c>messaging</c> schema mapping. makes the outbox per-producer and the
/// inbox per-consumer: every context that publishes maps <c>OutboxMessages</c> so a business
/// write and the event it raises land in one <c>SaveChanges</c>, and every context that
/// consumes maps <c>ProcessedIntegrationEvents</c> and owns the rows carrying its own
/// consumer name. These are the only tables allowed in more than one context.
/// <para>
/// Platform-owned notification / push tables (D3) are mapped here and by the legacy context
/// for transitional dual write until owner APIs replace them.
/// </para>
/// </summary>
// A8: public — owner contexts (incl. Valuation outbox mapping) live in context libraries.
public static class MessagingModel
{
    public static ModelBuilder ApplyOutboxModel(this ModelBuilder builder, bool ownsMigrations = true)
    {
        builder.Entity<OutboxMessage>(e =>
        {
            MapTable(e, "OutboxMessages", DatabaseSchemas.Messaging, ownsMigrations);
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

    public static ModelBuilder ApplyInboxModel(this ModelBuilder builder, bool ownsMigrations = true)
    {
        builder.Entity<ProcessedIntegrationEvent>(e =>
        {
            MapTable(e, "ProcessedIntegrationEvents", DatabaseSchemas.Messaging, ownsMigrations);
 // Composite key is the dedupe guarantee: the insert fails if the same consumer
 // already handled the event, which is how redelivery is detected.
            e.HasKey(x => new { x.Consumer, x.EventId });
            e.Property(x => x.Consumer).HasMaxLength(128);
            e.Property(x => x.EventType).HasMaxLength(128);
            e.HasIndex(x => x.ProcessedAtUtc);
        });

        return builder;
    }

    /// <summary>
    /// Durable HTTP command idempotency (ADR 0008). Same actor + method + path + key
    /// replays the stored response across instances.
    /// </summary>
    public static ModelBuilder ApplyCommandIdempotencyModel(
        this ModelBuilder builder,
        bool ownsMigrations = true)
    {
        builder.Entity<CommandIdempotencyRecord>(e =>
        {
            MapTable(e, "CommandIdempotencyRecords", DatabaseSchemas.Messaging, ownsMigrations);
            e.HasKey(x => new { x.ActorId, x.HttpMethod, x.RequestPath, x.IdempotencyKey });
            e.Property(x => x.ActorId).HasMaxLength(450);
            e.Property(x => x.HttpMethod).HasMaxLength(16);
            e.Property(x => x.RequestPath).HasMaxLength(512);
            e.Property(x => x.IdempotencyKey).HasMaxLength(128);
            e.Property(x => x.ContentType).HasMaxLength(128);
            e.Property(x => x.ResponseBody).HasColumnType("bytea");
            e.HasIndex(x => x.ExpiresAtUtc);
        });

        return builder;
    }

 /// <summary>
 /// Platform-owned in-app notification inbox and web-push rows (D3). Migration ownership is
 /// <see cref="MessagingDbContext"/>; legacy maps ExcludeFromMigrations for dual/transitional paths.
 /// </summary>
    public static ModelBuilder ApplyNotificationModel(
        this ModelBuilder builder,
        bool ownsMigrations = true)
    {
        builder.Entity<UserNotification>(e =>
        {
            MapTable(e, "UserNotifications", DatabaseSchemas.Messaging, ownsMigrations);
            e.Property(x => x.UserId).HasMaxLength(450);
            e.Property(x => x.Title).HasMaxLength(256);
            e.Property(x => x.Body).HasMaxLength(2000);
            e.Property(x => x.Href).HasMaxLength(512);
            e.Property(x => x.Tone).HasMaxLength(16);
            e.Property(x => x.Category).HasMaxLength(32);
            e.Property(x => x.EntityType).HasMaxLength(32);
            e.Property(x => x.EntityId).HasMaxLength(128);
            e.Property(x => x.Actor).HasMaxLength(256);
            e.Property(x => x.SourceEvent).HasMaxLength(256);
            e.HasIndex(x => new { x.UserId, x.CreatedAtUtc });
            e.HasIndex(x => new { x.UserId, x.ReadAtUtc });
 // Dedupe rule: a user never holds two unread notifications for the same source
 // event. Enforced here so concurrent deliveries of one event collide in the
 // database instead of both passing a check-then-insert probe.
            e.HasIndex(x => new { x.UserId, x.SourceEvent })
                .IsUnique()
                .HasFilter("\"SourceEvent\" IS NOT NULL AND \"ReadAtUtc\" IS NULL")
                .HasDatabaseName(DatabaseIndexNames.UserNotificationUnreadSourceEvent);
        });

        builder.Entity<PushSubscription>(e =>
        {
            MapTable(e, "PushSubscriptions", DatabaseSchemas.Messaging, ownsMigrations);
            e.Property(x => x.UserId).HasMaxLength(450);
            e.Property(x => x.Endpoint).HasMaxLength(1024);
            e.Property(x => x.P256dh).HasMaxLength(256);
            e.Property(x => x.Auth).HasMaxLength(64);
            e.Property(x => x.UserAgent).HasMaxLength(512);
            e.Property(x => x.DeviceLabel).HasMaxLength(128);
            e.Property(x => x.DisabledReason).HasMaxLength(128);
            e.HasIndex(x => x.Endpoint)
                .IsUnique()
                .HasDatabaseName(DatabaseIndexNames.PushSubscriptionEndpoint);
            e.HasIndex(x => new { x.UserId, x.DisabledAtUtc });
        });

        builder.Entity<PushPreference>(e =>
        {
            MapTable(e, "PushPreferences", DatabaseSchemas.Messaging, ownsMigrations);
            e.HasKey(x => x.UserId);
            e.Property(x => x.UserId).HasMaxLength(450);
        });

        return builder;
    }

 /// <summary>
 /// Full messaging model for <see cref="MessagingDbContext"/> (migration owner + Platform write path).
 /// </summary>
    public static ModelBuilder ApplyMessagingModel(this ModelBuilder builder, bool ownsMigrations = true) =>
        builder
            .ApplyOutboxModel(ownsMigrations)
            .ApplyInboxModel(ownsMigrations)
            .ApplyCommandIdempotencyModel(ownsMigrations)
            .ApplyNotificationModel(ownsMigrations);

    private static void MapTable<TEntity>(
        Microsoft.EntityFrameworkCore.Metadata.Builders.EntityTypeBuilder<TEntity> e,
        string table,
        string schema,
        bool ownsMigrations)
        where TEntity : class
    {
        if (ownsMigrations)
            e.ToTable(table, schema);
        else
            e.ToTable(table, schema, t => t.ExcludeFromMigrations());
    }
}

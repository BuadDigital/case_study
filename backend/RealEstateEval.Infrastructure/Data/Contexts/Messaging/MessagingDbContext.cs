using Microsoft.EntityFrameworkCore;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Infrastructure.Data.Contexts;

/// <summary>
/// Write context for Platform-owned notification / push tables and the messaging stream's
/// migration history. Also maps outbox/inbox so Platform
/// notification creates and their follow-up events stay in one <c>SaveChanges</c>.
/// <para>
/// Other producers still map <c>OutboxMessages</c> on their own contexts (Valuation).
/// The Case Study outbox dispatcher claims rows through this context against the dedicated
/// messaging database after the Phase 4 cutover.
/// </para>
/// </summary>
public sealed class MessagingDbContext(DbContextOptions<MessagingDbContext> options)
    : DbContext(options), IOutboxContext
{
    public DbSet<OutboxMessage> OutboxMessages => Set<OutboxMessage>();
    public DbSet<ProcessedIntegrationEvent> ProcessedIntegrationEvents =>
        Set<ProcessedIntegrationEvent>();
    public DbSet<CommandIdempotencyRecord> CommandIdempotencyRecords =>
        Set<CommandIdempotencyRecord>();
    public DbSet<UserNotification> UserNotifications => Set<UserNotification>();
    public DbSet<PushSubscription> PushSubscriptions => Set<PushSubscription>();
    public DbSet<PushPreference> PushPreferences => Set<PushPreference>();

    protected override void OnModelCreating(ModelBuilder builder) =>
        builder.ApplyMessagingModel();
}

using Microsoft.EntityFrameworkCore;
using RealEstateEval.Domain;

namespace RealEstateEval.Infrastructure.Data;

/// <summary>
/// A <c>DbContext</c> that owns the outbox rows its slice publishes (per-producer
/// outbox). The publisher writes through this so the event and the business change it
/// describes are saved in one transaction.
/// </summary>
public interface IOutboxContext
{
    DbSet<OutboxMessage> OutboxMessages { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}

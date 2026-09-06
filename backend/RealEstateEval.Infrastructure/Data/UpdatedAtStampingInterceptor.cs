using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using RealEstateEval.Domain;

namespace RealEstateEval.Infrastructure.Data;

/// <summary>
/// Stamps <see cref="ITrackUpdatedAt.UpdatedAtUtc"/> on every added or modified entity in the
/// unit of work, so mutable rows always say when they last changed without each service
/// remembering to do it. Registered on every bounded-context pool.
/// </summary>
public sealed class UpdatedAtStampingInterceptor(TimeProvider? time = null) : SaveChangesInterceptor
{
    private readonly TimeProvider _time = time ?? TimeProvider.System;

    public override InterceptionResult<int> SavingChanges(
        DbContextEventData eventData,
        InterceptionResult<int> result)
    {
        Stamp(eventData.Context);
        return base.SavingChanges(eventData, result);
    }

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData,
        InterceptionResult<int> result,
        CancellationToken cancellationToken = default)
    {
        Stamp(eventData.Context);
        return base.SavingChangesAsync(eventData, result, cancellationToken);
    }

    private void Stamp(DbContext? context)
    {
        if (context is null) return;
        var now = _time.GetUtcNow().UtcDateTime;
        foreach (var entry in context.ChangeTracker.Entries<ITrackUpdatedAt>())
        {
            if (entry.State is EntityState.Added or EntityState.Modified)
                entry.Entity.UpdatedAtUtc = now;
        }
    }
}

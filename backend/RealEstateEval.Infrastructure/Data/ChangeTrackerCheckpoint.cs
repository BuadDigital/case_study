using Microsoft.EntityFrameworkCore;

namespace RealEstateEval.Infrastructure.Data;

/// <summary>
/// Snapshot of the change tracker taken before a save that may lose a race on a unique
/// index. PostgreSQL rolls the failed statement back but EF keeps the pending entities, so
/// the next save would replay the same doomed INSERT. Rolling back to the checkpoint hands
/// the context back in the state the caller passed it in, leaving their own pending work
/// untouched.
/// </summary>
public sealed class ChangeTrackerCheckpoint
{
    private readonly DbContext _db;
    private readonly Dictionary<object, EntityState> _states;

    private ChangeTrackerCheckpoint(DbContext db, Dictionary<object, EntityState> states)
    {
        _db = db;
        _states = states;
    }

    public static ChangeTrackerCheckpoint Capture(DbContext db)
    {
        var states = new Dictionary<object, EntityState>(ReferenceEqualityComparer.Instance);
        foreach (var entry in db.ChangeTracker.Entries())
        {
            states[entry.Entity] = entry.State;
        }

        return new ChangeTrackerCheckpoint(db, states);
    }

    public void Rollback()
    {
        foreach (var entry in _db.ChangeTracker.Entries().ToList())
        {
            var captured = _states.TryGetValue(entry.Entity, out var state)
                ? state
                : EntityState.Detached;
            if (entry.State == captured) continue;

            if (captured == EntityState.Detached)
            {
                entry.State = EntityState.Detached;
                continue;
            }

 // Rows we edited (dedupe refresh) or removed (overflow trim) go back to the
 // values that were read from the database.
            entry.CurrentValues.SetValues(entry.OriginalValues);
            entry.State = captured;
        }
    }
}

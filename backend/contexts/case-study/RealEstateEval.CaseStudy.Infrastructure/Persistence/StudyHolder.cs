using Microsoft.EntityFrameworkCore;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;
using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Infrastructure.Persistence;

/// <summary>
/// Phase 4: one study per transaction. Every read or write of "the deed's
/// study" goes through here to land on the holder deed's case-study parent task. A deed without
/// a transaction row, or alone in its transaction, resolves to itself — nothing changes for the
/// ordinary property.
/// </summary>
internal static class StudyHolder
{
    /// <summary>The holder deed of the property's transaction (the property itself when alone / unknown).</summary>
    /// <remarks>
    /// How it works: calls <see cref="HolderPropertyMapAsync"/> with the one id and returns its entry.
    /// Edge cases: an unknown property, a deed without a transaction or alone in it returns the
    /// property id itself, so callers never need a null check.
    /// </remarks>
    public static async Task<Guid> HolderPropertyAsync(
        CaseStudyDbContext db,
        Guid propertyId,
        CancellationToken cancellationToken)
    {
        var map = await HolderPropertyMapAsync(db, [propertyId], cancellationToken);
        return map.GetValueOrDefault(propertyId, propertyId);
    }

    /// <summary>property id → holder property id, for every id given (missing ids map to themselves).</summary>
    /// <remarks>
    /// How it works: 1) seeds the map with every distinct id pointing at itself; 2) reads the
    /// transaction ids of those deeds; 3) loads those transactions with their deeds and each deed's
    /// work order; 4) asks <see cref="TransactionStudyRules.Holder"/> for the holder of each one and
    /// points every requested deed of that transaction at it. Read-only (no tracking).
    /// Edge cases: no ids → empty map with no query; a transaction with no live deed (holder null)
    /// leaves its deeds on themselves; a removed recorded holder falls back to the first live deed
    /// (rule in <see cref="TransactionStudyRules.Holder"/>).
    /// </remarks>
    public static async Task<Dictionary<Guid, Guid>> HolderPropertyMapAsync(
        CaseStudyDbContext db,
        IReadOnlyCollection<Guid> propertyIds,
        CancellationToken cancellationToken)
    {
        var result = propertyIds.Distinct().ToDictionary(id => id, id => id);
        if (result.Count == 0) return result;

        var ids = result.Keys.ToList();
        var transactionIds = await db.WorkOrderProperties.AsNoTracking()
            .Where(p => ids.Contains(p.Id))
            .Select(p => p.TransactionId)
            .Distinct()
            .ToListAsync(cancellationToken);
        if (transactionIds.Count == 0) return result;

        var transactions = await db.Transactions.AsNoTracking()
            .Include(t => t.Properties)
            .ThenInclude(p => p.WorkOrder)
            .Where(t => transactionIds.Contains(t.Id))
            .ToListAsync(cancellationToken);

        foreach (var transaction in transactions)
        {
            var holder = TransactionStudyRules.Holder(transaction);
            if (holder is null) continue;
            foreach (var deed in transaction.Properties)
            {
                if (result.ContainsKey(deed.Id)) result[deed.Id] = holder.Id;
            }
        }

        return result;
    }

    /// <summary>The live deeds of the property's transaction (the property alone when it has none).</summary>
    /// <remarks>
    /// How it works: reads the deed's TransactionId, then returns the ids of every deed of that
    /// transaction that is not removed.
    /// Edge cases: an unknown deed, or a deed whose TransactionId is Guid.Empty (test rows / old
    /// rows), returns just [propertyId] — before the Guid.Empty guard (fixed 2026-10-21) such a deed
    /// matched every other deed with an empty id and "the transaction" became all of them. An empty
    /// result (e.g. the deed itself removed) also falls back to [propertyId].
    /// </remarks>
    public static async Task<IReadOnlyList<Guid>> TransactionPropertyIdsAsync(
        CaseStudyDbContext db,
        Guid propertyId,
        CancellationToken cancellationToken)
    {
        var transactionId = await db.WorkOrderProperties.AsNoTracking()
            .Where(p => p.Id == propertyId)
            .Select(p => (Guid?)p.TransactionId)
            .FirstOrDefaultAsync(cancellationToken);
        if (transactionId is not Guid id || id == Guid.Empty) return [propertyId];
        var ids = await db.WorkOrderProperties.AsNoTracking()
            .Where(p => p.TransactionId == id && !p.IsRemoved)
            .Select(p => p.Id)
            .ToListAsync(cancellationToken);
        return ids.Count == 0 ? [propertyId] : ids;
    }

    /// <summary>The latest non-cancelled case-study parent task of a deed; null when it has none yet.</summary>
    /// <remarks>
    /// How it works: filters CaseStudyProperty tasks with no parent task on this property, skips
    /// cancelled ones, and takes the newest by CreatedAtUtc.
    /// Edge cases: a deed that was never distributed has no parent task yet → null.
    /// </remarks>
    public static Task<Guid?> ParentTaskIdForPropertyAsync(
        CaseStudyDbContext db,
        Guid propertyId,
        CancellationToken cancellationToken) =>
        db.WorkflowTasks.AsNoTracking()
            .Where(t => t.Kind == WorkflowTaskKind.CaseStudyProperty
                && t.ParentTaskId == null
                && t.PropertyId == propertyId
                && t.Status != WorkflowTaskStatus.Cancelled)
            .OrderByDescending(t => t.CreatedAtUtc)
            .Select(t => (Guid?)t.Id)
            .FirstOrDefaultAsync(cancellationToken);

    /// <summary>
    /// The case-study parent task that carries the study for the given case-study parent task:
    /// the holder deed's parent. The task itself when it has no property, no transaction, no
    /// sibling, or the holder has no parent task of its own.
    /// </summary>
    /// <remarks>
    /// How it works: calls <see cref="HolderTaskMapAsync"/> with the one id and returns its entry.
    /// Edge cases: never null — every fallback is the task id itself, so callers keep working on an
    /// ordinary single-deed property exactly as before phase 4.
    /// </remarks>
    public static async Task<Guid> HolderTaskAsync(
        CaseStudyDbContext db,
        Guid taskId,
        CancellationToken cancellationToken)
    {
        var map = await HolderTaskMapAsync(db, [taskId], cancellationToken);
        return map.GetValueOrDefault(taskId, taskId);
    }

    /// <summary>case-study parent task id → holder parent task id (unknown ids map to themselves).</summary>
    /// <remarks>
    /// How it works: 1) seeds the map id → id; 2) loads the given tasks that are case-study tasks with
    /// a property; 3) maps their properties to holder deeds via <see cref="HolderPropertyMapAsync"/>;
    /// 4) loads the holder deeds' non-cancelled top-level case-study tasks, newest first, keeping one
    /// per holder deed; 5) re-points every task whose deed is not the holder to that holder task.
    /// Edge cases: a task with no property, of another kind, or whose deed is the holder stays on
    /// itself; a holder deed not distributed yet (no parent task) leaves the folded task on itself
    /// rather than pointing at nothing.
    /// </remarks>
    public static async Task<Dictionary<Guid, Guid>> HolderTaskMapAsync(
        CaseStudyDbContext db,
        IReadOnlyCollection<Guid> taskIds,
        CancellationToken cancellationToken)
    {
        var result = taskIds.Distinct().ToDictionary(id => id, id => id);
        if (result.Count == 0) return result;

        var ids = result.Keys.ToList();
        var tasks = await db.WorkflowTasks.AsNoTracking()
            .Where(t => ids.Contains(t.Id) && t.Kind == WorkflowTaskKind.CaseStudyProperty && t.PropertyId != null)
            .Select(t => new { t.Id, PropertyId = t.PropertyId!.Value })
            .ToListAsync(cancellationToken);
        if (tasks.Count == 0) return result;

        var holderByProperty = await HolderPropertyMapAsync(db, tasks.Select(t => t.PropertyId).ToList(), cancellationToken);
        var holderProperties = holderByProperty.Values.Distinct().ToList();
        var holderTasks = await db.WorkflowTasks.AsNoTracking()
            .Where(t => t.Kind == WorkflowTaskKind.CaseStudyProperty
                && t.ParentTaskId == null
                && t.PropertyId != null
                && holderProperties.Contains(t.PropertyId.Value)
                && t.Status != WorkflowTaskStatus.Cancelled)
            .OrderByDescending(t => t.CreatedAtUtc)
            .Select(t => new { t.Id, PropertyId = t.PropertyId!.Value })
            .ToListAsync(cancellationToken);
        var holderTaskByProperty = holderTasks
            .GroupBy(t => t.PropertyId)
            .ToDictionary(g => g.Key, g => g.First().Id);

        foreach (var task in tasks)
        {
            var holderProperty = holderByProperty.GetValueOrDefault(task.PropertyId, task.PropertyId);
            if (holderProperty == task.PropertyId) continue;
            if (holderTaskByProperty.TryGetValue(holderProperty, out var holderTask))
                result[task.Id] = holderTask;
        }

        return result;
    }

    /// <summary>
    /// Of the given case-study parent task ids, those whose study (the holder's report) is issued.
    /// </summary>
    /// <remarks>
    /// How it works: maps each task to its holder task (<see cref="HolderTaskMapAsync"/>), reads the
    /// holder tasks that have a non-party-contribution report with status Issued, and returns every
    /// given task whose holder is in that set — so a folded deed reads as issued when the
    /// transaction's one study is issued.
    /// Edge cases: an empty input returns an empty set with no query; party-contribution rows never
    /// count as the study.
    /// </remarks>
    public static async Task<HashSet<Guid>> IssuedParentTaskIdsAsync(
        CaseStudyDbContext db,
        IReadOnlyCollection<Guid> parentTaskIds,
        CancellationToken cancellationToken)
    {
        if (parentTaskIds.Count == 0) return [];
        var holderByTask = await HolderTaskMapAsync(db, parentTaskIds, cancellationToken);
        var holderIds = holderByTask.Values.Distinct().ToList();
        var issued = await db.CaseStudyReports.AsNoTracking()
            .Where(r => holderIds.Contains(r.TaskId)
                && !r.IsPartyContribution
                && r.Status == CaseStudyReportStatuses.Issued)
            .Select(r => r.TaskId)
            .ToListAsync(cancellationToken);
        var issuedSet = issued.ToHashSet();
        return holderByTask.Where(kv => issuedSet.Contains(kv.Value)).Select(kv => kv.Key).ToHashSet();
    }
}

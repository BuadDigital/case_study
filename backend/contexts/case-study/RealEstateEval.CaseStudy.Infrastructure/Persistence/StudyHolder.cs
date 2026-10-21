using Microsoft.EntityFrameworkCore;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;
using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Infrastructure.Persistence;

/// <summary>
/// Phase 4 (decision 2026-10-18): one study per transaction. Every read or write of "the deed's
/// study" goes through here to land on the holder deed's case-study parent task. A deed without
/// a transaction row, or alone in its transaction, resolves to itself — nothing changes for the
/// ordinary property.
/// </summary>
internal static class StudyHolder
{
    /// <summary>The holder deed of the property's transaction (the property itself when alone / unknown).</summary>
    public static async Task<Guid> HolderPropertyAsync(
        CaseStudyDbContext db,
        Guid propertyId,
        CancellationToken cancellationToken)
    {
        var map = await HolderPropertyMapAsync(db, [propertyId], cancellationToken);
        return map.GetValueOrDefault(propertyId, propertyId);
    }

    /// <summary>property id → holder property id, for every id given (missing ids map to themselves).</summary>
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
    public static async Task<Guid> HolderTaskAsync(
        CaseStudyDbContext db,
        Guid taskId,
        CancellationToken cancellationToken)
    {
        var map = await HolderTaskMapAsync(db, [taskId], cancellationToken);
        return map.GetValueOrDefault(taskId, taskId);
    }

    /// <summary>case-study parent task id → holder parent task id (unknown ids map to themselves).</summary>
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

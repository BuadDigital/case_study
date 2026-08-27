using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Application.Rules;

namespace RealEstateEval.CaseStudy.Infrastructure.Services;

public sealed class WorkflowTaskSlotSynchronizer : IWorkflowTaskSlotSynchronizer
{
    private const WorkflowTaskKind CaseStudyPropertyKind = WorkflowTaskKind.CaseStudyProperty;

    private readonly ICaseStudyRepository _caseStudy;
    private readonly IWorkflowTaskQuery _query;
    private readonly TimeProvider _time;

    public WorkflowTaskSlotSynchronizer(ICaseStudyRepository caseStudy, IWorkflowTaskQuery query,
        TimeProvider? time = null)
    {
        _time = time ?? TimeProvider.System;

        _caseStudy = caseStudy;
        _query = query;
    }

    public async Task<IReadOnlyList<WorkflowTaskDto>> SyncFromWorkOrdersAsync(
        CancellationToken cancellationToken = default)
    {
 // Cache warm-up syncs can race each other on the same slot rows (xmin).
 // The competing sync writes the same derived state, so retry on a fresh
 // load and, if it still conflicts, return the current list instead of 409.
        const int maxAttempts = 3;
        for (var attempt = 1; attempt <= maxAttempts; attempt++)
        {
            try
            {
                return await SyncOnceAsync(cancellationToken);
            }
            catch (DbUpdateConcurrencyException)
            {
                _caseStudy.ChangeTracker.Clear();
            }
        }

        return await _query.ListAsync(cancellationToken: cancellationToken);
    }

    private async Task<IReadOnlyList<WorkflowTaskDto>> SyncOnceAsync(
        CancellationToken cancellationToken)
    {
        var orders = await _caseStudy.WorkOrders
            .Include(w => w.Properties)
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        var poNumbers = orders.Select(o => o.PoNumber).Distinct().ToList();
        var tracked = await _caseStudy.WorkflowTasks
            .Where(t => poNumbers.Contains(t.PoNumber))
            .ToListAsync(cancellationToken);

        foreach (var order in orders)
            SyncPoSlots(order, tracked);

        await _caseStudy.SaveChangesAsync(cancellationToken);
        return await _query.ListAsync(cancellationToken: cancellationToken);
    }

    public void SyncPoSlots(WorkOrder order, List<WorkflowTask> allTasks)
    {
        var poNumber = order.PoNumber.Trim();
        var expected = Math.Max(1, order.ExpectedPropertyCount);
        var assignmentLabel = AssignmentTypeLabels.ToLabel(order.AssignmentType);

        allTasks.RemoveAll(t =>
            t.Kind == CaseStudyPropertyKind &&
            t.PoNumber == poNumber &&
            t.PropertyOrdinal > expected &&
            t.PropertyId is null &&
            t.Phase == WorkflowTaskPhase.Enfath);

        var tasks = allTasks
            .Where(t => t.Kind == CaseStudyPropertyKind && t.PoNumber == poNumber)
            .ToList();
        var byOrdinal = tasks
            .GroupBy(t => t.PropertyOrdinal)
            .ToDictionary(
                g => g.Key,
                g => g.OrderBy(t => t.PropertyId.HasValue ? 0 : 1)
                    .ThenBy(t => t.CreatedAtUtc)
                    .First());

        for (var ord = 1; ord <= expected; ord++)
        {
            if (!byOrdinal.ContainsKey(ord))
            {
                var task = WorkflowTaskPhaseRules.NewSlotTask(
                    poNumber,
                    ord,
                    expected,
                    assignmentLabel,
                    WorkflowTaskMapper.SerializeDistribution(WorkflowTaskMapper.DefaultDistribution()),
                    _time.UtcNow());
                allTasks.Add(task);
                _caseStudy.WorkflowTasks.Add(task);
                byOrdinal[ord] = task;
            }
            else if (byOrdinal[ord].PropertyId is null)
            {
 // Only touch the row when something actually changed — unconditional
 // rewrites made every sync UPDATE every empty slot, so concurrent
 // syncs kept tripping the xmin concurrency check.
                var existing = byOrdinal[ord];
                var slotTitle = WorkflowTaskPhaseRules.SlotTaskTitle(poNumber, ord, expected);
                var slotNow = _time.UtcNow();
                if (existing.Title != slotTitle)
                    existing.Retitle(slotTitle, slotNow);
                if (existing.AssignmentType != assignmentLabel)
                    existing.SetAssignmentType(assignmentLabel, slotNow);
            }
        }

        tasks = allTasks
            .Where(t => t.Kind == CaseStudyPropertyKind && t.PoNumber == poNumber)
            .ToList();

        var removedPropertyIds = order.Properties
            .Where(p => p.IsRemoved)
            .Select(p => p.Id)
            .ToHashSet();
        foreach (var orphan in tasks.Where(t =>
                     t.PropertyId.HasValue && removedPropertyIds.Contains(t.PropertyId.Value)))
        {
            orphan.ResetToEmptySlot(
                WorkflowTaskPhaseRules.SlotTaskTitle(poNumber, orphan.PropertyOrdinal, expected),
                WorkflowTaskMapper.SerializeDistribution(WorkflowTaskMapper.DefaultDistribution()),
                _time.UtcNow());
        }

        var linkedIds = tasks
            .Where(t => t.PropertyId.HasValue)
            .Select(t => t.PropertyId!.Value)
            .ToHashSet();

        var liveOrdinal = 0;
        foreach (var prop in order.Properties.Where(p => !p.IsRemoved))
        {
            liveOrdinal++;
            if (linkedIds.Contains(prop.Id))
            {
                var linked = tasks.FirstOrDefault(t => t.PropertyId == prop.Id);
                if (linked is not null &&
                    linked.Phase is not (WorkflowTaskPhase.Done
                        or WorkflowTaskPhase.Obstruction
                        or WorkflowTaskPhase.CaseStudy
                        or WorkflowTaskPhase.Enfath))
                {
                    var targetPhase = WorkflowTaskPhaseRules.PhaseAfterEnfath(
                        PropertyIdentifierTypeLabels.ToApiValue(prop.IdentifierType),
                        prop.BourseDataCompleted);
                    if (linked.Phase != targetPhase)
                    {
                        linked.MoveToPhase(
                            targetPhase,
                            targetPhase == WorkflowTaskPhase.Distribution
                                ? $"توزيع الأطراف — {WorkflowTaskPhaseRules.FormatDeedDisplay(prop)}"
                                : WorkflowTaskPhaseRules.PropertyTaskTitle(prop.DeedNumber, poNumber),
                            _time.UtcNow());
                    }
                }
                continue;
            }

            var preferred = tasks.FirstOrDefault(t =>
                t.PropertyId is null && t.PropertyOrdinal == liveOrdinal);
            var slot = preferred ?? tasks
                .Where(t => t.PropertyId is null)
                .OrderBy(t => t.PropertyOrdinal)
                .FirstOrDefault();
            if (slot is null) continue;

            var linkNow = _time.UtcNow();
            slot.LinkProperty(
                prop.Id,
                WorkflowTaskPhaseRules.PhaseAfterEnfath(
                    PropertyIdentifierTypeLabels.ToApiValue(prop.IdentifierType),
                    prop.BourseDataCompleted),
                WorkflowTaskPhaseRules.PropertyTaskTitle(prop.DeedNumber, poNumber),
                linkNow);
            slot.SetAssignmentType(assignmentLabel, linkNow);
            linkedIds.Add(prop.Id);
        }
    }
}

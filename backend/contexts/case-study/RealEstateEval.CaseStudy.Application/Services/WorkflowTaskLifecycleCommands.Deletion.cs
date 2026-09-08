using RealEstateEval.CaseStudy.Application.Mapping;
using RealEstateEval.Application;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Application.Rules;

namespace RealEstateEval.CaseStudy.Application.Services;

/// <summary>
/// Deletions: a single case-study slot (with its property and cascade), every task of a PO,
/// and every task of one property on a PO.
/// </summary>
public sealed partial class WorkflowTaskLifecycleCommands
{
    public async Task<(bool Ok, IReadOnlyDictionary<string, string>? Errors)> DeleteCaseStudySlotAsync(
        Guid id,
        DeleteCaseStudySlotRequest request,
        CancellationToken cancellationToken = default)
    {
        var reason = WorkflowTaskLifecycleRules.NormalizeReason(request.Reason);
        var reasonError = WorkflowTaskLifecycleRules.ReasonError(
            reason,
            "سبب الحذف مطلوب",
            "سبب الحذف طويل جداً");
        if (reasonError is not null)
            return (false, reasonError);

        var task = await _db.GetTaskForUpdateAsync(id, cancellationToken);
        if (task is null) return (false, null);

        if (task.Kind != CaseStudyPropertyKind)
            return (false, Error("يمكن حذف مهام دراسة الحالة فقط"));

        if (task.Phase is WorkflowTaskPhase.Done or WorkflowTaskPhase.CaseStudy)
            return (false, Error("لا يمكن حذف معاملة أكملت دراسة الحالة"));

        var po = task.PoNumber.Trim();
        var order = await _db.GetWorkOrderWithPropertiesForUpdateAsync(po, cancellationToken);

        if (task.PropertyId is Guid propertyId && order is not null)
        {
            var prop = order.Properties.FirstOrDefault(p => p.Id == propertyId);
            if (prop is not null)
            {
                if (prop.IsRemoved)
                    return (false, Error("العقار محذوف مسبقاً"));

                prop.IsRemoved = true;
                prop.RemovalReason = reason;
                prop.RemovedAtUtc = _time.UtcNow();
            }
        }

        var allForPo = await _db.ListTasksForPoForUpdateAsync(po, cancellationToken);
        var toRemove = WorkflowTaskLifecycleRules.SlotCascadeTasks(allForPo, task);
        var displacedAssigneeIds = WorkflowTaskLifecycleRules.DistinctAssigneeIds(
            toRemove.Where(t => t.Id != task.Id));

        await _cascade.RemovePartySubmissionsForTasksAsync(
            toRemove.Select(t => t.Id).ToList(),
            cancellationToken);
        _db.RemoveTasks(toRemove);

        if (order is not null)
        {
            order.ExpectedPropertyCount = Math.Max(1, order.ExpectedPropertyCount - 1);
            var remaining = allForPo.Where(t => toRemove.All(r => r.Id != t.Id)).ToList();
            var excess = WorkflowTaskLifecycleRules.ExcessEmptySlots(remaining, order.ExpectedPropertyCount);
            if (excess.Count > 0)
            {
                await _cascade.RemovePartySubmissionsForTasksAsync(
                    excess.Select(t => t.Id).ToList(),
                    cancellationToken);
                _db.RemoveTasks(excess);
                remaining = remaining.Where(t => excess.All(e => e.Id != t.Id)).ToList();
            }

            _slots.SyncPoSlots(order, remaining);
        }

        await _db.SaveChangesAsync(cancellationToken);

        await NotifyDisplacedAssigneesAsync(
            displacedAssigneeIds,
            $"حُذف العقار على {po} — أُلغي إسنادك عليه.",
            task.Id,
            $"case-study-slot-deleted:{task.Id}",
            cancellationToken);

        return (true, null);
    }

    public async Task DeleteForPoAsync(
        string poNumber,
        CancellationToken cancellationToken = default)
    {
        var n = poNumber.Trim();
        var tasks = await _db.ListTasksForPoForUpdateAsync(n, cancellationToken);
        var taskIds = tasks.Select(t => t.Id).ToList();
        if (taskIds.Count > 0)
        {
            var subs = await _db.ListSubmissionsForUpdateAsync(taskIds, cancellationToken);
            if (subs.Count > 0)
            {
                var inspectionTaskIds = WorkflowTaskLifecycleRules.FieldInspectionTaskIds(subs);
                if (inspectionTaskIds.Count > 0)
                {
                    await _db.DeleteFieldInspectionWorkspacesAsync(
                        inspectionTaskIds,
                        cancellationToken);
                }

                await _inspectorFees.DeleteForWorkflowTaskIdsAsync(taskIds, cancellationToken);

                _db.RemoveSubmissions(subs);
            }
        }
        _db.RemoveTasks(tasks);
        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task DeleteForPropertyAsync(
        string poNumber,
        Guid propertyId,
        int expectedPropertyCount = 1,
        CancellationToken cancellationToken = default)
    {
        var nPo = poNumber.Trim();
        var list = await _db.ListTasksForPoForUpdateAsync(nPo, cancellationToken);

        var linked = WorkflowTaskLifecycleRules.LinkedSlot(list, propertyId);
        var toRemove = WorkflowTaskLifecycleRules.PropertyCascadeTasks(list, propertyId, linked);
        await _cascade.RemovePartySubmissionsForTasksAsync(
            toRemove.Select(t => t.Id).ToList(),
            cancellationToken);
        _db.RemoveTasks(toRemove);

        if (linked is not null)
        {
            linked.ResetToEmptySlot(
                WorkflowTaskPhaseRules.SlotTaskTitle(
                    nPo,
                    linked.PropertyOrdinal,
                    Math.Max(1, expectedPropertyCount)),
                WorkflowTaskMapper.SerializeDistribution(WorkflowTaskMapper.DefaultDistribution()),
                _time.UtcNow());
        }

        await _db.SaveChangesAsync(cancellationToken);
    }
}

using RealEstateEval.CaseStudy.Application.Mapping;
using RealEstateEval.Application;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Application.Rules;

namespace RealEstateEval.CaseStudy.Application.Services;

/// <summary>
/// Phase revert: sends a case-study slot back to Enfath / Bourse, clearing bourse data and,
/// from distribution, the spawned party children (whose assignees are told).
/// </summary>
public sealed partial class WorkflowTaskLifecycleCommands
{
    public async Task<(WorkflowTaskDto? Result, IReadOnlyDictionary<string, string>? Errors)> RevertPhaseAsync(
        Guid id,
        RevertWorkflowTaskPhaseRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!WorkflowTaskLifecycleRules.TryParseRevertTarget(request.TargetPhase, out var target))
        {
            return (null, new Dictionary<string, string>
            {
                ["targetPhase"] = "المرحلة المستهدفة يجب أن تكون البيانات الأولية أو استعلام البورصة",
            });
        }

        var entity = await _db.GetTaskForUpdateAsync(id, cancellationToken);
        if (entity is null) return (null, null);

        if (entity.Kind != CaseStudyPropertyKind)
            return (null, Error("يمكن إرجاع مهام دراسة الحالة فقط"));

        if (entity.IsTerminal || entity.Phase is WorkflowTaskPhase.Done or WorkflowTaskPhase.CaseStudy)
            return (null, Error("لا يمكن إرجاع هذه المعاملة — أكملت دراسة الحالة أو أُغلقت"));

        var current = entity.Phase;
        if (!entity.CanRevertTo(target))
            return (null, Error("لا يمكن الإرجاع إلى هذه المرحلة من المرحلة الحالية"));

        if (entity.PropertyId is Guid propertyId)
        {
            var property = await _db.GetPropertyForUpdateAsync(propertyId, cancellationToken);
            if (property is null || property.IsRemoved)
                return (null, Error("لا يمكن إرجاع معاملة لعقار محذوف أو غير موجود"));

            property.BourseDataCompleted = false;
            property.BourseCompletedAtUtc = null;
        }

        var displacedAssigneeIds = new List<string>();
        if (current == WorkflowTaskPhase.Distribution)
        {
            entity.SetDistribution(
                WorkflowTaskMapper.SerializeDistribution(WorkflowTaskMapper.DefaultDistribution()),
                _time.UtcNow());

            var children = await _db.ListChildrenForUpdateAsync(entity.Id, cancellationToken);
            if (children.Count > 0)
            {
                displacedAssigneeIds = WorkflowTaskLifecycleRules.DistinctAssigneeIds(children);
                await _cascade.RemovePartySubmissionsForTasksAsync(
                    children.Select(c => c.Id).ToList(),
                    cancellationToken);
                _db.RemoveTasks(children);
            }
        }

        var po = entity.PoNumber.Trim();
        var deed = "";
        if (entity.PropertyId is Guid pid)
        {
            var prop = await _db.GetPropertyAsync(pid, cancellationToken);
            deed = prop?.DeedNumber?.Trim() ?? "";
        }

        entity.RevertToPhase(
            target,
            WorkflowTaskPhaseRules.PropertyTaskTitle(deed, po),
            _time.UtcNow());
        await _db.SaveChangesAsync(cancellationToken);

        if (entity.PropertyId is Guid timelinePropertyId)
        {
            await _timeline.RecordAsync(
                entity.PoNumber,
                timelinePropertyId,
                $"task:{entity.Id}:phase-revert:{target.ToDbValue()}",
                WorkflowTaskLifecycleRules.RevertTimelineLabel(target),
                null,
                PropertyTimelineTones.Active,
                entity.UpdatedAtUtc,
                cancellationToken);
        }

        await NotifyDisplacedAssigneesAsync(
            displacedAssigneeIds,
            $"أُعيدت المعاملة على {po} لمرحلة سابقة — أُلغي إسنادك على هذا العقار.",
            entity.Id,
            $"case-study-phase-reverted:{entity.Id}:{entity.UpdatedAtUtc:O}",
            cancellationToken);

        return (WorkflowTaskMapper.ToDto(entity), null);
    }
}

using RealEstateEval.CaseStudy.Application.Mapping;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Rules;

namespace RealEstateEval.CaseStudy.Application.Services;

public sealed partial class WorkflowTaskLifecycleCommands : IWorkflowTaskLifecycleCommands
{
    private const WorkflowTaskKind CaseStudyPropertyKind = WorkflowTaskKind.CaseStudyProperty;

    private readonly IWorkflowTaskLifecycleRepository _db;
    private readonly IInspectorFeeService _inspectorFees;
    private readonly IPropertyTimelineService _timeline;
    private readonly IWorkflowTaskCascadeCleanup _cascade;
    private readonly IWorkflowTaskSlotSynchronizer _slots;
    private readonly INotificationService _notifications;
    private readonly INotificationRecipientResolver _recipients;
    private readonly TimeProvider _time;

    public WorkflowTaskLifecycleCommands(
        IWorkflowTaskLifecycleRepository db,
        IInspectorFeeService inspectorFees,
        IPropertyTimelineService timeline,
        IWorkflowTaskCascadeCleanup cascade,
        IWorkflowTaskSlotSynchronizer slots,
        INotificationService notifications,
        INotificationRecipientResolver recipients,
        TimeProvider? time = null)
    {
        _time = time ?? TimeProvider.System;

        _db = db;
        _inspectorFees = inspectorFees;
        _timeline = timeline;
        _cascade = cascade;
        _slots = slots;
        _notifications = notifications;
        _recipients = recipients;
    }

    private static Dictionary<string, string> Error(string message) => new() { ["_"] = message };

    private async Task NotifyAssigneeAsync(
        Guid taskId,
        string? assigneeId,
        string title,
        string body,
        string tone,
        string sourceEvent,
        CancellationToken cancellationToken)
    {
        var trimmedAssigneeId = assigneeId?.Trim();
        if (string.IsNullOrWhiteSpace(trimmedAssigneeId)) return;

        var userId = await _recipients.ResolveUserIdForDistributionAssigneeAsync(
            trimmedAssigneeId,
            cancellationToken);
        if (string.IsNullOrWhiteSpace(userId)) return;

        await _notifications.CreateForUserAsync(
            userId,
            new CreateUserNotificationRequest
            {
                Title = title,
                Body = body,
                Tone = tone,
                Href = $"/case-study/{Uri.EscapeDataString(taskId.ToString())}",
                Category = "workflow",
                EntityType = "task",
                EntityId = taskId.ToString(),
                SourceEvent = sourceEvent,
            },
            cancellationToken);
    }

    /// <summary>Tells every displaced party assignee that their assignment on the PO is gone.</summary>
    private async Task NotifyDisplacedAssigneesAsync(
        IReadOnlyCollection<string> displacedAssigneeIds,
        string body,
        Guid taskId,
        string sourceEvent,
        CancellationToken cancellationToken)
    {
        if (displacedAssigneeIds.Count == 0) return;

        var displacedUserIds = await _recipients.ResolveUserIdsForDistributionAssigneesAsync(
            displacedAssigneeIds,
            cancellationToken);
        if (displacedUserIds.Count == 0) return;

        await _notifications.CreateForUsersAsync(
            displacedUserIds.Values.Distinct(StringComparer.Ordinal).ToList(),
            new CreateUserNotificationRequest
            {
                Title = "أُلغي إسنادك",
                Body = body,
                Tone = "warn",
                Href = "/active-primary-data",
                Category = "workflow",
                EntityType = "task",
                EntityId = taskId.ToString(),
                SourceEvent = sourceEvent,
            },
            cancellationToken);
    }

    public async Task<WorkflowTaskDto?> AdvanceAfterEnfathAsync(
        Guid id,
        AdvanceTaskAfterEnfathRequest request,
        CancellationToken cancellationToken = default)
    {
        var entity = await _db.GetTaskForUpdateAsync(id, cancellationToken);
        if (entity is null) return null;

        var propertyId = Guid.TryParse(request.PropertyId, out var pid) ? pid : entity.PropertyId;
        if (propertyId is Guid advancePropertyId)
        {
            var prop = await _db.GetPropertyAsync(advancePropertyId, cancellationToken);
            if (prop is null || prop.IsRemoved) return null;
        }

        var phase = WorkflowTaskPhaseRules.PhaseAfterEnfath(request.IdentifierType, request.BourseDataCompleted);
        var deed = request.DeedNumber.Trim();
        var po = entity.PoNumber.Trim();
        entity.AdvanceAfterEnfath(
            propertyId,
            phase,
            phase == WorkflowTaskPhase.Distribution
                ? WorkflowTaskLifecycleRules.DistributionPhaseTitle(deed, po)
                : WorkflowTaskPhaseRules.PropertyTaskTitle(deed, po),
            _time.UtcNow());
        await _db.SaveChangesAsync(cancellationToken);
        return WorkflowTaskMapper.ToDto(entity);
    }

    public async Task<WorkflowTaskDto?> AdvanceAfterBourseAsync(
        Guid id,
        AdvanceTaskAfterBourseRequest request,
        CancellationToken cancellationToken = default)
    {
        var entity = await _db.GetTaskForUpdateAsync(id, cancellationToken);
        if (entity is null) return null;

        if (entity.Status == WorkflowTaskStatus.Blocked
            || entity.Phase == WorkflowTaskPhase.Obstruction)
        {
            return WorkflowTaskMapper.ToDto(entity);
        }

        if (entity.Phase != WorkflowTaskPhase.Bourse)
            return WorkflowTaskMapper.ToDto(entity);

        if (entity.PropertyId is Guid boursePropertyId)
        {
            var prop = await _db.GetPropertyAsync(boursePropertyId, cancellationToken);
            if (prop is null || prop.IsRemoved) return null;
            if (!prop.BourseDataCompleted)
                return WorkflowTaskMapper.ToDto(entity);
        }

        var deed = request.DeedNumber.Trim();
        var po = entity.PoNumber.Trim();
        entity.AdvanceAfterBourse(
            WorkflowTaskLifecycleRules.DistributionPhaseTitle(deed, po),
            _time.UtcNow());
        await _db.SaveChangesAsync(cancellationToken);

        if (entity.PropertyId is Guid propertyId)
        {
            await _timeline.RecordAsync(
                entity.PoNumber,
                propertyId,
                $"task:{entity.Id}:bourse-complete",
                "اكتمال استعلام البورصة",
                null,
                PropertyTimelineTones.Done,
                entity.UpdatedAtUtc,
                cancellationToken);
        }

        return WorkflowTaskMapper.ToDto(entity);
    }

    public async Task<WorkflowTaskDto?> PatchAsync(
        Guid id,
        PatchWorkflowTaskRequest request,
        CancellationToken cancellationToken = default)
    {
        var entity = await _db.GetTaskForUpdateAsync(id, cancellationToken);
        if (entity is null) return null;

        var wasCaseStudyCompleted = WorkflowTaskLifecycleRules.IsCompletedCaseStudy(entity);
        var wasBlocked = entity.Status == WorkflowTaskStatus.Blocked;
        var previousAssigneeId = entity.AssigneeId;

        entity.ApplyShellPatch(
            phase: WorkflowTaskPhaseValues.ParseOptional(request.Phase),
            status: request.Status is null ? null : WorkflowTaskStatusValues.Parse(request.Status),
            title: request.Title,
            assigneeRole: request.AssigneeRole,
            assigneeName: request.AssigneeName,
            assigneeId: request.AssigneeId,
            assigneeIdProvided: request.AssigneeId is not null,
            propertyId: string.IsNullOrWhiteSpace(request.PropertyId)
                ? null
                : Guid.Parse(request.PropertyId),
            propertyIdProvided: request.PropertyId is not null,
            obstructionReason: string.IsNullOrWhiteSpace(request.ObstructionReason)
                ? null
                : request.ObstructionReason,
            obstructionReasonProvided: request.ObstructionReason is not null,
            obstructionPriorPhase: WorkflowTaskPhaseValues.ParseOptional(request.ObstructionPriorPhase),
            obstructionPriorPhaseProvided: request.ObstructionPriorPhase is not null,
            distributionJson: request.Distribution is null
                ? null
                : WorkflowTaskMapper.SerializeDistribution(
                    WorkflowTaskPhaseRules.NormalizeDistribution(request.Distribution)),
            nowUtc: _time.UtcNow());
        await _db.SaveChangesAsync(cancellationToken);

        if (!wasCaseStudyCompleted
            && WorkflowTaskLifecycleRules.IsCompletedCaseStudy(entity)
            && entity.PropertyId is Guid feePropertyId)
        {
            await _inspectorFees.EnsureLedgersForPropertyAsync(feePropertyId, cancellationToken);
        }

        // Supervisor resolved an obstruction and handed the transaction back to
        // the specialist (or re-targeted it to a new one) — they had no way to
        // know it moved without a manual refresh before this.
        if (WorkflowTaskLifecycleRules.ShouldNotifySpecialistReturned(entity, wasBlocked, previousAssigneeId))
        {
            await NotifyAssigneeAsync(
                entity.Id,
                entity.AssigneeId,
                "معاملة أُعيدت إليك",
                "أُعيدت المعاملة إليك بعد معالجة التعذر — تابع دراسة الحالة.",
                "info",
                $"case-study-returned:{entity.Id}:{entity.UpdatedAtUtc:O}",
                cancellationToken);
        }

        return WorkflowTaskMapper.ToDto(entity);
    }

    public async Task<(WorkflowTaskDto? Result, IReadOnlyDictionary<string, string>? Errors)> ReopenCompletedAsync(
        Guid id,
        ReopenCompletedWorkflowTaskRequest request,
        string actorRole,
        string? actorName,
        CancellationToken cancellationToken = default)
    {
        if (!WorkflowTaskLifecycleRules.IsSectionSupervisorOrAbove(actorRole))
            return (null, Error("إعادة فتح المعاملة صلاحية مشرف القسم فأعلى"));

        var reason = WorkflowTaskLifecycleRules.NormalizeReason(request.Reason);
        var reasonError = WorkflowTaskLifecycleRules.ReasonError(
            reason,
            "سبب إعادة الفتح مطلوب",
            "السبب طويل جداً");
        if (reasonError is not null)
            return (null, reasonError);

        var entity = await _db.GetTaskForUpdateAsync(id, cancellationToken);
        if (entity is null) return (null, null);

        if (entity.Status != WorkflowTaskStatus.Completed)
            return (null, Error("لا يمكن إعادة فتح معاملة غير مكتملة"));

        entity.Reopen(_time.UtcNow());

        var detail = string.IsNullOrWhiteSpace(actorName) ? reason : $"{actorName}: {reason}";

        await _db.ExecuteInTransactionAsync(async ct =>
        {
            await _db.SaveChangesAsync(ct);

            if (entity.PropertyId is Guid propertyId)
            {
                await _timeline.RecordAsync(
                    entity.PoNumber,
                    propertyId,
                    $"task:{entity.Id}:reopened",
                    "إعادة فتح المعاملة",
                    detail,
                    PropertyTimelineTones.Active,
                    entity.UpdatedAtUtc,
                    ct);
            }
        }, cancellationToken);

        await NotifyAssigneeAsync(
            entity.Id,
            entity.AssigneeId,
            "أُعيدت فتح معاملتك",
            $"أعاد المشرف فتح المعاملة: {detail}",
            PropertyTimelineTones.Warn,
            $"case-study-reopened:{entity.Id}:{entity.UpdatedAtUtc:O}",
            cancellationToken);

        return (WorkflowTaskMapper.ToDto(entity), null);
    }
}

using RealEstateEval.CaseStudy.Application.Mapping;
using Microsoft.Extensions.DependencyInjection;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Application.Rules;

namespace RealEstateEval.CaseStudy.Application.Services;

public sealed partial class WorkflowTaskDistributionCommands : IWorkflowTaskDistributionCommands
{
    private const WorkflowTaskKind CaseStudyPropertyKind = WorkflowTaskKind.CaseStudyProperty;

    private readonly IWorkflowTaskDistributionRepository _caseStudy;
    private readonly ICaseStudyFailureGate _failureGate;
    private readonly INotificationService _notifications;
    private readonly INotificationRecipientResolver _recipients;
    private readonly IPropertyTimelineService _timeline;
    private readonly ICaseStudyValuationDispatchService _valuationDispatch;
    private readonly IAuditLogWriter _audit;
    private readonly IAuditLogAppend _auditLog;
    private readonly TimeProvider _time;

    [ActivatorUtilitiesConstructor]
    public WorkflowTaskDistributionCommands(
        IWorkflowTaskDistributionRepository caseStudy,
        ICaseStudyFailureGate failureGate,
        INotificationService notifications,
        INotificationRecipientResolver recipients,
        IPropertyTimelineService timeline,
        ICaseStudyValuationDispatchService valuationDispatch,
        IAuditLogWriter audit,
        IAuditLogAppend auditLog,
        TimeProvider? time = null)
    {
        _time = time ?? TimeProvider.System;

        _caseStudy = caseStudy;
        _failureGate = failureGate;
        _notifications = notifications;
        _recipients = recipients;
        _timeline = timeline;
        _valuationDispatch = valuationDispatch;
        _audit = audit;
        _auditLog = auditLog;
    }

    private static Dictionary<string, string> Error(string message) => new() { ["_"] = message };

    public async Task<WorkflowTaskDto?> PatchDistributionAsync(
        Guid id,
        TaskDistributionDraftDto distribution,
        CancellationToken cancellationToken = default)
    {
        var entity = await _caseStudy.GetTaskForUpdateAsync(id, cancellationToken);
        if (entity is null) return null;

        var normalized = WorkflowTaskPhaseRules.NormalizeDistribution(distribution);
        entity.SetDistribution(
            WorkflowTaskMapper.SerializeDistribution(normalized),
            _time.UtcNow());
        await _caseStudy.SaveChangesAsync(cancellationToken);
        return WorkflowTaskMapper.ToDto(entity);
    }

    public async Task<(ConfirmTaskDistributionResponseDto? Result, IReadOnlyDictionary<string, string>? Errors)>
        ConfirmDistributionAsync(
            Guid id,
            ConfirmTaskDistributionRequest request,
            string? actorUserId = null,
            CancellationToken cancellationToken = default)
    {
        var parent = await _caseStudy.GetTaskForUpdateAsync(id, cancellationToken);
        if (parent is null)
            return (null, Error("المهمة غير موجودة"));

        if (parent.Phase != WorkflowTaskPhase.Distribution)
            return (null, Error("المعاملة ليست في مرحلة التوزيع حالياً"));

        if (parent.PropertyId is null)
            return (null, Error("لا يوجد عقار مرتبط بمهمة التوزيع"));

        var confirmProperty = await _caseStudy.GetPropertyAsync(
            parent.PropertyId.Value,
            cancellationToken);
        if (confirmProperty is null || confirmProperty.IsRemoved)
            return (null, Error("لا يمكن توزيع معاملة لعقار محذوف أو غير موجود"));

        var propertyIdText = parent.PropertyId.Value.ToString();
        var hasBlockingFailure = await _failureGate.HasBlockingFailureAsync(
            parent.PoNumber,
            propertyIdText,
            cancellationToken);
        if (hasBlockingFailure)
            return (null, Error("لا يمكن توزيع المعاملة ما دام عليها تعذّر نشط"));

        var distribution = WorkflowTaskDistributionRules.ApplyConfirmDefaults(
            WorkflowTaskPhaseRules.NormalizeDistribution(request.Distribution),
            SurveyRequirementRules.PropertyRequiresSurvey(confirmProperty));

        var assigneeError = WorkflowTaskDistributionRules.ConfirmAssigneeError(distribution);
        if (assigneeError is not null)
            return (null, Error(assigneeError));

        var now = _time.UtcNow();
        var deed = request.DeedNumber.Trim();
        var names = request.AssigneeNames ?? new Dictionary<string, string>();

        var children = new List<WorkflowTask>();
        foreach (var spec in WorkflowTaskDistributionRules.PartyChildren(distribution))
        {
            if (!spec.Enabled) continue;
            children.Add(WorkflowTaskPhaseRules.SpawnChild(
                parent,
                spec.Kind,
                spec.Role,
                WorkflowTaskPhaseRules.ResolveName(names, spec.Kind, spec.FallbackName),
                spec.AssigneeId,
                deed,
                now));
        }

        if (distribution.CaseSpecialist)
        {
            parent.Assign(
                distribution.CaseSpecialistId,
                WorkflowTaskDistributionRules.ResolveSpecialistName(names),
                StaffRoleIds.CaseSpecialist,
                now);
        }

        parent.ConfirmDistribution(
            WorkflowTaskDistributionRules.ConfirmedParentTitle(deed, parent.PoNumber),
            WorkflowTaskMapper.SerializeDistribution(distribution),
            now);

        _caseStudy.AddTasks(children);
        await _caseStudy.SaveChangesAsync(cancellationToken);

        if (parent.PropertyId is Guid propertyId)
        {
            await _timeline.RecordManyAsync(
                WorkflowTaskDistributionRules.ConfirmTimelineEvents(
                    parent,
                    propertyId,
                    children,
                    distribution.CaseSpecialist,
                    now),
                cancellationToken);
        }

        await NotifyDistributionAssignedAsync(parent, children, deed, cancellationToken);
        if (distribution.CaseSpecialist)
            await NotifyCaseSpecialistAssignedAsync(parent, deed, cancellationToken);
        await NotifyCdoDistributionConfirmedAsync(parent, children, deed, cancellationToken);

        await _valuationDispatch.TryCreateWhenAppraisalSpawnedAsync(parent.Id, cancellationToken);

        await _auditLog.AppendAsync(_audit.Create(
            actorId: string.IsNullOrWhiteSpace(actorUserId) ? "unknown" : actorUserId.Trim(),
            action: "case-study.workflow-task.distribution-confirmed",
            entityType: "WorkflowTask",
            entityId: parent.Id.ToString("D"),
            before: new { phase = "Distribution" },
            after: new
            {
                phase = parent.Phase.ToString(),
                poNumber = parent.PoNumber,
                childCount = children.Count,
                childKinds = children.Select(c => c.Kind.ToString()).ToArray(),
            }), cancellationToken);

        return (new ConfirmTaskDistributionResponseDto
        {
            Parent = WorkflowTaskMapper.ToDto(parent),
            Children = children.Select(WorkflowTaskMapper.ToDto).ToList(),
        }, null);
    }

    public async Task<(WorkflowTaskDto? Result, IReadOnlyDictionary<string, string>? Errors)> RedistributePartiesAsync(
        Guid id,
        RedistributePartiesRequest request,
        string actorRole,
        string? actorName,
        string? actorUserId = null,
        CancellationToken cancellationToken = default)
    {
        if (!WorkflowTaskLifecycleRules.CanRedistributeParties(actorRole))
            return (null, Error("إعادة إسناد الأطراف صلاحية أخصائي دراسة الحالة أو مشرف القسم أو مسؤول التحول الرقمي"));

        var parent = await _caseStudy.GetTaskForUpdateAsync(id, cancellationToken);
        if (parent is null) return (null, null);

        if (parent.Kind != CaseStudyPropertyKind)
            return (null, Error("يمكن إعادة إسناد الأطراف لمعاملات دراسة الحالة فقط"));

        if (parent.Phase != WorkflowTaskPhase.CaseStudy)
            return (null, Error("إعادة إسناد الأطراف متاحة فقط بعد تأكيد التوزيع (مرحلة دراسة الحالة)"));

        var reason = WorkflowTaskLifecycleRules.NormalizeReason(request.Reason);
        var reasonError = WorkflowTaskLifecycleRules.ReasonError(
            reason,
            "سبب إعادة الإسناد مطلوب",
            "السبب طويل جداً");
        if (reasonError is not null)
            return (null, reasonError);

        var distribution = WorkflowTaskPhaseRules.NormalizeDistribution(request.Distribution);
        var names = request.AssigneeNames ?? new Dictionary<string, string>();

        var children = await _caseStudy.ListChildrenForUpdateAsync(parent.Id, cancellationToken);

        var now = _time.UtcNow();
        var changed = new List<WorkflowTask>();
        var replaced = new List<(WorkflowTask Child, string AssigneeId)>();
        var timelineEvents = new List<PropertyTimelineRecordRequest>();
        // Who held each seat before the change — the audit row shows the move, not just the result.
        var before = new Dictionary<string, object?>
        {
            ["caseSpecialist"] = new { id = parent.AssigneeId, name = parent.AssigneeName },
        };
        foreach (var c in children)
            before[c.Kind.ToString()] = new { id = c.AssigneeId, name = c.AssigneeName, status = c.Status.ToString() };

        if (distribution.CaseSpecialist)
        {
            var newAssigneeId = WorkflowTaskDistributionRules.NormalizeAssigneeId(distribution.CaseSpecialistId);
            if (!string.Equals(parent.AssigneeId, newAssigneeId, StringComparison.Ordinal))
            {
                var specialistName = WorkflowTaskDistributionRules.ResolveSpecialistName(names);
                parent.Assign(newAssigneeId, specialistName, StaffRoleIds.CaseSpecialist, now);
                if (parent.PropertyId is Guid propertyId)
                {
                    timelineEvents.Add(new PropertyTimelineRecordRequest(
                        parent.PoNumber,
                        propertyId,
                        $"task:{parent.Id}:specialist-redistributed:{now.Ticks}",
                        "إعادة إسناد — أخصائي دراسة الحالة",
                        WorkflowTaskDistributionRules.RedistributionDetail(actorName, specialistName, reason),
                        PropertyTimelineTones.Active,
                        now));
                }
            }
        }

        foreach (var spec in WorkflowTaskDistributionRules.PartyChildren(distribution))
        {
            if (!spec.Enabled) continue;

            var child = children.FirstOrDefault(c => c.Kind == spec.Kind);
            if (child is null) continue;

            var newAssigneeId = WorkflowTaskDistributionRules.NormalizeAssigneeId(spec.AssigneeId);
            if (string.Equals(child.AssigneeId, newAssigneeId, StringComparison.Ordinal)) continue;

            // Only open party work moves to someone else; a finished (or cancelled) task keeps the
            // name of whoever did it, and the caller is told instead of a silent no-op.
            if (child.Status != WorkflowTaskStatus.Open)
            {
                return (null, Error(
                    $"مهمة {WorkflowTaskKindLabels.RoleAr(child.Kind)} ليست مفتوحة — لا يمكن إعادة إسنادها بعد إنجازها أو إلغائها."));
            }

            var newName = WorkflowTaskPhaseRules.ResolveName(names, spec.Kind, spec.FallbackName);
            // Captured before Assign overwrites it — the outgoing party has to be told too.
            var replacedAssigneeId = child.AssigneeId?.Trim();
            child.Assign(newAssigneeId, newName, spec.Role, now);
            changed.Add(child);
            if (!string.IsNullOrWhiteSpace(replacedAssigneeId))
                replaced.Add((child, replacedAssigneeId));

            if (parent.PropertyId is Guid propertyId)
            {
                timelineEvents.Add(new PropertyTimelineRecordRequest(
                    parent.PoNumber,
                    propertyId,
                    $"party:{child.Id}:redistributed:{now.Ticks}",
                    $"إعادة إسناد — {WorkflowTaskKindLabels.RoleAr(child.Kind)}",
                    WorkflowTaskDistributionRules.RedistributionDetail(actorName, newName, reason),
                    PropertyTimelineTones.Active,
                    now));
            }
        }

        parent.SetDistribution(WorkflowTaskMapper.SerializeDistribution(distribution), now);
        await _caseStudy.SaveChangesAsync(cancellationToken);

        var after = new Dictionary<string, object?>
        {
            ["caseSpecialist"] = new { id = parent.AssigneeId, name = parent.AssigneeName },
        };
        foreach (var c in children)
            after[c.Kind.ToString()] = new { id = c.AssigneeId, name = c.AssigneeName, status = c.Status.ToString() };
        await _auditLog.AppendAsync(_audit.Create(
            actorId: string.IsNullOrWhiteSpace(actorUserId) ? "unknown" : actorUserId,
            action: "case-study.workflow-task.parties-redistributed",
            entityType: "WorkflowTask",
            entityId: parent.Id.ToString("D"),
            before: before,
            after: new
            {
                parties = after,
                poNumber = parent.PoNumber,
                propertyId = parent.PropertyId,
                actorName,
                actorRole,
                reason,
                movedTasks = changed.Select(c => c.Kind.ToString()).ToArray(),
            }), cancellationToken);

        if (timelineEvents.Count > 0)
            await _timeline.RecordManyAsync(timelineEvents, cancellationToken);

        if (changed.Count > 0)
        {
            var deed = await ParentDeedAsync(parent, cancellationToken);
            await NotifyDistributionAssignedAsync(parent, changed, deed, cancellationToken);
            await NotifyAssignmentReplacedAsync(parent, replaced, deed, reason, cancellationToken);
        }

        if (distribution.CaseSpecialist &&
            !string.IsNullOrWhiteSpace(parent.AssigneeId))
        {
            var deed = await ParentDeedAsync(parent, cancellationToken);
            await NotifyCaseSpecialistAssignedAsync(parent, deed, cancellationToken);
        }

        return (WorkflowTaskMapper.ToDto(parent), null);
    }
}

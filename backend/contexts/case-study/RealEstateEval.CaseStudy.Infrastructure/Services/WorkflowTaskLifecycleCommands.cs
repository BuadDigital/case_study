using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Notifications;

namespace RealEstateEval.Infrastructure.Services;

public sealed class WorkflowTaskLifecycleCommands : IWorkflowTaskLifecycleCommands
{
    private const WorkflowTaskKind CaseStudyPropertyKind = WorkflowTaskKind.CaseStudyProperty;

    private static readonly HashSet<string> SectionSupervisorOrAboveRoles = new(StringComparer.OrdinalIgnoreCase)
    {
        "section-supervisor",
        "general-manager",
        "cdo",
    };

    private readonly ICaseStudyRepository _db;
    private readonly IInspectorFeeService _inspectorFees;
    private readonly IPropertyTimelineService _timeline;
    private readonly WorkflowTaskCascadeCleanup _cascade;
    private readonly IWorkflowTaskSlotSynchronizer _slots;
    private readonly INotificationService _notifications;
    private readonly NotificationRecipientResolver _recipients;
    private readonly TimeProvider _time;

    public WorkflowTaskLifecycleCommands(
        ICaseStudyRepository db,
        IInspectorFeeService inspectorFees,
        IPropertyTimelineService timeline,
        WorkflowTaskCascadeCleanup cascade,
        IWorkflowTaskSlotSynchronizer slots,
        INotificationService notifications,
        NotificationRecipientResolver recipients,
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

    public async Task<WorkflowTaskDto?> AdvanceAfterEnfathAsync(
        Guid id,
        AdvanceTaskAfterEnfathRequest request,
        CancellationToken cancellationToken = default)
    {
        var entity = await _db.WorkflowTasks.FirstOrDefaultAsync(t => t.Id == id, cancellationToken);
        if (entity is null) return null;

        var propertyId = Guid.TryParse(request.PropertyId, out var pid) ? pid : entity.PropertyId;
        if (propertyId is Guid advancePropertyId)
        {
            var prop = await _db.WorkOrderProperties.AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == advancePropertyId, cancellationToken);
            if (prop is null || prop.IsRemoved) return null;
        }

        var phase = WorkflowTaskPhaseRules.PhaseAfterEnfath(request.IdentifierType, request.BourseDataCompleted);
        var deed = request.DeedNumber.Trim();
        var po = entity.PoNumber.Trim();
        entity.AdvanceAfterEnfath(
            propertyId,
            phase,
            phase == WorkflowTaskPhase.Distribution
                ? $"توزيع الأطراف — {(string.IsNullOrEmpty(deed) ? po : deed)}"
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
        var entity = await _db.WorkflowTasks.FirstOrDefaultAsync(t => t.Id == id, cancellationToken);
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
            var prop = await _db.WorkOrderProperties.AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == boursePropertyId, cancellationToken);
            if (prop is null || prop.IsRemoved) return null;
            if (!prop.BourseDataCompleted)
                return WorkflowTaskMapper.ToDto(entity);
        }

        var deed = request.DeedNumber.Trim();
        var po = entity.PoNumber.Trim();
        entity.AdvanceAfterBourse(
            $"توزيع الأطراف — {(string.IsNullOrEmpty(deed) ? po : deed)}",
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
                "done",
                entity.UpdatedAtUtc,
                cancellationToken);
        }

        return WorkflowTaskMapper.ToDto(entity);
    }

    public async Task<(WorkflowTaskDto? Result, IReadOnlyDictionary<string, string>? Errors)> RevertPhaseAsync(
        Guid id,
        RevertWorkflowTaskPhaseRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!WorkflowTaskPhaseValues.TryParse(
                (request.TargetPhase ?? "").Trim().ToLowerInvariant(),
                out var target)
            || target is not (WorkflowTaskPhase.Enfath or WorkflowTaskPhase.Bourse))
        {
            return (null, new Dictionary<string, string>
            {
                ["targetPhase"] = "المرحلة المستهدفة يجب أن تكون البيانات الأولية أو استعلام البورصة",
            });
        }

        var entity = await _db.WorkflowTasks.FirstOrDefaultAsync(t => t.Id == id, cancellationToken);
        if (entity is null) return (null, null);

        if (entity.Kind != CaseStudyPropertyKind)
        {
            return (null, new Dictionary<string, string>
            {
                ["_"] = "يمكن إرجاع مهام دراسة الحالة فقط",
            });
        }

        if (entity.IsTerminal || entity.Phase is WorkflowTaskPhase.Done or WorkflowTaskPhase.CaseStudy)
        {
            return (null, new Dictionary<string, string>
            {
                ["_"] = "لا يمكن إرجاع هذه المعاملة — أكملت دراسة الحالة أو أُغلقت",
            });
        }

        var current = entity.Phase;
        if (!entity.CanRevertTo(target))
        {
            return (null, new Dictionary<string, string>
            {
                ["_"] = "لا يمكن الإرجاع إلى هذه المرحلة من المرحلة الحالية",
            });
        }

        if (entity.PropertyId is Guid propertyId)
        {
            var property = await _db.WorkOrderProperties
                .FirstOrDefaultAsync(p => p.Id == propertyId, cancellationToken);
            if (property is null || property.IsRemoved)
            {
                return (null, new Dictionary<string, string>
                {
                    ["_"] = "لا يمكن إرجاع معاملة لعقار محذوف أو غير موجود",
                });
            }

            property.BourseDataCompleted = false;
            property.BourseCompletedAtUtc = null;
        }

        var displacedAssigneeIds = new List<string>();
        if (current == WorkflowTaskPhase.Distribution)
        {
            entity.SetDistribution(
                WorkflowTaskMapper.SerializeDistribution(WorkflowTaskMapper.DefaultDistribution()),
                _time.UtcNow());

            var children = await _db.WorkflowTasks
                .Where(t => t.ParentTaskId == entity.Id)
                .ToListAsync(cancellationToken);
            if (children.Count > 0)
            {
                displacedAssigneeIds = children
                    .Select(c => c.AssigneeId?.Trim())
                    .Where(assigneeId => !string.IsNullOrWhiteSpace(assigneeId))
                    .Cast<string>()
                    .Distinct(StringComparer.Ordinal)
                    .ToList();
                await _cascade.RemovePartySubmissionsForTasksAsync(
                    children.Select(c => c.Id).ToList(),
                    cancellationToken);
                _db.WorkflowTasks.RemoveRange(children);
            }
        }

        var po = entity.PoNumber.Trim();
        var deed = "";
        if (entity.PropertyId is Guid pid)
        {
            var prop = await _db.WorkOrderProperties.AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == pid, cancellationToken);
            deed = prop?.DeedNumber?.Trim() ?? "";
        }

        entity.RevertToPhase(
            target,
            WorkflowTaskPhaseRules.PropertyTaskTitle(deed, po),
            _time.UtcNow());
        await _db.SaveChangesAsync(cancellationToken);

        if (entity.PropertyId is Guid timelinePropertyId)
        {
            var label = target == WorkflowTaskPhase.Enfath
                ? "إرجاع للبيانات الأولية"
                : "إرجاع لاستعلام البورصة";
            await _timeline.RecordAsync(
                entity.PoNumber,
                timelinePropertyId,
                $"task:{entity.Id}:phase-revert:{target.ToDbValue()}",
                label,
                null,
                "active",
                entity.UpdatedAtUtc,
                cancellationToken);
        }

        if (displacedAssigneeIds.Count > 0)
        {
            var displacedUserIds = await _recipients.ResolveUserIdsForDistributionAssigneesAsync(
                displacedAssigneeIds,
                cancellationToken);
            if (displacedUserIds.Count > 0)
            {
                await _notifications.CreateForUsersAsync(
                    displacedUserIds.Values.Distinct(StringComparer.Ordinal).ToList(),
                    new CreateUserNotificationRequest
                    {
                        Title = "أُلغي إسنادك",
                        Body = $"أُعيدت المعاملة على {po} لمرحلة سابقة — أُلغي إسنادك على هذا العقار.",
                        Tone = "warn",
                        Href = "/active-primary-data",
                        Category = "workflow",
                        EntityType = "task",
                        EntityId = entity.Id.ToString(),
                        SourceEvent = $"case-study-phase-reverted:{entity.Id}:{entity.UpdatedAtUtc:O}",
                    },
                    cancellationToken);
            }
        }

        return (WorkflowTaskMapper.ToDto(entity), null);
    }

    public async Task<WorkflowTaskDto?> PatchAsync(
        Guid id,
        PatchWorkflowTaskRequest request,
        CancellationToken cancellationToken = default)
    {
        var entity = await _db.WorkflowTasks.FirstOrDefaultAsync(t => t.Id == id, cancellationToken);
        if (entity is null) return null;

        var wasCaseStudyCompleted =
            entity.Kind == CaseStudyPropertyKind
            && entity.Status == WorkflowTaskStatus.Completed;
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

        var nowCaseStudyCompleted =
            entity.Kind == CaseStudyPropertyKind
            && entity.Status == WorkflowTaskStatus.Completed;
        if (!wasCaseStudyCompleted
            && nowCaseStudyCompleted
            && entity.PropertyId is Guid feePropertyId)
        {
            await _inspectorFees.EnsureLedgersForPropertyAsync(feePropertyId, cancellationToken);
        }

 // Supervisor resolved an obstruction and handed the transaction back to
 // the specialist (or re-targeted it to a new one) — they had no way to
 // know it moved without a manual refresh before this.
        var nowCaseSpecialist = entity.Kind == CaseStudyPropertyKind
            && string.Equals(entity.AssigneeRole, "case-specialist", StringComparison.OrdinalIgnoreCase)
            && entity.Status == WorkflowTaskStatus.Open
            && (wasBlocked || entity.AssigneeId != previousAssigneeId);
        if (nowCaseSpecialist)
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

    public async Task<(bool Ok, IReadOnlyDictionary<string, string>? Errors)> DeleteCaseStudySlotAsync(
        Guid id,
        DeleteCaseStudySlotRequest request,
        CancellationToken cancellationToken = default)
    {
        var reason = (request.Reason ?? "").Trim();
        if (reason.Length == 0)
        {
            return (false, new Dictionary<string, string>
            {
                ["reason"] = "سبب الحذف مطلوب",
            });
        }

        if (reason.Length > 500)
        {
            return (false, new Dictionary<string, string>
            {
                ["reason"] = "سبب الحذف طويل جداً",
            });
        }

        var task = await _db.WorkflowTasks.FirstOrDefaultAsync(t => t.Id == id, cancellationToken);
        if (task is null) return (false, null);

        if (task.Kind != CaseStudyPropertyKind)
        {
            return (false, new Dictionary<string, string>
            {
                ["_"] = "يمكن حذف مهام دراسة الحالة فقط",
            });
        }

        if (task.Phase is WorkflowTaskPhase.Done or WorkflowTaskPhase.CaseStudy)
        {
            return (false, new Dictionary<string, string>
            {
                ["_"] = "لا يمكن حذف معاملة أكملت دراسة الحالة",
            });
        }

        var po = task.PoNumber.Trim();
        var order = await _db.WorkOrders
            .Include(o => o.Properties)
            .FirstOrDefaultAsync(o => o.PoNumber == po, cancellationToken);

        if (task.PropertyId is Guid propertyId)
        {
            if (order is not null)
            {
                var prop = order.Properties.FirstOrDefault(p => p.Id == propertyId);
                if (prop is not null)
                {
                    if (prop.IsRemoved)
                    {
                        return (false, new Dictionary<string, string>
                        {
                            ["_"] = "العقار محذوف مسبقاً",
                        });
                    }

                    prop.IsRemoved = true;
                    prop.RemovalReason = reason;
                    prop.RemovedAtUtc = _time.UtcNow();
                }
            }
        }

        var allForPo = await _db.WorkflowTasks
            .Where(t => t.PoNumber == po)
            .ToListAsync(cancellationToken);

        var toRemove = allForPo
            .Where(t =>
                t.Id == task.Id
                || t.ParentTaskId == task.Id
                || (task.PropertyId.HasValue
                    && t.PropertyId == task.PropertyId
                    && t.Id != task.Id))
            .ToList();

        if (toRemove.All(t => t.Id != task.Id))
            toRemove.Add(task);

        var displacedAssigneeIds = toRemove
            .Where(t => t.Id != task.Id)
            .Select(t => t.AssigneeId?.Trim())
            .Where(assigneeId => !string.IsNullOrWhiteSpace(assigneeId))
            .Cast<string>()
            .Distinct(StringComparer.Ordinal)
            .ToList();

        await _cascade.RemovePartySubmissionsForTasksAsync(
            toRemove.Select(t => t.Id).ToList(),
            cancellationToken);
        _db.WorkflowTasks.RemoveRange(toRemove);

        if (order is not null)
        {
            order.ExpectedPropertyCount = Math.Max(1, order.ExpectedPropertyCount - 1);
            var remaining = allForPo.Where(t => toRemove.All(r => r.Id != t.Id)).ToList();
            var excess = remaining
                .Where(t =>
                    t.Kind == CaseStudyPropertyKind
                    && t.PropertyId is null
                    && t.Phase == WorkflowTaskPhase.Enfath
                    && t.PropertyOrdinal > order.ExpectedPropertyCount)
                .ToList();
            if (excess.Count > 0)
            {
                await _cascade.RemovePartySubmissionsForTasksAsync(
                    excess.Select(t => t.Id).ToList(),
                    cancellationToken);
                _db.WorkflowTasks.RemoveRange(excess);
                remaining = remaining.Where(t => excess.All(e => e.Id != t.Id)).ToList();
            }

            _slots.SyncPoSlots(order, remaining);
        }

        await _db.SaveChangesAsync(cancellationToken);

        if (displacedAssigneeIds.Count > 0)
        {
            var displacedUserIds = await _recipients.ResolveUserIdsForDistributionAssigneesAsync(
                displacedAssigneeIds,
                cancellationToken);
            if (displacedUserIds.Count > 0)
            {
                await _notifications.CreateForUsersAsync(
                    displacedUserIds.Values.Distinct(StringComparer.Ordinal).ToList(),
                    new CreateUserNotificationRequest
                    {
                        Title = "أُلغي إسنادك",
                        Body = $"حُذف العقار على {po} — أُلغي إسنادك عليه.",
                        Tone = "warn",
                        Href = "/active-primary-data",
                        Category = "workflow",
                        EntityType = "task",
                        EntityId = task.Id.ToString(),
                        SourceEvent = $"case-study-slot-deleted:{task.Id}",
                    },
                    cancellationToken);
            }
        }

        return (true, null);
    }

    public async Task<(WorkflowTaskDto? Result, IReadOnlyDictionary<string, string>? Errors)> ReopenCompletedAsync(
        Guid id,
        ReopenCompletedWorkflowTaskRequest request,
        string actorRole,
        string? actorName,
        CancellationToken cancellationToken = default)
    {
        if (!SectionSupervisorOrAboveRoles.Contains((actorRole ?? "").Trim()))
        {
            return (null, new Dictionary<string, string>
            {
                ["_"] = "إعادة فتح المعاملة صلاحية مشرف القسم فأعلى",
            });
        }

        var reason = (request.Reason ?? "").Trim();
        if (reason.Length == 0)
        {
            return (null, new Dictionary<string, string>
            {
                ["reason"] = "سبب إعادة الفتح مطلوب",
            });
        }

        if (reason.Length > 500)
        {
            return (null, new Dictionary<string, string>
            {
                ["reason"] = "السبب طويل جداً",
            });
        }

        var entity = await _db.WorkflowTasks.FirstOrDefaultAsync(t => t.Id == id, cancellationToken);
        if (entity is null) return (null, null);

        if (entity.Status != WorkflowTaskStatus.Completed)
        {
            return (null, new Dictionary<string, string>
            {
                ["_"] = "لا يمكن إعادة فتح معاملة غير مكتملة",
            });
        }

        entity.Reopen(_time.UtcNow());

        var detail = string.IsNullOrWhiteSpace(actorName) ? reason : $"{actorName}: {reason}";

        await DbContextTransaction.ExecuteInTransactionAsync(_db, async ct =>
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
                    "active",
                    entity.UpdatedAtUtc,
                    ct);
            }
        }, cancellationToken);

        await NotifyAssigneeAsync(
            entity.Id,
            entity.AssigneeId,
            "أُعيدت فتح معاملتك",
            $"أعاد المشرف فتح المعاملة: {detail}",
            "warn",
            $"case-study-reopened:{entity.Id}:{entity.UpdatedAtUtc:O}",
            cancellationToken);

        return (WorkflowTaskMapper.ToDto(entity), null);
    }

    public async Task DeleteForPoAsync(
        string poNumber,
        CancellationToken cancellationToken = default)
    {
        var n = poNumber.Trim();
        var tasks = await _db.WorkflowTasks
            .Where(t => t.PoNumber == n)
            .ToListAsync(cancellationToken);
        var taskIds = tasks.Select(t => t.Id).ToList();
        if (taskIds.Count > 0)
        {
            var subs = await _db.PartyTaskSubmissions
                .Where(s => taskIds.Contains(s.WorkflowTaskId))
                .ToListAsync(cancellationToken);
            if (subs.Count > 0)
            {
                var inspectionTaskIds = subs
                    .Where(s => s.Kind == "field-inspection")
                    .Select(s => s.WorkflowTaskId)
                    .ToList();
                if (inspectionTaskIds.Count > 0)
                {
                    await _db.FieldInspectionWorkspaces
                        .Where(w => inspectionTaskIds.Contains(w.WorkflowTaskId))
                        .ExecuteDeleteAsync(cancellationToken);
                }

                await _inspectorFees.DeleteForWorkflowTaskIdsAsync(taskIds, cancellationToken);

                _db.PartyTaskSubmissions.RemoveRange(subs);
            }
        }
        _db.WorkflowTasks.RemoveRange(tasks);
        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task DeleteForPropertyAsync(
        string poNumber,
        Guid propertyId,
        int expectedPropertyCount = 1,
        CancellationToken cancellationToken = default)
    {
        var nPo = poNumber.Trim();
        var list = await _db.WorkflowTasks
            .Where(t => t.PoNumber == nPo)
            .ToListAsync(cancellationToken);

        var linked = list.FirstOrDefault(t =>
            t.Kind == CaseStudyPropertyKind && t.PropertyId == propertyId);

        if (linked is not null)
        {
            var parentIds = new HashSet<Guid> { linked.Id };
            var toRemove = list.Where(t =>
                t.Id != linked.Id &&
                (t.PropertyId == propertyId ||
                 (t.ParentTaskId.HasValue && parentIds.Contains(t.ParentTaskId.Value)))).ToList();
            await _cascade.RemovePartySubmissionsForTasksAsync(
                toRemove.Select(t => t.Id).ToList(),
                cancellationToken);
            _db.WorkflowTasks.RemoveRange(toRemove);

            linked.ResetToEmptySlot(
                WorkflowTaskPhaseRules.SlotTaskTitle(
                    nPo,
                    linked.PropertyOrdinal,
                    Math.Max(1, expectedPropertyCount)),
                WorkflowTaskMapper.SerializeDistribution(WorkflowTaskMapper.DefaultDistribution()),
                _time.UtcNow());
        }
        else
        {
            var parentIds = list
                .Where(t => t.PropertyId == propertyId)
                .Select(t => t.Id)
                .ToHashSet();
            var toRemove = list.Where(t =>
                t.PropertyId == propertyId ||
                (t.ParentTaskId.HasValue && parentIds.Contains(t.ParentTaskId.Value))).ToList();
            await _cascade.RemovePartySubmissionsForTasksAsync(
                toRemove.Select(t => t.Id).ToList(),
                cancellationToken);
            _db.WorkflowTasks.RemoveRange(toRemove);
        }

        await _db.SaveChangesAsync(cancellationToken);
    }
}

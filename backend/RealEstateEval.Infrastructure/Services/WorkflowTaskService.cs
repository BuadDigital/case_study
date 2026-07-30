using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Notifications;
using System.Text.Json;

namespace RealEstateEval.Infrastructure.Services;

public class WorkflowTaskService : IWorkflowTaskService
{
    private const WorkflowTaskKind CaseStudyPropertyKind = WorkflowTaskKind.CaseStudyProperty;
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private readonly ApplicationDbContext _db;
    private readonly IInspectorFeeService _inspectorFees;
    private readonly INotificationService _notifications;
    private readonly NotificationRecipientResolver _recipients;
    private readonly IPropertyTimelineService _timeline;
    private readonly IWorkflowTaskVisibilityFilter _visibility;
    private readonly DatabaseOptions _dbOptions;

    public WorkflowTaskService(
        ApplicationDbContext db,
        IInspectorFeeService inspectorFees,
        INotificationService notifications,
        NotificationRecipientResolver recipients,
        IPropertyTimelineService timeline,
        IWorkflowTaskVisibilityFilter? visibility = null,
        IOptions<DatabaseOptions>? dbOptions = null)
    {
        _db = db;
        _inspectorFees = inspectorFees;
        _notifications = notifications;
        _recipients = recipients;
        _timeline = timeline;
        _visibility = visibility ?? new WorkflowTaskVisibilityFilter();
        _dbOptions = dbOptions?.Value ?? new DatabaseOptions();
    }

    public async Task<IReadOnlyList<WorkflowTaskDto>> ListAsync(
        PermissionsDto? actor = null,
        CancellationToken cancellationToken = default)
    {
        var (_, take, _, _) = NpgsqlConfiguration.ResolveListPaging(null, null, _dbOptions);
        var list = await _visibility.VisibleTaskQuery(_db.WorkflowTasks.AsNoTracking(), actor)
            .Take(take)
            .ToListAsync(cancellationToken);
        return list.Select(WorkflowTaskMapper.ToDto).ToList();
    }

    public async Task<PagedResultDto<WorkflowTaskDto>> ListPagedAsync(
        int? page,
        int? pageSize,
        PermissionsDto? actor = null,
        CancellationToken cancellationToken = default)
    {
        var (skip, take, resolvedPage, _) = NpgsqlConfiguration.ResolveListPaging(
            page,
            pageSize,
            _dbOptions);
        var query = _visibility.VisibleTaskQuery(_db.WorkflowTasks.AsNoTracking(), actor);
        var total = await query.CountAsync(cancellationToken);
        var list = await query
            .Skip(skip)
            .Take(take)
            .ToListAsync(cancellationToken);

        return new PagedResultDto<WorkflowTaskDto>
        {
            Items = list.Select(WorkflowTaskMapper.ToDto).ToList(),
            TotalCount = total,
            Page = resolvedPage,
            PageSize = take,
        };
    }

    public Task<bool> IsAssignedToAsync(
        Guid id,
        string assigneeId,
        CancellationToken cancellationToken = default)
    {
        var normalizedAssigneeId = assigneeId.Trim();
        return _db.WorkflowTasks
            .AsNoTracking()
            .AnyAsync(
                task => task.Id == id && task.AssigneeId == normalizedAssigneeId,
                cancellationToken);
    }

    public async Task<IReadOnlyList<WorkflowTaskDto>> SyncFromWorkOrdersAsync(
        CancellationToken cancellationToken = default)
    {
        var orders = await _db.WorkOrders
            .Include(w => w.Properties)
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        var poNumbers = orders.Select(o => o.PoNumber).Distinct().ToList();
        var tracked = await _db.WorkflowTasks
            .Where(t => poNumbers.Contains(t.PoNumber))
            .ToListAsync(cancellationToken);

        foreach (var order in orders)
        {
            SyncPoSlots(order, tracked);
        }

        await _db.SaveChangesAsync(cancellationToken);
        return await ListAsync(cancellationToken: cancellationToken);
    }

    public async Task<WorkflowTaskDto?> PatchDistributionAsync(
        Guid id,
        TaskDistributionDraftDto distribution,
        CancellationToken cancellationToken = default)
    {
        var entity = await _db.WorkflowTasks.FirstOrDefaultAsync(t => t.Id == id, cancellationToken);
        if (entity is null) return null;

        var normalized = WorkflowTaskPhaseRules.NormalizeDistribution(distribution);
        entity.SetDistribution(
            WorkflowTaskMapper.SerializeDistribution(normalized),
            DateTime.UtcNow);
        await _db.SaveChangesAsync(cancellationToken);
        return WorkflowTaskMapper.ToDto(entity);
    }

    public async Task<(ConfirmTaskDistributionResponseDto? Result, IReadOnlyDictionary<string, string>? Errors)>
        ConfirmDistributionAsync(
            Guid id,
            ConfirmTaskDistributionRequest request,
            CancellationToken cancellationToken = default)
    {
        var parent = await _db.WorkflowTasks.FirstOrDefaultAsync(t => t.Id == id, cancellationToken);
        if (parent is null)
        {
            return (null, new Dictionary<string, string>
            {
                ["_"] = "المهمة غير موجودة",
            });
        }

        if (parent.Phase != WorkflowTaskPhase.Distribution)
        {
            return (null, new Dictionary<string, string>
            {
                ["_"] = "المعاملة ليست في مرحلة التوزيع حالياً",
            });
        }

        if (parent.PropertyId is null)
        {
            return (null, new Dictionary<string, string>
            {
                ["_"] = "لا يوجد عقار مرتبط بمهمة التوزيع",
            });
        }

        var confirmProperty = await _db.WorkOrderProperties
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == parent.PropertyId.Value, cancellationToken);
        if (confirmProperty is null || confirmProperty.IsRemoved)
        {
            return (null, new Dictionary<string, string>
            {
                ["_"] = "لا يمكن توزيع معاملة لعقار محذوف أو غير موجود",
            });
        }

        var propertyIdText = parent.PropertyId.Value.ToString();
        var hasBlockingFailure = await _db.PropertyFailures.AnyAsync(
            f => f.PoNumber == parent.PoNumber
                && f.PropertyId == propertyIdText
                && f.Status != PropertyFailureStatus.Resolved
                && f.Status != PropertyFailureStatus.Suspended,
            cancellationToken);
        if (hasBlockingFailure)
        {
            return (null, new Dictionary<string, string>
            {
                ["_"] = "لا يمكن توزيع المعاملة ما دام عليها تعذر نشط",
            });
        }

        var distribution = WorkflowTaskPhaseRules.NormalizeDistribution(request.Distribution);

        if (distribution.GovernmentAuditor)
        {
            var property = await _db.WorkOrderProperties.AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == parent.PropertyId.Value, cancellationToken);
            var govBlock = DocumentaryWorkflowRules.GovernmentReviewAssignmentBlockReason(
                property?.DeedNumber ?? request.DeedNumber,
                property?.RequestNumber,
                property?.City,
                property?.District,
                property?.Circuit,
                parent.PoNumber,
                property?.AssignmentMandateNumber,
                property?.AssignmentMandateDate);
            if (govBlock is not null)
            {
                return (null, new Dictionary<string, string> { ["_"] = govBlock });
            }
        }

        var now = DateTime.UtcNow;
        var deed = request.DeedNumber.Trim();
        var children = new List<WorkflowTask>();

        var names = request.AssigneeNames ?? new Dictionary<string, string>();

        if (distribution.GovernmentAuditor)
        {
            children.Add(WorkflowTaskPhaseRules.SpawnChild(
                parent,
                WorkflowTaskKind.GovernmentReview,
                "government-reviewer",
                WorkflowTaskPhaseRules.ResolveName(
                    names,
                    WorkflowTaskKind.GovernmentReview,
                    "مراجع حكومي"),
                distribution.GovernmentAuditorId,
                deed,
                now));
        }

        if (distribution.ValuationDepartment)
        {
            children.Add(WorkflowTaskPhaseRules.SpawnChild(
                parent,
                WorkflowTaskKind.ValuationCoordination,
                "valuation-coordinator",
                WorkflowTaskPhaseRules.ResolveName(
                    names,
                    WorkflowTaskKind.ValuationCoordination,
                    "منسق التقييم"),
                distribution.OperationsCoordinatorId,
                deed,
                now));
            children.Add(WorkflowTaskPhaseRules.SpawnChild(
                parent,
                WorkflowTaskKind.FieldInspection,
                "field-inspector",
                WorkflowTaskPhaseRules.ResolveName(
                    names,
                    WorkflowTaskKind.FieldInspection,
                    "معاين ميداني"),
                distribution.InspectorId,
                deed,
                now));
            children.Add(WorkflowTaskPhaseRules.SpawnChild(
                parent,
                WorkflowTaskKind.PropertyAppraisal,
                "real-estate-appraiser",
                WorkflowTaskPhaseRules.ResolveName(
                    names,
                    WorkflowTaskKind.PropertyAppraisal,
                    "مقيم عقاري"),
                distribution.ValuatorId,
                deed,
                now));
        }

        if (distribution.EngineeringOffice)
        {
            children.Add(WorkflowTaskPhaseRules.SpawnChild(
                parent,
                WorkflowTaskKind.EngineeringSurvey,
                "engineering-office",
                WorkflowTaskPhaseRules.ResolveName(
                    names,
                    WorkflowTaskKind.EngineeringSurvey,
                    "مكتب هندسي"),
                distribution.EngineeringOfficeId,
                deed,
                now));
        }

        parent.ConfirmDistribution(
            $"دراسة حالة — {(string.IsNullOrEmpty(deed) ? parent.PoNumber : deed)}",
            WorkflowTaskMapper.SerializeDistribution(distribution),
            now);

        _db.WorkflowTasks.AddRange(children);
        await _db.SaveChangesAsync(cancellationToken);

        if (parent.PropertyId is Guid propertyId)
        {
            var timelineEvents = new List<PropertyTimelineRecordRequest>
            {
                new(
                    parent.PoNumber,
                    propertyId,
                    $"task:{parent.Id}:distribution",
                    "توزيع المعاملة",
                    null,
                    "active",
                    now),
                new(
                    parent.PoNumber,
                    propertyId,
                    $"task:{parent.Id}:case-study",
                    "دراسة حالة العقار",
                    parent.AssigneeName,
                    "active",
                    now),
            };
            timelineEvents.AddRange(children.Select(child => new PropertyTimelineRecordRequest(
                parent.PoNumber,
                propertyId,
                $"party:{child.Id}:assigned",
                WorkflowTaskPhaseRules.PartyAssignedTitle(child.Kind),
                child.AssigneeName,
                "active",
                child.CreatedAtUtc)));
            await _timeline.RecordManyAsync(timelineEvents, cancellationToken);
        }

        await NotifyDistributionAssignedAsync(parent, children, deed, cancellationToken);

        return (new ConfirmTaskDistributionResponseDto
        {
            Parent = WorkflowTaskMapper.ToDto(parent),
            Children = children.Select(WorkflowTaskMapper.ToDto).ToList(),
        }, null);
    }

    public async Task<(WorkflowTaskDto? Result, IReadOnlyDictionary<string, string>? Errors)>
        RedistributePartiesAsync(
            Guid id,
            RedistributePartiesRequest request,
            string actorRole,
            string? actorName,
            CancellationToken cancellationToken = default)
    {
        if (!SectionSupervisorOrAboveRoles.Contains((actorRole ?? "").Trim()))
        {
            return (null, new Dictionary<string, string>
            {
                ["_"] = "إعادة إسناد الأطراف صلاحية مشرف القسم فأعلى",
            });
        }

        var parent = await _db.WorkflowTasks.FirstOrDefaultAsync(t => t.Id == id, cancellationToken);
        if (parent is null) return (null, null);

        if (parent.Kind != CaseStudyPropertyKind)
        {
            return (null, new Dictionary<string, string>
            {
                ["_"] = "يمكن إعادة إسناد الأطراف لمعاملات دراسة الحالة فقط",
            });
        }

        if (parent.Phase != WorkflowTaskPhase.CaseStudy)
        {
            return (null, new Dictionary<string, string>
            {
                ["_"] = "إعادة إسناد الأطراف متاحة فقط بعد تأكيد التوزيع (مرحلة دراسة الحالة)",
            });
        }

        var reason = (request.Reason ?? "").Trim();
        if (reason.Length == 0)
        {
            return (null, new Dictionary<string, string>
            {
                ["reason"] = "سبب إعادة الإسناد مطلوب",
            });
        }

        if (reason.Length > 500)
        {
            return (null, new Dictionary<string, string>
            {
                ["reason"] = "السبب طويل جداً",
            });
        }

        var distribution = WorkflowTaskPhaseRules.NormalizeDistribution(request.Distribution);
        var names = request.AssigneeNames ?? new Dictionary<string, string>();

        var children = await _db.WorkflowTasks
            .Where(t => t.ParentTaskId == parent.Id)
            .ToListAsync(cancellationToken);

        var mappings =
            new (bool Enabled, WorkflowTaskKind Kind, string Role, string AssigneeId, string Fallback)[]
        {
            (distribution.GovernmentAuditor, WorkflowTaskKind.GovernmentReview, "government-reviewer",
                distribution.GovernmentAuditorId, "مراجع حكومي"),
            (distribution.ValuationDepartment, WorkflowTaskKind.ValuationCoordination, "valuation-coordinator",
                distribution.OperationsCoordinatorId, "منسق التقييم"),
            (distribution.ValuationDepartment, WorkflowTaskKind.FieldInspection, "field-inspector",
                distribution.InspectorId, "معاين ميداني"),
            (distribution.ValuationDepartment, WorkflowTaskKind.PropertyAppraisal, "real-estate-appraiser",
                distribution.ValuatorId, "مقيم عقاري"),
            (distribution.EngineeringOffice, WorkflowTaskKind.EngineeringSurvey, "engineering-office",
                distribution.EngineeringOfficeId, "مكتب هندسي"),
        };

        var now = DateTime.UtcNow;
        var changed = new List<WorkflowTask>();
        var timelineEvents = new List<PropertyTimelineRecordRequest>();

        foreach (var mapping in mappings)
        {
            if (!mapping.Enabled) continue;

            var child = children.FirstOrDefault(c => c.Kind == mapping.Kind);
            if (child is null || child.Status != WorkflowTaskStatus.Open) continue;

            var newAssigneeId = string.IsNullOrWhiteSpace(mapping.AssigneeId)
                ? null
                : mapping.AssigneeId.Trim();
            if (string.Equals(child.AssigneeId, newAssigneeId, StringComparison.Ordinal)) continue;

            var newName = WorkflowTaskPhaseRules.ResolveName(names, mapping.Kind, mapping.Fallback);
            child.Assign(newAssigneeId, newName, mapping.Role, now);
            changed.Add(child);

            if (parent.PropertyId is Guid propertyId)
            {
                var detail = string.IsNullOrWhiteSpace(actorName)
                    ? $"{newName} — {reason}"
                    : $"{actorName}: {newName} — {reason}";
                timelineEvents.Add(new PropertyTimelineRecordRequest(
                    parent.PoNumber,
                    propertyId,
                    $"party:{child.Id}:redistributed:{now.Ticks}",
                    $"إعادة إسناد — {WorkflowTaskPhaseRules.PartyAssignedTitle(child.Kind)}",
                    detail,
                    "active",
                    now));
            }
        }

        parent.SetDistribution(WorkflowTaskMapper.SerializeDistribution(distribution), now);
        await _db.SaveChangesAsync(cancellationToken);

        if (timelineEvents.Count > 0)
        {
            await _timeline.RecordManyAsync(timelineEvents, cancellationToken);
        }

        if (changed.Count > 0)
        {
            var deed = "";
            if (parent.PropertyId is Guid deedPropertyId)
            {
                var prop = await _db.WorkOrderProperties.AsNoTracking()
                    .FirstOrDefaultAsync(p => p.Id == deedPropertyId, cancellationToken);
                deed = prop?.DeedNumber?.Trim() ?? "";
            }
            await NotifyDistributionAssignedAsync(parent, changed, deed, cancellationToken);
        }

        return (WorkflowTaskMapper.ToDto(parent), null);
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
            DateTime.UtcNow);
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

        if (entity.PropertyId is Guid boursePropertyId)
        {
            var prop = await _db.WorkOrderProperties.AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == boursePropertyId, cancellationToken);
            if (prop is null || prop.IsRemoved) return null;
        }

        var deed = request.DeedNumber.Trim();
        var po = entity.PoNumber.Trim();
        entity.AdvanceAfterBourse(
            $"توزيع الأطراف — {(string.IsNullOrEmpty(deed) ? po : deed)}",
            DateTime.UtcNow);
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

        if (current == WorkflowTaskPhase.Distribution)
        {
            entity.SetDistribution(
                WorkflowTaskMapper.SerializeDistribution(WorkflowTaskMapper.DefaultDistribution()),
                DateTime.UtcNow);

            var children = await _db.WorkflowTasks
                .Where(t => t.ParentTaskId == entity.Id)
                .ToListAsync(cancellationToken);
            if (children.Count > 0)
            {
                await RemovePartySubmissionsForTasksAsync(
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
            DateTime.UtcNow);
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
            nowUtc: DateTime.UtcNow);
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
                    prop.RemovedAtUtc = DateTime.UtcNow;
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

        await RemovePartySubmissionsForTasksAsync(
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
                await RemovePartySubmissionsForTasksAsync(
                    excess.Select(t => t.Id).ToList(),
                    cancellationToken);
                _db.WorkflowTasks.RemoveRange(excess);
                remaining = remaining.Where(t => excess.All(e => e.Id != t.Id)).ToList();
            }

            SyncPoSlots(order, remaining);
        }

        await _db.SaveChangesAsync(cancellationToken);
        return (true, null);
    }

    private static readonly HashSet<string> SectionSupervisorOrAboveRoles = new(StringComparer.OrdinalIgnoreCase)
    {
        "section-supervisor",
        "general-manager",
        "cdo",
    };

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

        entity.Reopen(DateTime.UtcNow);
        await _db.SaveChangesAsync(cancellationToken);

        if (entity.PropertyId is Guid propertyId)
        {
            var detail = string.IsNullOrWhiteSpace(actorName) ? reason : $"{actorName}: {reason}";
            await _timeline.RecordAsync(
                entity.PoNumber,
                propertyId,
                $"task:{entity.Id}:reopened",
                "إعادة فتح المعاملة",
                detail,
                "active",
                entity.UpdatedAtUtc,
                cancellationToken);
        }

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
            await RemovePartySubmissionsForTasksAsync(toRemove.Select(t => t.Id).ToList(), cancellationToken);
            _db.WorkflowTasks.RemoveRange(toRemove);

            linked.ResetToEmptySlot(
                WorkflowTaskPhaseRules.SlotTaskTitle(
                    nPo,
                    linked.PropertyOrdinal,
                    Math.Max(1, expectedPropertyCount)),
                WorkflowTaskMapper.SerializeDistribution(WorkflowTaskMapper.DefaultDistribution()),
                DateTime.UtcNow);
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
            await RemovePartySubmissionsForTasksAsync(toRemove.Select(t => t.Id).ToList(), cancellationToken);
            _db.WorkflowTasks.RemoveRange(toRemove);
        }

        await _db.SaveChangesAsync(cancellationToken);
    }

    private void SyncPoSlots(WorkOrder order, List<WorkflowTask> allTasks)
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
                    WorkflowTaskMapper.SerializeDistribution(WorkflowTaskMapper.DefaultDistribution()));
                allTasks.Add(task);
                _db.WorkflowTasks.Add(task);
                byOrdinal[ord] = task;
            }
            else if (byOrdinal[ord].PropertyId is null)
            {
                var existing = byOrdinal[ord];
                var slotNow = DateTime.UtcNow;
                existing.Retitle(WorkflowTaskPhaseRules.SlotTaskTitle(poNumber, ord, expected), slotNow);
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
                DateTime.UtcNow);
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
                            DateTime.UtcNow);
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

            var linkNow = DateTime.UtcNow;
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

    private async Task NotifyDistributionAssignedAsync(
        WorkflowTask parent,
        IReadOnlyCollection<WorkflowTask> children,
        string deed,
        CancellationToken cancellationToken)
    {
        var assignmentsByUser = new Dictionary<string, List<WorkflowTask>>(StringComparer.Ordinal);
        var assigneeIds = children
            .Select(child => child.AssigneeId?.Trim())
            .Where(assigneeId => !string.IsNullOrWhiteSpace(assigneeId))
            .Cast<string>()
            .Distinct(StringComparer.Ordinal)
            .ToList();
        var usersByAssignee = await _recipients.ResolveUserIdsForDistributionAssigneesAsync(
            assigneeIds,
            cancellationToken);

        foreach (var child in children)
        {
            var assigneeId = child.AssigneeId?.Trim();
            if (string.IsNullOrWhiteSpace(assigneeId)) continue;
            if (!usersByAssignee.TryGetValue(assigneeId, out var userId)) continue;

            if (!assignmentsByUser.TryGetValue(userId, out var list))
            {
                list = [];
                assignmentsByUser[userId] = list;
            }

            list.Add(child);
        }

        var refLabel = string.IsNullOrWhiteSpace(deed) ? parent.PoNumber : deed.Trim();
        var requestsByUser =
            new Dictionary<string, CreateUserNotificationRequest>(StringComparer.Ordinal);
        foreach (var entry in assignmentsByUser)
        {
            var userId = entry.Key;
            var assignedTasks = entry.Value;
            if (assignedTasks.Count == 0) continue;

            var single = assignedTasks.Count == 1 ? assignedTasks[0] : null;
            var href = single is not null
                ? TaskHref(single.Kind, single.Id)
                : "/active-primary-data";
            var body = single is not null
                ? $"أُسندت إليك مهمة جديدة: {TaskNotificationLabel(single.Kind)} على {refLabel}."
                : $"أُسندت إليك {assignedTasks.Count} مهام جديدة على {refLabel}.";

            requestsByUser[userId] = new CreateUserNotificationRequest
            {
                Title = "معاملة جديدة بانتظارك",
                Body = body,
                Tone = "info",
                Href = href,
                Category = "workflow",
                EntityType = "task",
                EntityId = single?.Id.ToString() ?? parent.Id.ToString(),
                SourceEvent = single is not null
                    ? $"distribution-assigned:{single.Id}"
                    : $"distribution-assigned-batch:{parent.Id}:{userId}",
            };
        }

        await _notifications.CreateForUsersAsync(requestsByUser, cancellationToken);
    }

    private static string TaskNotificationLabel(WorkflowTaskKind kind) => kind switch
    {
        WorkflowTaskKind.FieldInspection => "معاينة العقار",
        WorkflowTaskKind.EngineeringSurvey => "الرفع المساحي",
        WorkflowTaskKind.PropertyAppraisal => "تقييم العقار",
        WorkflowTaskKind.GovernmentReview => "المراجعة الحكومية",
        WorkflowTaskKind.ValuationCoordination => "استلام التقييم",
        _ => "مهمة جديدة",
    };

    private static string TaskHref(WorkflowTaskKind kind, Guid taskId)
    {
        var id = Uri.EscapeDataString(taskId.ToString());
        return kind switch
        {
            WorkflowTaskKind.EngineeringSurvey => $"/active-survey/{id}",
            WorkflowTaskKind.FieldInspection => $"/property-inspection/{id}",
            WorkflowTaskKind.PropertyAppraisal => $"/property-appraisal/{id}",
            // Reviewers use operations-tasks; CDO can still open /government-review manually.
            WorkflowTaskKind.GovernmentReview => "/operations-tasks",
            WorkflowTaskKind.ValuationCoordination => $"/valuation-coordination/{id}",
            _ => "/active-primary-data",
        };
    }

    private async Task RemovePartySubmissionsForTasksAsync(
        List<Guid> taskIds,
        CancellationToken cancellationToken)
    {
        if (taskIds.Count == 0) return;
        await _inspectorFees.DeleteForWorkflowTaskIdsAsync(taskIds, cancellationToken);
        await _db.FieldInspectionWorkspaces
            .Where(w => taskIds.Contains(w.WorkflowTaskId))
            .ExecuteDeleteAsync(cancellationToken);
        var subs = await _db.PartyTaskSubmissions
            .Where(s => taskIds.Contains(s.WorkflowTaskId))
            .ToListAsync(cancellationToken);
        if (subs.Count > 0)
            _db.PartyTaskSubmissions.RemoveRange(subs);
    }
}

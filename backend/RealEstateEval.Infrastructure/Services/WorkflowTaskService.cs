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
    private const string CaseStudyPropertyKind = "case-study-property";
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private readonly ApplicationDbContext _db;
    private readonly IInspectorFeeService _inspectorFees;
    private readonly INotificationService _notifications;
    private readonly NotificationRecipientResolver _recipients;
    private readonly IPropertyTimelineService _timeline;
    private readonly DatabaseOptions _dbOptions;

    public WorkflowTaskService(
        ApplicationDbContext db,
        IInspectorFeeService inspectorFees,
        INotificationService notifications,
        NotificationRecipientResolver recipients,
        IPropertyTimelineService timeline,
        IOptions<DatabaseOptions>? dbOptions = null)
    {
        _db = db;
        _inspectorFees = inspectorFees;
        _notifications = notifications;
        _recipients = recipients;
        _timeline = timeline;
        _dbOptions = dbOptions?.Value ?? new DatabaseOptions();
    }

    public async Task<IReadOnlyList<WorkflowTaskDto>> ListAsync(
        CancellationToken cancellationToken = default)
    {
        var (_, take, _, _) = NpgsqlConfiguration.ResolveListPaging(null, null, _dbOptions);
        var list = await OrderedTaskQuery()
            .Take(take)
            .ToListAsync(cancellationToken);
        return list.Select(WorkflowTaskMapper.ToDto).ToList();
    }

    public async Task<PagedResultDto<WorkflowTaskDto>> ListPagedAsync(
        int? page,
        int? pageSize,
        CancellationToken cancellationToken = default)
    {
        var (skip, take, resolvedPage, _) = NpgsqlConfiguration.ResolveListPaging(
            page,
            pageSize,
            _dbOptions);
        var query = OrderedTaskQuery();
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

    private IQueryable<WorkflowTask> OrderedTaskQuery() =>
        _db.WorkflowTasks
            .AsNoTracking()
            .OrderByDescending(t => t.CreatedAtUtc)
            .ThenBy(t => t.PoNumber)
            .ThenBy(t => t.PropertyOrdinal);

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
        return await ListAsync(cancellationToken);
    }

    public async Task<WorkflowTaskDto?> PatchDistributionAsync(
        Guid id,
        TaskDistributionDraftDto distribution,
        CancellationToken cancellationToken = default)
    {
        var entity = await _db.WorkflowTasks.FirstOrDefaultAsync(t => t.Id == id, cancellationToken);
        if (entity is null) return null;

        var normalized = NormalizeDistribution(distribution);
        entity.DistributionJson = WorkflowTaskMapper.SerializeDistribution(normalized);
        entity.UpdatedAtUtc = DateTime.UtcNow;
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

        if (parent.Phase != "distribution")
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

        var distribution = NormalizeDistribution(request.Distribution);

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
            children.Add(SpawnChild(
                parent,
                "government-review",
                "government-reviewer",
                ResolveName(names, "government-review", "مراجع حكومي"),
                distribution.GovernmentAuditorId,
                deed,
                now));
        }

        if (distribution.ValuationDepartment)
        {
            children.Add(SpawnChild(
                parent,
                "valuation-coordination",
                "valuation-coordinator",
                ResolveName(names, "valuation-coordination", "منسق التقييم"),
                distribution.OperationsCoordinatorId,
                deed,
                now));
            children.Add(SpawnChild(
                parent,
                "field-inspection",
                "field-inspector",
                ResolveName(names, "field-inspection", "معاين ميداني"),
                distribution.InspectorId,
                deed,
                now));
            children.Add(SpawnChild(
                parent,
                "property-appraisal",
                "real-estate-appraiser",
                ResolveName(names, "property-appraisal", "مقيم عقاري"),
                distribution.ValuatorId,
                deed,
                now));
        }

        if (distribution.EngineeringOffice)
        {
            children.Add(SpawnChild(
                parent,
                "engineering-survey",
                "engineering-office",
                ResolveName(names, "engineering-survey", "مكتب هندسي"),
                distribution.EngineeringOfficeId,
                deed,
                now));
        }

        parent.Phase = "case-study";
        parent.Status = WorkflowTaskStatus.Open;
        parent.Title = $"دراسة حالة — {(string.IsNullOrEmpty(deed) ? parent.PoNumber : deed)}";
        parent.DistributionJson = WorkflowTaskMapper.SerializeDistribution(distribution);
        parent.UpdatedAtUtc = now;

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
                PartyAssignedTitle(child.Kind),
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

        var phase = PhaseAfterEnfath(request.IdentifierType, request.BourseDataCompleted);
        var deed = request.DeedNumber.Trim();
        var po = entity.PoNumber.Trim();
        entity.PropertyId = propertyId;
        entity.Phase = phase;
        entity.Title = phase == "distribution"
            ? $"توزيع الأطراف — {(string.IsNullOrEmpty(deed) ? po : deed)}"
            : PropertyTaskTitle(deed, po);
        entity.UpdatedAtUtc = DateTime.UtcNow;
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
        entity.Phase = "distribution";
        entity.Title = $"توزيع الأطراف — {(string.IsNullOrEmpty(deed) ? po : deed)}";
        entity.UpdatedAtUtc = DateTime.UtcNow;
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
        var target = (request.TargetPhase ?? "").Trim().ToLowerInvariant();
        if (target is not ("enfath" or "bourse"))
        {
            return (null, new Dictionary<string, string>
            {
                ["targetPhase"] = "المرحلة المستهدفة يجب أن تكون البيانات الأولية أو استعلام البورصة",
            });
        }

        var entity = await _db.WorkflowTasks.FirstOrDefaultAsync(t => t.Id == id, cancellationToken);
        if (entity is null) return (null, null);

        if (!string.Equals(entity.Kind, CaseStudyPropertyKind, StringComparison.OrdinalIgnoreCase))
        {
            return (null, new Dictionary<string, string>
            {
                ["_"] = "يمكن إرجاع مهام دراسة الحالة فقط",
            });
        }

        if (WorkflowTaskStatus.IsTerminal(entity.Status) || entity.Phase is "done" or "case-study")
        {
            return (null, new Dictionary<string, string>
            {
                ["_"] = "لا يمكن إرجاع هذه المعاملة — أكملت دراسة الحالة أو أُغلقت",
            });
        }

        var current = entity.Phase;
        var allowed =
            (current == "distribution" && target == "bourse")
            || (current == "bourse" && target == "enfath");
        if (!allowed)
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

        if (current == "distribution")
        {
            entity.DistributionJson = WorkflowTaskMapper.SerializeDistribution(
                WorkflowTaskMapper.DefaultDistribution());

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

        entity.Phase = target;
        entity.Status = WorkflowTaskStatus.Open;
        entity.Title = PropertyTaskTitle(deed, po);
        entity.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);

        if (entity.PropertyId is Guid timelinePropertyId)
        {
            var label = target == "enfath"
                ? "إرجاع للبيانات الأولية"
                : "إرجاع لاستعلام البورصة";
            await _timeline.RecordAsync(
                entity.PoNumber,
                timelinePropertyId,
                $"task:{entity.Id}:phase-revert:{target}",
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
            string.Equals(entity.Kind, CaseStudyPropertyKind, StringComparison.OrdinalIgnoreCase)
            && entity.Status == WorkflowTaskStatus.Completed;

        if (request.Phase is not null) entity.Phase = request.Phase;
        if (request.Status is not null) entity.Status = request.Status;
        if (request.Title is not null) entity.Title = request.Title;
        if (request.AssigneeRole is not null) entity.AssigneeRole = request.AssigneeRole;
        if (request.AssigneeName is not null) entity.AssigneeName = request.AssigneeName;
        if (request.AssigneeId is not null) entity.AssigneeId = request.AssigneeId;
        if (request.PropertyId is not null)
        {
            entity.PropertyId = string.IsNullOrWhiteSpace(request.PropertyId)
                ? null
                : Guid.Parse(request.PropertyId);
        }
        if (request.ObstructionReason is not null)
            entity.ObstructionReason = string.IsNullOrWhiteSpace(request.ObstructionReason)
                ? null
                : request.ObstructionReason;
        if (request.ObstructionPriorPhase is not null)
            entity.ObstructionPriorPhase = string.IsNullOrWhiteSpace(request.ObstructionPriorPhase)
                ? null
                : request.ObstructionPriorPhase;
        if (request.Distribution is not null)
        {
            entity.DistributionJson = WorkflowTaskMapper.SerializeDistribution(
                NormalizeDistribution(request.Distribution));
        }

        entity.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);

        var nowCaseStudyCompleted =
            string.Equals(entity.Kind, CaseStudyPropertyKind, StringComparison.OrdinalIgnoreCase)
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

        if (!string.Equals(task.Kind, CaseStudyPropertyKind, StringComparison.OrdinalIgnoreCase))
        {
            return (false, new Dictionary<string, string>
            {
                ["_"] = "يمكن حذف مهام دراسة الحالة فقط",
            });
        }

        if (task.Phase is "done" or "case-study")
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
                    && t.Phase == "enfath"
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

            linked.PropertyId = null;
            linked.Phase = "enfath";
            linked.Status = WorkflowTaskStatus.Open;
            linked.Title = SlotTaskTitle(nPo, linked.PropertyOrdinal, Math.Max(1, expectedPropertyCount));
            linked.DistributionJson = WorkflowTaskMapper.SerializeDistribution(
                WorkflowTaskMapper.DefaultDistribution());
            linked.ObstructionReason = null;
            linked.ObstructionPriorPhase = null;
            linked.UpdatedAtUtc = DateTime.UtcNow;
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
            t.Phase == "enfath");

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
                var task = NewSlotTask(poNumber, ord, expected, assignmentLabel);
                allTasks.Add(task);
                _db.WorkflowTasks.Add(task);
                byOrdinal[ord] = task;
            }
            else if (byOrdinal[ord].PropertyId is null)
            {
                var existing = byOrdinal[ord];
                existing.Title = SlotTaskTitle(poNumber, ord, expected);
                existing.AssignmentType = assignmentLabel;
                existing.UpdatedAtUtc = DateTime.UtcNow;
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
            orphan.PropertyId = null;
            orphan.Phase = "enfath";
            orphan.Status = WorkflowTaskStatus.Open;
            orphan.Title = SlotTaskTitle(poNumber, orphan.PropertyOrdinal, expected);
            orphan.DistributionJson = WorkflowTaskMapper.SerializeDistribution(
                WorkflowTaskMapper.DefaultDistribution());
            orphan.ObstructionReason = null;
            orphan.ObstructionPriorPhase = null;
            orphan.UpdatedAtUtc = DateTime.UtcNow;
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
                    linked.Phase is not "done" and not "obstruction" and not "case-study" and not "enfath")
                {
                    var targetPhase = PhaseAfterEnfath(
                        PropertyIdentifierTypeLabels.ToApiValue(prop.IdentifierType),
                        prop.BourseDataCompleted);
                    if (linked.Phase != targetPhase)
                    {
                        linked.Phase = targetPhase;
                        linked.Title = targetPhase == "distribution"
                            ? $"توزيع الأطراف — {FormatDeedDisplay(prop)}"
                            : PropertyTaskTitle(prop.DeedNumber, poNumber);
                        linked.UpdatedAtUtc = DateTime.UtcNow;
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

            slot.PropertyId = prop.Id;
            slot.Phase = PhaseAfterEnfath(
                PropertyIdentifierTypeLabels.ToApiValue(prop.IdentifierType),
                prop.BourseDataCompleted);
            slot.Title = PropertyTaskTitle(prop.DeedNumber, poNumber);
            slot.AssignmentType = assignmentLabel;
            slot.UpdatedAtUtc = DateTime.UtcNow;
            linkedIds.Add(prop.Id);
        }
    }

    private static WorkflowTask NewSlotTask(
        string poNumber,
        int ordinal,
        int total,
        string? assignmentType)
    {
        var now = DateTime.UtcNow;
        return new WorkflowTask
        {
            Id = Guid.NewGuid(),
            Kind = CaseStudyPropertyKind,
            PoNumber = poNumber,
            PropertyOrdinal = ordinal,
            Title = SlotTaskTitle(poNumber, ordinal, total),
            Phase = "enfath",
            AssigneeRole = "case-specialist",
            AssigneeName = "أخصائي دراسة الحالة",
            Status = WorkflowTaskStatus.Open,
            DistributionJson = WorkflowTaskMapper.SerializeDistribution(
                WorkflowTaskMapper.DefaultDistribution()),
            AssignmentType = assignmentType,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        };
    }

    private static WorkflowTask SpawnChild(
        WorkflowTask parent,
        string kind,
        string role,
        string defaultName,
        string assigneeId,
        string deed,
        DateTime now)
    {
        var refLabel = string.IsNullOrWhiteSpace(deed) ? parent.PoNumber : deed;
        var title = kind switch
        {
            "field-inspection" => $"معاينة ميدانية — {refLabel}",
            "government-review" => $"مراجعة حكومية — {refLabel}",
            "valuation-coordination" => $"منسق التقييم — {refLabel}",
            "property-appraisal" => $"تقييم عقاري — {refLabel}",
            _ => $"رفع مساحي — {refLabel}",
        };

        return new WorkflowTask
        {
            Id = Guid.NewGuid(),
            Kind = kind,
            PoNumber = parent.PoNumber,
            PropertyId = parent.PropertyId,
            PropertyOrdinal = parent.PropertyOrdinal,
            Title = title,
            Phase = "done",
            AssigneeRole = role,
            AssigneeName = defaultName,
            AssigneeId = string.IsNullOrWhiteSpace(assigneeId) ? null : assigneeId.Trim(),
            ParentTaskId = parent.Id,
            Status = WorkflowTaskStatus.Open,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        };
    }

    private static TaskDistributionDraftDto NormalizeDistribution(TaskDistributionDraftDto dto)
    {
        if (!dto.GovernmentAuditor) dto.GovernmentAuditorId = "";
        if (!dto.ValuationDepartment)
        {
            dto.OperationsCoordinatorId = "";
            dto.InspectorId = "";
            dto.ValuatorId = "";
        }
        if (!dto.EngineeringOffice) dto.EngineeringOfficeId = "";
        return dto;
    }

    private static string PhaseAfterEnfath(string identifierType, bool bourseCompleted)
    {
        if (identifierType == PropertyIdentifierTypeLabels.RealEstateReg) return "distribution";
        if (bourseCompleted) return "distribution";
        return "bourse";
    }

    private static string SlotTaskTitle(string poNumber, int ordinal, int total) =>
        $"تسجيل عقار {ordinal} من {total} — {poNumber}";

    private static string PropertyTaskTitle(string deed, string poNumber)
    {
        var d = deed.Trim();
        return string.IsNullOrEmpty(d) ? $"عقار — {poNumber}" : $"{d} — {poNumber}";
    }

    private static string ResolveName(
        Dictionary<string, string> names,
        string kind,
        string fallback) =>
        names.TryGetValue(kind, out var name) && !string.IsNullOrWhiteSpace(name)
            ? name.Trim()
            : fallback;

    private static string FormatDeedDisplay(WorkOrderProperty prop)
    {
        var deed = prop.DeedNumber.Trim();
        if (!string.IsNullOrEmpty(deed) && !deed.StartsWith("INQ-", StringComparison.Ordinal))
            return deed;
        if (prop.IdentifierType == PropertyIdentifierType.BourseInquiry ||
            deed.StartsWith("INQ-", StringComparison.Ordinal))
        {
            return "استعلام بورصة — بانتظار البيانات";
        }
        return string.IsNullOrEmpty(deed) ? "—" : deed;
    }

    private static string PartyAssignedTitle(string kind) => kind switch
    {
        "field-inspection" => "تعيين المعاين الميداني",
        "engineering-survey" => "تعيين المكتب الهندسي",
        "property-appraisal" => "تعيين المقيّم العقاري",
        "government-review" => "تعيين المراجع الحكومي",
        "valuation-coordination" => "تعيين منسق التقييم",
        _ => "تعيين طرف",
    };

    private async Task NotifyDistributionAssignedAsync(
        WorkflowTask parent,
        IReadOnlyCollection<WorkflowTask> children,
        string deed,
        CancellationToken cancellationToken)
    {
        var assignmentsByUser = new Dictionary<string, List<WorkflowTask>>(StringComparer.Ordinal);

        foreach (var child in children)
        {
            var assigneeId = child.AssigneeId?.Trim();
            if (string.IsNullOrWhiteSpace(assigneeId)) continue;

            var userId = await _recipients.ResolveUserIdForDistributionAssigneeAsync(
                assigneeId,
                cancellationToken);
            if (string.IsNullOrWhiteSpace(userId)) continue;

            if (!assignmentsByUser.TryGetValue(userId, out var list))
            {
                list = [];
                assignmentsByUser[userId] = list;
            }

            list.Add(child);
        }

        var refLabel = string.IsNullOrWhiteSpace(deed) ? parent.PoNumber : deed.Trim();
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

            await _notifications.CreateForUserAsync(
                userId,
                new CreateUserNotificationRequest
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
                },
                cancellationToken);
        }
    }

    private static string TaskNotificationLabel(string kind) => kind switch
    {
        "field-inspection" => "معاينة العقار",
        "engineering-survey" => "الرفع المساحي",
        "property-appraisal" => "تقييم العقار",
        "government-review" => "المراجعة الحكومية",
        "valuation-coordination" => "استلام التقييم",
        _ => "مهمة جديدة",
    };

    private static string TaskHref(string kind, Guid taskId)
    {
        var id = Uri.EscapeDataString(taskId.ToString());
        return kind switch
        {
            "engineering-survey" => $"/active-survey/{id}",
            "field-inspection" => $"/property-inspection/{id}",
            "property-appraisal" => $"/property-appraisal/{id}",
            // Reviewers use operations-tasks; CDO can still open /government-review manually.
            "government-review" => "/operations-tasks",
            "valuation-coordination" => $"/valuation-coordination/{id}",
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

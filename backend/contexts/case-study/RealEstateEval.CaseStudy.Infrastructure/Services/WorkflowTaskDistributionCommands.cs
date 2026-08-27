using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Notifications;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.Failures.Application.Abstractions;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Application.Rules;

namespace RealEstateEval.CaseStudy.Infrastructure.Services;

public sealed class WorkflowTaskDistributionCommands : IWorkflowTaskDistributionCommands
{
    private const WorkflowTaskKind CaseStudyPropertyKind = WorkflowTaskKind.CaseStudyProperty;

    private static readonly HashSet<string> SectionSupervisorOrAboveRoles = new(StringComparer.OrdinalIgnoreCase)
    {
        "section-supervisor",
        "general-manager",
        "cdo",
    };

    private readonly ICaseStudyRepository _caseStudy;
    private readonly IFailureLookup _failureLookup;
    private readonly INotificationService _notifications;
    private readonly NotificationRecipientResolver _recipients;
    private readonly IPropertyTimelineService _timeline;
    private readonly ICaseStudyValuationDispatchService _valuationDispatch;
    private readonly TimeProvider _time;

    [ActivatorUtilitiesConstructor]
    public WorkflowTaskDistributionCommands(
        ICaseStudyRepository caseStudy,
        IFailureLookup failureLookup,
        INotificationService notifications,
        NotificationRecipientResolver recipients,
        IPropertyTimelineService timeline,
        ICaseStudyValuationDispatchService valuationDispatch,
        TimeProvider? time = null)
    {
        _time = time ?? TimeProvider.System;

        _caseStudy = caseStudy;
        _failureLookup = failureLookup;
        _notifications = notifications;
        _recipients = recipients;
        _timeline = timeline;
        _valuationDispatch = valuationDispatch;
    }

    public async Task<WorkflowTaskDto?> PatchDistributionAsync(
        Guid id,
        TaskDistributionDraftDto distribution,
        CancellationToken cancellationToken = default)
    {
        var entity = await _caseStudy.WorkflowTasks.FirstOrDefaultAsync(t => t.Id == id, cancellationToken);
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
            CancellationToken cancellationToken = default)
    {
        var parent = await _caseStudy.WorkflowTasks.FirstOrDefaultAsync(t => t.Id == id, cancellationToken);
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

        var confirmProperty = await _caseStudy.WorkOrderProperties
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
        var hasBlockingFailure = await _failureLookup.HasBlockingAsync(
            parent.PoNumber,
            propertyIdText,
            cancellationToken);
        if (hasBlockingFailure)
        {
            return (null, new Dictionary<string, string>
            {
                ["_"] = "لا يمكن توزيع المعاملة ما دام عليها تعذر نشط",
            });
        }

        var distribution = WorkflowTaskPhaseRules.NormalizeDistribution(request.Distribution);
        // Inspector + appraiser + specialist are always on the case-study path.
        // ValuationDepartment remains a stored picker/permissions flag, not a spawn gate.
        distribution.ValuationDepartment = true;
        distribution.CaseSpecialist = true;
        if (!SurveyRequirementRules.PropertyRequiresSurvey(confirmProperty))
        {
            distribution.EngineeringOffice = false;
            distribution.EngineeringOfficeId = "";
        }

        if (string.IsNullOrWhiteSpace(distribution.CaseSpecialistId))
        {
            return (null, new Dictionary<string, string>
            {
                ["_"] = "اختر أخصائي دراسة الحالة.",
            });
        }

        if (string.IsNullOrWhiteSpace(distribution.InspectorId))
        {
            return (null, new Dictionary<string, string>
            {
                ["_"] = "اختر المعاين الميداني.",
            });
        }

        if (string.IsNullOrWhiteSpace(distribution.ValuatorId))
        {
            return (null, new Dictionary<string, string>
            {
                ["_"] = "اختر المقيم العقاري.",
            });
        }

        var now = _time.UtcNow();
        var deed = request.DeedNumber.Trim();
        var children = new List<WorkflowTask>();

        var names = request.AssigneeNames ?? new Dictionary<string, string>();

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

        if (distribution.CaseSpecialist)
        {
            var specialistName =
                names.TryGetValue("case-study-property", out var named) &&
                !string.IsNullOrWhiteSpace(named)
                    ? named.Trim()
                    : names.TryGetValue("case-specialist", out var named2) &&
                      !string.IsNullOrWhiteSpace(named2)
                        ? named2.Trim()
                        : "أخصائي دراسة حالة";
            parent.Assign(
                distribution.CaseSpecialistId,
                specialistName,
                "case-specialist",
                now);
        }

        parent.ConfirmDistribution(
            $"دراسة حالة — {(string.IsNullOrEmpty(deed) ? parent.PoNumber : deed)}",
            WorkflowTaskMapper.SerializeDistribution(distribution),
            now);

        _caseStudy.WorkflowTasks.AddRange(children);
        await _caseStudy.SaveChangesAsync(cancellationToken);

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
            if (distribution.CaseSpecialist)
            {
                timelineEvents.Add(new PropertyTimelineRecordRequest(
                    parent.PoNumber,
                    propertyId,
                    $"task:{parent.Id}:specialist-assigned",
                    "تعيين أخصائي دراسة الحالة",
                    parent.AssigneeName,
                    "active",
                    now));
            }
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
        if (distribution.CaseSpecialist)
            await NotifyCaseSpecialistAssignedAsync(parent, deed, cancellationToken);

        await _valuationDispatch.TryCreateWhenAppraisalSpawnedAsync(parent.Id, cancellationToken);

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
        CancellationToken cancellationToken = default)
    {
        if (!SectionSupervisorOrAboveRoles.Contains((actorRole ?? "").Trim()))
        {
            return (null, new Dictionary<string, string>
            {
                ["_"] = "إعادة إسناد الأطراف صلاحية مشرف القسم فأعلى",
            });
        }

        var parent = await _caseStudy.WorkflowTasks.FirstOrDefaultAsync(t => t.Id == id, cancellationToken);
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

        var children = await _caseStudy.WorkflowTasks
            .Where(t => t.ParentTaskId == parent.Id)
            .ToListAsync(cancellationToken);

 // لا يشمل المراجع الحكومي — يُسند عبر مهام العمليات وليس إعادة توزيع الأطراف.
        var mappings =
            new (bool Enabled, WorkflowTaskKind Kind, string Role, string AssigneeId, string Fallback)[]
        {
            (true, WorkflowTaskKind.FieldInspection, "field-inspector",
                distribution.InspectorId, "معاين ميداني"),
            (true, WorkflowTaskKind.PropertyAppraisal, "real-estate-appraiser",
                distribution.ValuatorId, "مقيم عقاري"),
            (distribution.EngineeringOffice, WorkflowTaskKind.EngineeringSurvey, "engineering-office",
                distribution.EngineeringOfficeId, "مكتب هندسي"),
        };

        var now = _time.UtcNow();
        var changed = new List<WorkflowTask>();
        var timelineEvents = new List<PropertyTimelineRecordRequest>();

        if (distribution.CaseSpecialist)
        {
            var newAssigneeId = string.IsNullOrWhiteSpace(distribution.CaseSpecialistId)
                ? null
                : distribution.CaseSpecialistId.Trim();
            if (!string.Equals(parent.AssigneeId, newAssigneeId, StringComparison.Ordinal))
            {
                var specialistName =
                    names.TryGetValue("case-study-property", out var named) &&
                    !string.IsNullOrWhiteSpace(named)
                        ? named.Trim()
                        : names.TryGetValue("case-specialist", out var named2) &&
                          !string.IsNullOrWhiteSpace(named2)
                            ? named2.Trim()
                            : "أخصائي دراسة حالة";
                parent.Assign(newAssigneeId, specialistName, "case-specialist", now);
                if (parent.PropertyId is Guid propertyId)
                {
                    var detail = string.IsNullOrWhiteSpace(actorName)
                        ? $"{specialistName} — {reason}"
                        : $"{actorName}: {specialistName} — {reason}";
                    timelineEvents.Add(new PropertyTimelineRecordRequest(
                        parent.PoNumber,
                        propertyId,
                        $"task:{parent.Id}:specialist-redistributed:{now.Ticks}",
                        "إعادة إسناد — أخصائي دراسة الحالة",
                        detail,
                        "active",
                        now));
                }
            }
        }

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
        await _caseStudy.SaveChangesAsync(cancellationToken);

        if (timelineEvents.Count > 0)
            await _timeline.RecordManyAsync(timelineEvents, cancellationToken);

        if (changed.Count > 0)
        {
            var deed = "";
            if (parent.PropertyId is Guid deedPropertyId)
            {
                var prop = await _caseStudy.WorkOrderProperties.AsNoTracking()
                    .FirstOrDefaultAsync(p => p.Id == deedPropertyId, cancellationToken);
                deed = prop?.DeedNumber?.Trim() ?? "";
            }
            await NotifyDistributionAssignedAsync(parent, changed, deed, cancellationToken);
        }

        if (distribution.CaseSpecialist &&
            !string.IsNullOrWhiteSpace(parent.AssigneeId))
        {
            var deed = "";
            if (parent.PropertyId is Guid deedPropertyId)
            {
                var prop = await _caseStudy.WorkOrderProperties.AsNoTracking()
                    .FirstOrDefaultAsync(p => p.Id == deedPropertyId, cancellationToken);
                deed = prop?.DeedNumber?.Trim() ?? "";
            }
            await NotifyCaseSpecialistAssignedAsync(parent, deed, cancellationToken);
        }

        return (WorkflowTaskMapper.ToDto(parent), null);
    }

    private async Task NotifyCaseSpecialistAssignedAsync(
        WorkflowTask parent,
        string deed,
        CancellationToken cancellationToken)
    {
        var assigneeId = parent.AssigneeId?.Trim();
        if (string.IsNullOrWhiteSpace(assigneeId)) return;

        var usersByAssignee = await _recipients.ResolveUserIdsForDistributionAssigneesAsync(
            [assigneeId],
            cancellationToken);
        if (!usersByAssignee.TryGetValue(assigneeId, out var userId)) return;

        var refLabel = string.IsNullOrWhiteSpace(deed) ? parent.PoNumber : deed.Trim();
        var id = Uri.EscapeDataString(parent.Id.ToString());
        await _notifications.CreateForUsersAsync(
            new Dictionary<string, CreateUserNotificationRequest>(StringComparer.Ordinal)
            {
                [userId] = new CreateUserNotificationRequest
                {
                    Title = "معاملة دراسة حالة بانتظارك",
                    Body = $"أُسندت إليك دراسة حالة العقار على {refLabel}.",
                    Tone = "info",
                    Href = $"/case-study/{id}",
                    Category = "workflow",
                    EntityType = "task",
                    EntityId = parent.Id.ToString(),
                    SourceEvent = $"distribution-assigned-specialist:{parent.Id}",
                },
            },
            cancellationToken);
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
            _ => "/operations-tasks",
        };
    }
}

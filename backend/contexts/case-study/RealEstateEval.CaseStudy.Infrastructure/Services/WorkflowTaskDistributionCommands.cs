using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Notifications;

namespace RealEstateEval.Infrastructure.Services;

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
                ["_"] = "«·„Â„… €Ì— „ÊÃÊœ…",
            });
        }

        if (parent.Phase != WorkflowTaskPhase.Distribution)
        {
            return (null, new Dictionary<string, string>
            {
                ["_"] = "«·„⁄«„·… ·Ì”  ›Ì „—Õ·… «· Ê“Ì⁄ Õ«·Ì«",
            });
        }

        if (parent.PropertyId is null)
        {
            return (null, new Dictionary<string, string>
            {
                ["_"] = "·« ÌÊÃœ ⁄ﬁ«— „— »ÿ »„Â„… «· Ê“Ì⁄",
            });
        }

        var confirmProperty = await _caseStudy.WorkOrderProperties
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == parent.PropertyId.Value, cancellationToken);
        if (confirmProperty is null || confirmProperty.IsRemoved)
        {
            return (null, new Dictionary<string, string>
            {
                ["_"] = "·« Ì„ﬂ‰  Ê“Ì⁄ „⁄«„·… ·⁄ﬁ«— „Õ–Ê› √Ê €Ì— „ÊÃÊœ",
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
                ["_"] = "·« Ì„ﬂ‰  Ê“Ì⁄ «·„⁄«„·… „« œ«„ ⁄·ÌÂ«  ⁄–— ‰‘ÿ",
            });
        }

        var distribution = WorkflowTaskPhaseRules.NormalizeDistribution(request.Distribution);
        // Inspector + appraiser + specialist are always on the case-study path.
        // ValuationDepartment remains a stored picker/permissions flag, not a spawn gate.
        distribution.ValuationDepartment = true;
        distribution.CaseSpecialist = true;

        if (string.IsNullOrWhiteSpace(distribution.CaseSpecialistId))
        {
            return (null, new Dictionary<string, string>
            {
                ["_"] = "«Œ — √Œ’«∆Ì œ—«”… «·Õ«·….",
            });
        }

        if (string.IsNullOrWhiteSpace(distribution.InspectorId))
        {
            return (null, new Dictionary<string, string>
            {
                ["_"] = "«Œ — «·„⁄«Ì‰ «·„Ìœ«‰Ì.",
            });
        }

        if (string.IsNullOrWhiteSpace(distribution.ValuatorId))
        {
            return (null, new Dictionary<string, string>
            {
                ["_"] = "«Œ — «·„ﬁÌ„ «·⁄ﬁ«—Ì.",
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
                "„⁄«Ì‰ „Ìœ«‰Ì"),
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
                "„ﬁÌ„ ⁄ﬁ«—Ì"),
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
                    "„ﬂ » Â‰œ”Ì"),
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
                        : "√Œ’«∆Ì œ—«”… Õ«·…";
            parent.Assign(
                distribution.CaseSpecialistId,
                specialistName,
                "case-specialist",
                now);
        }

        parent.ConfirmDistribution(
            $"œ—«”… Õ«·… ó {(string.IsNullOrEmpty(deed) ? parent.PoNumber : deed)}",
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
                    " Ê“Ì⁄ «·„⁄«„·…",
                    null,
                    "active",
                    now),
                new(
                    parent.PoNumber,
                    propertyId,
                    $"task:{parent.Id}:case-study",
                    "œ—«”… Õ«·… «·⁄ﬁ«—",
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
                    " ⁄ÌÌ‰ √Œ’«∆Ì œ—«”… «·Õ«·…",
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
                ["_"] = "≈⁄«œ… ≈”‰«œ «·√ÿ—«› ’·«ÕÌ… „‘—› «·ﬁ”„ ›√⁄·Ï",
            });
        }

        var parent = await _caseStudy.WorkflowTasks.FirstOrDefaultAsync(t => t.Id == id, cancellationToken);
        if (parent is null) return (null, null);

        if (parent.Kind != CaseStudyPropertyKind)
        {
            return (null, new Dictionary<string, string>
            {
                ["_"] = "Ì„ﬂ‰ ≈⁄«œ… ≈”‰«œ «·√ÿ—«› ·„⁄«„·«  œ—«”… «·Õ«·… ›ﬁÿ",
            });
        }

        if (parent.Phase != WorkflowTaskPhase.CaseStudy)
        {
            return (null, new Dictionary<string, string>
            {
                ["_"] = "≈⁄«œ… ≈”‰«œ «·√ÿ—«› „ «Õ… ›ﬁÿ »⁄œ  √ﬂÌœ «· Ê“Ì⁄ („—Õ·… œ—«”… «·Õ«·…)",
            });
        }

        var reason = (request.Reason ?? "").Trim();
        if (reason.Length == 0)
        {
            return (null, new Dictionary<string, string>
            {
                ["reason"] = "”»» ≈⁄«œ… «·≈”‰«œ „ÿ·Ê»",
            });
        }

        if (reason.Length > 500)
        {
            return (null, new Dictionary<string, string>
            {
                ["reason"] = "«·”»» ÿÊÌ· Ãœ«",
            });
        }

        var distribution = WorkflowTaskPhaseRules.NormalizeDistribution(request.Distribution);
        var names = request.AssigneeNames ?? new Dictionary<string, string>();

        var children = await _caseStudy.WorkflowTasks
            .Where(t => t.ParentTaskId == parent.Id)
            .ToListAsync(cancellationToken);

 // ·« Ì‘„· «·„—«Ã⁄ «·ÕﬂÊ„Ì ó Ìı”‰œ ⁄»— „Â«„ «·⁄„·Ì«  Ê·Ì” ≈⁄«œ…  Ê“Ì⁄ «·√ÿ—«›.
        var mappings =
            new (bool Enabled, WorkflowTaskKind Kind, string Role, string AssigneeId, string Fallback)[]
        {
            (true, WorkflowTaskKind.FieldInspection, "field-inspector",
                distribution.InspectorId, "„⁄«Ì‰ „Ìœ«‰Ì"),
            (true, WorkflowTaskKind.PropertyAppraisal, "real-estate-appraiser",
                distribution.ValuatorId, "„ﬁÌ„ ⁄ﬁ«—Ì"),
            (distribution.EngineeringOffice, WorkflowTaskKind.EngineeringSurvey, "engineering-office",
                distribution.EngineeringOfficeId, "„ﬂ » Â‰œ”Ì"),
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
                            : "√Œ’«∆Ì œ—«”… Õ«·…";
                parent.Assign(newAssigneeId, specialistName, "case-specialist", now);
                if (parent.PropertyId is Guid propertyId)
                {
                    var detail = string.IsNullOrWhiteSpace(actorName)
                        ? $"{specialistName} ó {reason}"
                        : $"{actorName}: {specialistName} ó {reason}";
                    timelineEvents.Add(new PropertyTimelineRecordRequest(
                        parent.PoNumber,
                        propertyId,
                        $"task:{parent.Id}:specialist-redistributed:{now.Ticks}",
                        "≈⁄«œ… ≈”‰«œ ó √Œ’«∆Ì œ—«”… «·Õ«·…",
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
                    ? $"{newName} ó {reason}"
                    : $"{actorName}: {newName} ó {reason}";
                timelineEvents.Add(new PropertyTimelineRecordRequest(
                    parent.PoNumber,
                    propertyId,
                    $"party:{child.Id}:redistributed:{now.Ticks}",
                    $"≈⁄«œ… ≈”‰«œ ó {WorkflowTaskPhaseRules.PartyAssignedTitle(child.Kind)}",
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
                    Title = "„⁄«„·… œ—«”… Õ«·… »«‰ Ÿ«—ﬂ",
                    Body = $"√ı”‰œ  ≈·Ìﬂ œ—«”… Õ«·… «·⁄ﬁ«— ⁄·Ï {refLabel}.",
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
                ? $"√ı”‰œ  ≈·Ìﬂ „Â„… ÃœÌœ…: {TaskNotificationLabel(single.Kind)} ⁄·Ï {refLabel}."
                : $"√ı”‰œ  ≈·Ìﬂ {assignedTasks.Count} „Â«„ ÃœÌœ… ⁄·Ï {refLabel}.";

            requestsByUser[userId] = new CreateUserNotificationRequest
            {
                Title = "„⁄«„·… ÃœÌœ… »«‰ Ÿ«—ﬂ",
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
        WorkflowTaskKind.FieldInspection => "„⁄«Ì‰… «·⁄ﬁ«—",
        WorkflowTaskKind.EngineeringSurvey => "«·—›⁄ «·„”«ÕÌ",
        WorkflowTaskKind.PropertyAppraisal => " ﬁÌÌ„ «·⁄ﬁ«—",
        _ => "„Â„… ÃœÌœ…",
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

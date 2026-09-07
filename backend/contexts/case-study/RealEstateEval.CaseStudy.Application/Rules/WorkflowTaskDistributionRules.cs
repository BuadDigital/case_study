using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Rules;

/// <summary>One party child a distribution spawns or re-assigns (government reviewer excluded).</summary>
public sealed record PartyChildSpec(
    bool Enabled,
    WorkflowTaskKind Kind,
    string Role,
    string AssigneeId,
    string FallbackName);

/// <summary>
/// Pure decision rules behind confirm / redistribute: distribution defaults, assignee checks,
/// the party-child table, specialist naming, timeline titles and the notification payloads
/// that fan out to the assigned parties. No ports, no I/O.
/// </summary>
public static class WorkflowTaskDistributionRules
{
    /// <summary>
    /// Inspector + appraiser + specialist are always on the case-study path. ValuationDepartment
    /// remains a stored picker / permissions flag, not a spawn gate; the engineering office only
    /// stays when the property needs a survey.
    /// </summary>
    public static TaskDistributionDraftDto ApplyConfirmDefaults(
        TaskDistributionDraftDto distribution,
        bool propertyRequiresSurvey)
    {
        distribution.ValuationDepartment = true;
        distribution.CaseSpecialist = true;
        if (!propertyRequiresSurvey)
        {
            distribution.EngineeringOffice = false;
            distribution.EngineeringOfficeId = "";
        }
        return distribution;
    }

    /// <summary>First missing mandatory assignee, in the order the screen asks for them.</summary>
    public static string? ConfirmAssigneeError(TaskDistributionDraftDto distribution)
    {
        if (string.IsNullOrWhiteSpace(distribution.CaseSpecialistId))
            return "اختر أخصائي دراسة الحالة.";
        if (string.IsNullOrWhiteSpace(distribution.InspectorId))
            return "اختر المعاين الميداني.";
        if (string.IsNullOrWhiteSpace(distribution.ValuatorId))
            return "اختر المقيم العقاري.";
        return null;
    }

    /// <summary>
    /// Party children in spawn order. Inspector and appraiser are unconditional; the engineering
    /// office follows the distribution flag. Does not include the government reviewer — assigned
    /// via operations tasks, not party redistribution.
    /// </summary>
    public static IReadOnlyList<PartyChildSpec> PartyChildren(TaskDistributionDraftDto distribution) =>
    [
        new(true, WorkflowTaskKind.FieldInspection, StaffRoleIds.FieldInspector,
            distribution.InspectorId, "معاين ميداني"),
        new(true, WorkflowTaskKind.PropertyAppraisal, StaffRoleIds.RealEstateAppraiser,
            distribution.ValuatorId, "مقيم عقاري"),
        new(distribution.EngineeringOffice, WorkflowTaskKind.EngineeringSurvey, StaffRoleIds.EngineeringOffice,
            distribution.EngineeringOfficeId, "مكتب هندسي"),
    ];

    /// <summary>The shell keys the specialist's name by the parent kind or by the role id.</summary>
    public static string ResolveSpecialistName(Dictionary<string, string> names) =>
        names.TryGetValue(WorkflowTaskKindValues.CaseStudyProperty, out var named) &&
        !string.IsNullOrWhiteSpace(named)
            ? named.Trim()
            : names.TryGetValue(StaffRoleIds.CaseSpecialist, out var named2) &&
              !string.IsNullOrWhiteSpace(named2)
                ? named2.Trim()
                : "أخصائي دراسة حالة";

    public static string ConfirmedParentTitle(string deed, string po) =>
        $"دراسة حالة — {(string.IsNullOrEmpty(deed) ? po : deed)}";

    /// <summary>Deed when known, else the PO number — what notifications quote.</summary>
    public static string RefLabel(string deed, string po) =>
        string.IsNullOrWhiteSpace(deed) ? po : deed.Trim();

    public static string? NormalizeAssigneeId(string? assigneeId) =>
        string.IsNullOrWhiteSpace(assigneeId) ? null : assigneeId.Trim();

    /// <summary>Timeline detail of a redistribution: «actor: name — reason» or «name — reason».</summary>
    public static string RedistributionDetail(string? actorName, string assigneeName, string reason) =>
        string.IsNullOrWhiteSpace(actorName)
            ? $"{assigneeName} — {reason}"
            : $"{actorName}: {assigneeName} — {reason}";

    /// <summary>Timeline rows written when a distribution is confirmed, in write order.</summary>
    public static List<PropertyTimelineRecordRequest> ConfirmTimelineEvents(
        WorkflowTask parent,
        Guid propertyId,
        IReadOnlyCollection<WorkflowTask> children,
        bool caseSpecialistAssigned,
        DateTime now)
    {
        var events = new List<PropertyTimelineRecordRequest>
        {
            new(
                parent.PoNumber,
                propertyId,
                $"task:{parent.Id}:distribution",
                "توزيع المعاملة",
                null,
                PropertyTimelineTones.Active,
                now),
            new(
                parent.PoNumber,
                propertyId,
                $"task:{parent.Id}:case-study",
                "دراسة حالة العقار",
                parent.AssigneeName,
                PropertyTimelineTones.Active,
                now),
        };
        if (caseSpecialistAssigned)
        {
            events.Add(new PropertyTimelineRecordRequest(
                parent.PoNumber,
                propertyId,
                $"task:{parent.Id}:specialist-assigned",
                "تعيين أخصائي دراسة الحالة",
                parent.AssigneeName,
                PropertyTimelineTones.Active,
                now));
        }
        events.AddRange(children.Select(child => new PropertyTimelineRecordRequest(
            parent.PoNumber,
            propertyId,
            $"party:{child.Id}:assigned",
            WorkflowTaskPhaseRules.PartyAssignedTitle(child.Kind),
            child.AssigneeName,
            PropertyTimelineTones.Active,
            child.CreatedAtUtc)));
        return events;
    }

    public static string TaskHref(WorkflowTaskKind kind, Guid taskId)
    {
        var id = Uri.EscapeDataString(taskId.ToString());
        return kind switch
        {
            WorkflowTaskKind.EngineeringSurvey => $"/active-survey/{id}",
            WorkflowTaskKind.FieldInspection => $"/active-inspection/{id}",
            WorkflowTaskKind.PropertyAppraisal => $"/property-appraisal/{id}",
            _ => "/operations-tasks",
        };
    }

    public static CreateUserNotificationRequest CaseSpecialistAssignedRequest(WorkflowTask parent, string refLabel)
    {
        var id = Uri.EscapeDataString(parent.Id.ToString());
        return new CreateUserNotificationRequest
        {
            Title = "معاملة دراسة حالة بانتظارك",
            Body = $"أُسندت إليك دراسة حالة العقار على {refLabel}.",
            Tone = "info",
            Href = $"/case-study/{id}",
            Category = "workflow",
            EntityType = "task",
            EntityId = parent.Id.ToString(),
            SourceEvent = $"distribution-assigned-specialist:{parent.Id}",
        };
    }

    /// <summary>
    /// One inbox notification per resolved user: a deep link when the user got a single task,
    /// a count and the generic list when they got several. Children without a resolvable user
    /// are skipped.
    /// </summary>
    public static Dictionary<string, CreateUserNotificationRequest> DistributionAssignedRequests(
        WorkflowTask parent,
        IReadOnlyCollection<WorkflowTask> children,
        IReadOnlyDictionary<string, string> usersByAssignee,
        string refLabel)
    {
        var assignmentsByUser = new Dictionary<string, List<WorkflowTask>>(StringComparer.Ordinal);
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
                ? $"أُسندت إليك مهمة جديدة: {WorkflowTaskKindLabels.NotificationLabelAr(single.Kind)} على {refLabel}."
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

        return requestsByUser;
    }
}

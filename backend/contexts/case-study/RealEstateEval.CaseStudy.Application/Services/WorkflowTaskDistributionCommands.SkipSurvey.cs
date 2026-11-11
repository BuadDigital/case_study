using RealEstateEval.Application;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.CaseStudy.Application.Mapping;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Application.Services;

public sealed partial class WorkflowTaskDistributionCommands
{
    /// <summary>
    /// «تجاوز المكتب الهندسي» (Omar 2026-11-11) — the study decides the office is not needed and sends
    /// the study on without it; the office earns no fee.
    /// How it works: cancels the live engineering-survey task(s) of the parent, clears the office from
    /// the parent's distribution, tells the office with the reason, and writes a timeline row and an
    /// audit row. No fee is touched: the office's fee is accrued only when its outputs are accepted,
    /// and a delivered survey cannot be skipped.
    /// Edge cases: refused for a role that may not decide it, outside the study phase (before the
    /// distribution, or once the study report is issued), without a reason, when no survey is live, and
    /// once the office delivered — delivered work is received, and its fee is waived through the
    /// discount («قبول مع اقتراح حسم»), never by a skip. «إضافة رفع مساحي» can bring the office back
    /// afterwards.
    /// </summary>
    public async Task<(WorkflowTaskDto? Result, IReadOnlyDictionary<string, string>? Errors)> SkipEngineeringSurveyAsync(
        Guid id,
        SkipEngineeringSurveyRequest request,
        StaffActor actor,
        string? actorName,
        string? actorUserId = null,
        CancellationToken cancellationToken = default)
    {
        if (!EngineeringSurveySettlementRules.CanSkip(actor))
            return (null, Error(EngineeringSurveySettlementRules.SkipRoleDeniedAr));

        var parent = await _caseStudy.GetTaskForUpdateAsync(id, cancellationToken);
        if (parent is null) return (null, null);
        if (parent.Kind != CaseStudyPropertyKind)
            return (null, Error("يُتجاوز المكتب الهندسي في معاملات دراسة الحالة فقط"));
        if (parent.Phase != WorkflowTaskPhase.CaseStudy)
            return (null, Error("تجاوز المكتب الهندسي متاح بعد التوزيع وقبل إصدار تقرير دراسة الحالة"));

        var reason = WorkflowTaskLifecycleRules.NormalizeReason(request.Reason);
        var reasonError = WorkflowTaskLifecycleRules.ReasonError(
            reason,
            "سبب تجاوز المكتب الهندسي مطلوب",
            "السبب طويل جداً");
        if (reasonError is not null) return (null, reasonError);

        var children = await _caseStudy.ListChildrenForUpdateAsync(parent.Id, cancellationToken);
        var surveys = children
            .Where(c => c.Kind == WorkflowTaskKind.EngineeringSurvey && c.Status != WorkflowTaskStatus.Cancelled)
            .ToList();
        if (surveys.Count == 0)
            return (null, Error(EngineeringSurveySettlementRules.SkipNothingLiveAr));
        if (surveys.Any(s => s.Status == WorkflowTaskStatus.Completed))
            return (null, Error(EngineeringSurveySettlementRules.SkipAfterDeliveryAr));

        var now = _time.UtcNow();
        var skipped = surveys
            .Select(s => (Child: s, AssigneeId: s.AssigneeId?.Trim() ?? "", Name: s.AssigneeName))
            .ToList();
        foreach (var survey in surveys) survey.Cancel(now);

        var distribution = WorkflowTaskMapper.DeserializeDistribution(parent.DistributionJson)
            ?? new TaskDistributionDraftDto();
        distribution.EngineeringOffice = false;
        distribution.EngineeringOfficeId = "";
        parent.SetDistribution(WorkflowTaskMapper.SerializeDistribution(distribution), now);

        await _caseStudy.SaveChangesAsync(cancellationToken);

        var actorLabel = string.IsNullOrWhiteSpace(actorName) ? "دارس العقار" : actorName.Trim();
        if (parent.PropertyId is Guid propertyId)
        {
            foreach (var (child, _, name) in skipped)
            {
                await _timeline.RecordAsync(
                    parent.PoNumber,
                    propertyId,
                    $"party:{child.Id}:survey-skipped:{now.Ticks}",
                    "تجاوز المكتب الهندسي",
                    $"{actorLabel}: {name} — {reason}",
                    PropertyTimelineTones.Warn,
                    now,
                    cancellationToken);
            }
        }

        await NotifySurveySkippedAsync(parent, skipped.Select(s => (s.Child, s.AssigneeId)).ToList(), reason, cancellationToken);
        await _auditLog.AppendAsync(_audit.Create(
            actorId: string.IsNullOrWhiteSpace(actorUserId) ? "unknown" : actorUserId,
            action: "case-study.workflow-task.engineering-survey-skipped",
            entityType: "WorkflowTask",
            entityId: parent.Id.ToString("D"),
            before: new
            {
                engineeringSurvey = skipped
                    .Select(s => new { id = s.Child.Id, assigneeId = s.AssigneeId, name = s.Name })
                    .ToArray(),
            },
            after: new
            {
                engineeringSurvey = (string?)null,
                reason,
                poNumber = parent.PoNumber,
                propertyId = parent.PropertyId,
                actorName,
                actorRole = actor.Role ?? "",
                actorSubRoles = actor.SubRoles ?? Array.Empty<string>(),
            }), cancellationToken);

        return (WorkflowTaskMapper.ToDto(parent), null);
    }

    /// <summary>Tells each office whose survey was skipped; an office with no resolvable user is left out.</summary>
    private async Task NotifySurveySkippedAsync(
        WorkflowTask parent,
        IReadOnlyCollection<(WorkflowTask Child, string AssigneeId)> skipped,
        string reason,
        CancellationToken cancellationToken)
    {
        var assigneeIds = skipped
            .Select(s => s.AssigneeId)
            .Where(id => id.Length > 0)
            .Distinct(StringComparer.Ordinal)
            .ToList();
        if (assigneeIds.Count == 0) return;
        var usersByAssignee = await _recipients.ResolveUserIdsForDistributionAssigneesAsync(
            assigneeIds,
            cancellationToken);
        if (usersByAssignee.Count == 0) return;

        var refLabel = WorkflowTaskDistributionRules.RefLabel(
            await ParentDeedAsync(parent, cancellationToken),
            parent.PoNumber);
        foreach (var (child, assigneeId) in skipped)
        {
            if (!usersByAssignee.TryGetValue(assigneeId, out var userId)) continue;
            await _notifications.CreateForUserAsync(
                userId,
                EngineeringSurveySettlementRules.SkippedRequest(child, refLabel, reason),
                cancellationToken);
        }
    }
}

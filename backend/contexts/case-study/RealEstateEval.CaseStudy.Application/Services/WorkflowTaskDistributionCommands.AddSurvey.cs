using RealEstateEval.Application;
using RealEstateEval.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Mapping;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Application.Services;

public sealed partial class WorkflowTaskDistributionCommands
{
    /// <summary>
    /// «إضافة رفع مساحي» — the engineering office joins after distribution (2026-10-29: the inspector
    /// corrected the type and the new one needs a survey).
    /// How it works: the same party child the confirm spawns, assigned to the chosen office; the parent's
    /// distribution records the office; the office is told like any assignment; a timeline row and an
    /// audit row record who added it.
    /// Edge cases: refused while the property needs no survey, while a survey is already live, outside
    /// the study phase, or for a role that may not redistribute.
    /// </summary>
    public async Task<(WorkflowTaskDto? Result, IReadOnlyDictionary<string, string>? Errors)> AddEngineeringSurveyAsync(
        Guid id,
        AddEngineeringSurveyRequest request,
        string actorRole,
        string? actorName,
        string? actorUserId = null,
        CancellationToken cancellationToken = default)
    {
        if (!WorkflowTaskLifecycleRules.CanRedistributeParties(actorRole))
            return (null, Error("إضافة الرفع المساحي صلاحية أخصائي دراسة الحالة أو مشرف القسم أو مسؤول التحول الرقمي"));

        var parent = await _caseStudy.GetTaskForUpdateAsync(id, cancellationToken);
        if (parent is null) return (null, null);
        if (parent.Kind != CaseStudyPropertyKind)
            return (null, Error("يُضاف الرفع المساحي لمعاملات دراسة الحالة فقط"));
        if (parent.Phase != WorkflowTaskPhase.CaseStudy)
            return (null, Error("إضافة الرفع المساحي متاحة بعد تأكيد التوزيع (مرحلة دراسة الحالة)"));
        if (parent.PropertyId is not Guid propertyId)
            return (null, Error("لا يوجد عقار مرتبط بالمعاملة"));

        var property = await _caseStudy.GetPropertyAsync(propertyId, cancellationToken);
        if (property is null || !SurveyRequirementRules.PropertyRequiresSurvey(property))
            return (null, Error("العقار لا يحتاج رفعاً مساحياً"));

        var children = await _caseStudy.ListChildrenForUpdateAsync(parent.Id, cancellationToken);
        if (children.Any(c => c.Kind == WorkflowTaskKind.EngineeringSurvey && c.Status != WorkflowTaskStatus.Cancelled))
            return (null, Error("يوجد رفع مساحي على هذا العقار"));

        var assigneeId = WorkflowTaskDistributionRules.NormalizeAssigneeId(request.AssigneeId);
        if (string.IsNullOrWhiteSpace(assigneeId))
            return (null, new Dictionary<string, string> { ["assigneeId"] = "اختر المكتب الهندسي" });

        var now = _time.UtcNow();
        var name = string.IsNullOrWhiteSpace(request.AssigneeName) ? "مكتب هندسي" : request.AssigneeName.Trim();
        var deed = await ParentDeedAsync(parent, cancellationToken);
        var child = WorkflowTaskPhaseRules.SpawnChild(
            parent,
            WorkflowTaskKind.EngineeringSurvey,
            StaffRoleIds.EngineeringOffice,
            name,
            assigneeId,
            deed,
            now);

        var distribution = WorkflowTaskMapper.DeserializeDistribution(parent.DistributionJson)
            ?? new TaskDistributionDraftDto();
        distribution.EngineeringOffice = true;
        distribution.EngineeringOfficeId = assigneeId;
        parent.SetDistribution(WorkflowTaskMapper.SerializeDistribution(distribution), now);

        _caseStudy.AddTasks([child]);
        await _caseStudy.SaveChangesAsync(cancellationToken);

        await _timeline.RecordAsync(
            parent.PoNumber,
            propertyId,
            $"party:{child.Id}:survey-added:{now.Ticks}",
            "إضافة رفع مساحي",
            $"{name} — {(string.IsNullOrWhiteSpace(actorName) ? "الأخصائي" : actorName.Trim())}",
            PropertyTimelineTones.Active,
            now,
            cancellationToken);
        await NotifyDistributionAssignedAsync(parent, [child], deed, cancellationToken);
        await _auditLog.AppendAsync(_audit.Create(
            actorId: string.IsNullOrWhiteSpace(actorUserId) ? "unknown" : actorUserId,
            action: "case-study.workflow-task.engineering-survey-added",
            entityType: "WorkflowTask",
            entityId: parent.Id.ToString("D"),
            before: new { engineeringSurvey = (string?)null },
            after: new
            {
                engineeringSurvey = new { id = child.Id, assigneeId, name },
                poNumber = parent.PoNumber,
                propertyId,
                actorName,
                actorRole,
            }), cancellationToken);

        return (WorkflowTaskMapper.ToDto(child), null);
    }
}

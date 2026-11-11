using RealEstateEval.Application;
using RealEstateEval.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Mapping;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Domain;
using RealEstateEval.Application.Rules;

namespace RealEstateEval.CaseStudy.Application.Services;

public sealed partial class WorkflowTaskDistributionCommands
{
    /// <summary>
    /// «إضافة رفع مساحي» — the engineering office joins after distribution (2026-10-29: the inspector
    /// corrected the type and the new one needs a survey). Since 2026-11-11 (Omar) the screens reach it
    /// from «مهمة جديدة» in «المهام», type «رفع مساحي» — for any property that needs a survey and has
    /// none live (left out at the distribution, a corrected type, or an office skipped earlier).
    /// How it works: the same party child the confirm spawns, assigned to the chosen office; the parent's
    /// distribution records the office; the office is told like any assignment; a timeline row and an
    /// audit row record who added it.
    /// A property the survey rule asks no survey for (registered title, approved plan, unit inside a
    /// building) takes the office by exception (Omar 2026-11-11: the need is sometimes seen on site):
    /// a reason is required then, and the timeline and the audit row carry it. The rule itself is not
    /// changed — the distribution still offers the office only where the rule asks for it.
    /// Edge cases: refused without that reason, while a survey is already live, outside the study
    /// phase, or for a role that may not redistribute. A reason sent for a property the rule already
    /// covers is ignored. An exception survey holds the study report and is skipped like any other.
    /// </summary>
    public async Task<(WorkflowTaskDto? Result, IReadOnlyDictionary<string, string>? Errors)> AddEngineeringSurveyAsync(
        Guid id,
        AddEngineeringSurveyRequest request,
        StaffActor actor,
        string? actorName,
        string? actorUserId = null,
        CancellationToken cancellationToken = default)
    {
        if (!WorkflowTaskLifecycleRules.CanRedistributeParties(actor))
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
        if (property is null)
            return (null, Error("لا يوجد عقار مرتبط بالمعاملة"));

        // Outside the survey rule the office is added by exception, with the reason on record.
        var byException = !SurveyRequirementRules.PropertyRequiresSurvey(property);
        var exceptionReason = byException ? WorkflowTaskLifecycleRules.NormalizeReason(request.ExceptionReason) : "";
        if (byException)
        {
            var reasonError = WorkflowTaskLifecycleRules.ReasonError(
                exceptionReason,
                SurveyRequirementRules.ExceptionReasonRequiredAr,
                "السبب طويل جداً");
            if (reasonError is not null) return (null, reasonError);
        }

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
            $"{name} — {(string.IsNullOrWhiteSpace(actorName) ? "الأخصائي" : actorName.Trim())}"
                + (byException ? $" — استثناءً من قاعدة الرفع المساحي: {exceptionReason}" : ""),
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
                byException,
                exceptionReason = byException ? exceptionReason : null,
                poNumber = parent.PoNumber,
                propertyId,
                actorName,
                actorRole = actor.Role ?? "",
                actorSubRoles = actor.SubRoles ?? Array.Empty<string>(),
            }), cancellationToken);

        return (WorkflowTaskMapper.ToDto(child), null);
    }
}

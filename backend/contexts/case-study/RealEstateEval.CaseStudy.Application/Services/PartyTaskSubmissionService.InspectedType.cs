using RealEstateEval.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Mapping;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Application.Services;

public sealed partial class PartyTaskSubmissionService
{
    /// <summary>The study issue refusal while the corrected type needs a survey nobody was given.</summary>
    public const string SurveyNeededAfterTypeChangeAr =
        "يلزم رفع مساحي بعد تغيير نوع العقار ميدانياً — أضف المكتب الهندسي";

    /// <summary>
    /// The inspector corrected the bourse type on site (2026-10-29 ruling).
    /// How it works: records the change on the property timeline (the «الجدول الزمني» card and the
    /// «السجل والتدقيق» tab read it) and in the system audit log; then follows the survey rule of the
    /// new type — a survey it needs that nobody was given is asked of the case specialist (he adds the
    /// office), and a survey it no longer needs is withdrawn at once, the office not told.
    /// Edge cases: a survey already completed stays — done work and its fee are not undone. No reason
    /// and no specialist approval are asked for the change itself.
    /// </summary>
    private async Task OnInspectedTypeChangedAsync(
        WorkflowTask inspectionTask,
        InspectedTypeChange change,
        PartySubmissionActor? actor,
        DateTime now,
        CancellationToken cancellationToken)
    {
        if (inspectionTask.PropertyId is not Guid propertyId) return;

        var by = actor?.DisplayName?.Trim() is { Length: > 0 } name ? name : inspectionTask.AssigneeName;
        var from = change.PreviousType.Length > 0 ? change.PreviousType : "—";
        await _timeline.RecordAsync(
            inspectionTask.PoNumber,
            propertyId,
            $"inspected-type:{inspectionTask.Id}:{now.Ticks}",
            "تغيير نوع العقار ميدانياً",
            $"من «{from}» إلى «{change.NewType}» — {by}",
            PropertyTimelineTones.Warn,
            now,
            cancellationToken);
        await _auditLog.AppendAsync(_audit.Create(
            actorId: string.IsNullOrWhiteSpace(actor?.UserId) ? "unknown" : actor.UserId,
            action: "case-study.property.inspected-type-changed",
            entityType: "WorkOrderProperty",
            entityId: propertyId.ToString("D"),
            before: new
            {
                propertyType = change.PreviousType,
                classification = PropertyTypeCatalog.ClassificationOf(change.PreviousType),
            },
            after: new
            {
                propertyType = change.NewType,
                classification = PropertyTypeCatalog.ClassificationOf(change.NewType),
                poNumber = inspectionTask.PoNumber,
            }), cancellationToken);

        var survey = await FindSiblingAsync(inspectionTask, WorkflowTaskKind.EngineeringSurvey, cancellationToken);
        var surveyLive = survey is not null && survey.Status != WorkflowTaskStatus.Cancelled;
        if (change.SurveyRequiredAfter && !surveyLive)
            await AskSpecialistForSurveyAsync(inspectionTask, propertyId, change, now, cancellationToken);
        else if (!change.SurveyRequiredAfter && survey is not null && !survey.IsTerminal)
            await WithdrawSurveyAsync(inspectionTask, survey, propertyId, change, actor, now, cancellationToken);
    }

    /// <summary>The new type needs a survey that was never distributed: the case specialist adds the office.</summary>
    private async Task AskSpecialistForSurveyAsync(
        WorkflowTask inspectionTask,
        Guid propertyId,
        InspectedTypeChange change,
        DateTime now,
        CancellationToken cancellationToken)
    {
        await _timeline.RecordAsync(
            inspectionTask.PoNumber,
            propertyId,
            $"inspected-type:{inspectionTask.Id}:survey-needed:{now.Ticks}",
            "يلزم رفع مساحي",
            $"النوع الجديد «{change.NewType}» يحتاج رفعاً مساحياً — بانتظار إضافة المكتب الهندسي",
            PropertyTimelineTones.Warn,
            now,
            cancellationToken);

        if (inspectionTask.ParentTaskId is not Guid parentId) return;
        var parent = await _repo.GetTaskAsync(parentId, cancellationToken);
        var specialistId = parent?.AssigneeId?.Trim();
        if (string.IsNullOrWhiteSpace(specialistId)) return;
        var userId = await _recipients.ResolveUserIdForDistributionAssigneeAsync(specialistId, cancellationToken);
        if (string.IsNullOrWhiteSpace(userId)) return;

        var refLabel = inspectionTask.PoNumber?.Trim();
        await _notifications.CreateForUsersAsync(
            [userId],
            new CreateUserNotificationRequest
            {
                Title = "يلزم رفع مساحي",
                Body = $"غيّر المعاين نوع العقار إلى «{change.NewType}»{(string.IsNullOrEmpty(refLabel) ? "" : $" على {refLabel}")} — "
                    + "النوع الجديد يحتاج رفعاً مساحياً. أضف المكتب الهندسي من مساحة العمل.",
                Tone = "warn",
                Href = $"/case-study/{Uri.EscapeDataString(parentId.ToString())}",
                Category = "workflow",
                EntityType = "task",
                EntityId = parentId.ToString(),
                SourceEvent = $"inspected-type-survey-needed:{inspectionTask.Id}:{now.Ticks}",
            },
            cancellationToken);
    }

    /// <summary>
    /// The study's distribution no longer names the engineering office — the parties rail, the study queue's
    /// office column and the deed-match context read the distribution, and kept showing the withdrawn office
    /// «قيد التنفيذ» (A→Z test 2026-10-29).
    /// </summary>
    private async Task ClearOfficeFromDistributionAsync(WorkflowTask inspectionTask, CancellationToken cancellationToken)
    {
        if (inspectionTask.ParentTaskId is not Guid parentId) return;
        var parent = await _repo.GetTaskAsync(parentId, cancellationToken);
        var distribution = WorkflowTaskMapper.DeserializeDistribution(parent?.DistributionJson);
        if (distribution is null || (!distribution.EngineeringOffice && string.IsNullOrEmpty(distribution.EngineeringOfficeId)))
            return;
        distribution.EngineeringOffice = false;
        distribution.EngineeringOfficeId = "";
        await _tasks.PatchAsync(parentId, new PatchWorkflowTaskRequest { Distribution = distribution }, cancellationToken);
    }

    /// <summary>The new type needs no survey: the open survey task is cancelled at once, the office not told.</summary>
    private async Task WithdrawSurveyAsync(
        WorkflowTask inspectionTask,
        WorkflowTask survey,
        Guid propertyId,
        InspectedTypeChange change,
        PartySubmissionActor? actor,
        DateTime now,
        CancellationToken cancellationToken)
    {
        await _tasks.PatchAsync(
            survey.Id,
            new PatchWorkflowTaskRequest { Status = WorkflowTaskStatusValues.Cancelled },
            cancellationToken);
        await ClearOfficeFromDistributionAsync(inspectionTask, cancellationToken);
        await _timeline.RecordAsync(
            inspectionTask.PoNumber,
            propertyId,
            $"inspected-type:{inspectionTask.Id}:survey-withdrawn:{now.Ticks}",
            "سُحب الرفع المساحي",
            $"النوع الجديد «{change.NewType}» لا يحتاج رفعاً مساحياً — {survey.AssigneeName}",
            PropertyTimelineTones.Muted,
            now,
            cancellationToken);
        await _auditLog.AppendAsync(_audit.Create(
            actorId: string.IsNullOrWhiteSpace(actor?.UserId) ? "unknown" : actor.UserId,
            action: "case-study.engineering-survey.withdrawn",
            entityType: "WorkflowTask",
            entityId: survey.Id.ToString("D"),
            before: new { status = survey.Status.ToString() },
            after: new { status = "Cancelled", reason = "inspected-type-changed", propertyType = change.NewType }),
            cancellationToken);
    }
}

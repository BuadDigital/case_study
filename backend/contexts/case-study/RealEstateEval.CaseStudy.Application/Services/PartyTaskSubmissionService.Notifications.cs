using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Services;

public partial class PartyTaskSubmissionService
{
    private async Task NotifyPartyAssigneeAsync(
        WorkflowTask task,
        string title,
        string body,
        string tone,
        string sourceEvent,
        string href,
        CancellationToken cancellationToken)
    {
        var assigneeId = task.AssigneeId?.Trim();
        if (string.IsNullOrWhiteSpace(assigneeId)) return;

        var userId = await _recipients.ResolveUserIdForDistributionAssigneeAsync(
            assigneeId,
            cancellationToken);
        if (string.IsNullOrWhiteSpace(userId)) return;

        await _notifications.CreateForUserAsync(
            userId,
            new CreateUserNotificationRequest
            {
                Title = title,
                Body = body,
                Tone = tone,
                Href = href,
                Category = "workflow",
                EntityType = "task",
                EntityId = task.Id.ToString(),
                SourceEvent = sourceEvent,
            },
            cancellationToken);
    }

    private Task NotifyPartyReturnedForCorrectionAsync(
        WorkflowTask task,
        string returnNote,
        CancellationToken cancellationToken)
    {
        var note = returnNote.Trim();
        var (title, body, prefix, path) = task.Kind switch
        {
            WorkflowTaskKind.EngineeringSurvey => (
                "إعادة الرفع المساحي للتصحيح",
                "أُعيدت مخرجات الرفع المساحي للتصحيح",
                "engineering-survey-returned",
                "/active-survey/"),
            WorkflowTaskKind.FieldInspection => (
                "إعادة المعاينة للتصحيح",
                "أُعيدت بيانات المعاينة للتصحيح",
                "field-inspection-returned",
                "/active-inspection/"),
            _ => (
                "إعادة التقييم للتصحيح",
                "أُعيد تقييم العقار للتصحيح",
                "property-appraisal-returned",
                "/property-appraisal/"),
        };

        return NotifyPartyAssigneeAsync(
            task,
            title: title,
            body: note.Length == 0 ? $"{body}." : $"{body}: {note}",
            tone: "warn",
            sourceEvent: $"{prefix}:{task.Id}",
            href: $"{path}{Uri.EscapeDataString(task.Id.ToString())}",
            cancellationToken);
    }

    private async Task NotifyPartyAcceptedAsync(WorkflowTask task, CancellationToken cancellationToken)
    {
        switch (task.Kind)
        {
            case WorkflowTaskKind.EngineeringSurvey:
                await NotifyPartyAssigneeAsync(
                    task,
                    title: "قبول مخرجات الرفع المساحي",
                    body: "تم قبول مخرجات الرفع المساحي واستحقاق الأتعاب.",
                    tone: "success",
                    sourceEvent: $"engineering-survey-accepted:{task.Id}",
                    href: $"/active-survey/{Uri.EscapeDataString(task.Id.ToString())}",
                    cancellationToken);
                break;

            case WorkflowTaskKind.FieldInspection:
                await NotifyPartyAssigneeAsync(
                    task,
                    title: "اعتماد بيانات المعاينة",
                    body: "اعتمد الأخصائي بيانات المعاينة. تظهر البيانات المعتمدة في حزمة الرفع على إنفاذ، ويمكن للمقيّم بدء التقييم.",
                    tone: "success",
                    sourceEvent: $"field-inspection-accepted:{task.Id}",
                    href: $"/active-inspection/{Uri.EscapeDataString(task.Id.ToString())}",
                    cancellationToken);
                await NotifySiblingAppraiserInspectionAcceptedAsync(task, cancellationToken);
                break;

            case WorkflowTaskKind.PropertyAppraisal:
                await NotifyPartyAssigneeAsync(
                    task,
                    title: "استلام تقرير التقييم",
                    body: "استلم الأخصائي تقرير التقييم. هذا إقرار بالاستلام وليس اعتماداً للقيمة — حزمة إنفاذ تتغذى من التقرير المُرسل.",
                    tone: "success",
                    sourceEvent: $"property-appraisal-accepted:{task.Id}",
                    href: $"/property-appraisal/{Uri.EscapeDataString(task.Id.ToString())}",
                    cancellationToken);
                break;
        }
    }

    /// <summary>
    /// Party submit (engineering office / inspector / evaluator) only raised a same-tab
    /// frontend event, which never reached the assigned case specialist or the section
    /// supervisor. Fan out server-side so both get an inbox notification on submit.
    /// </summary>
    private async Task NotifySpecialistAndSupervisorOnSubmitAsync(
        WorkflowTask task,
        CancellationToken cancellationToken)
    {
        if (!SubmitNotificationText.TryGetValue(task.Kind, out var text)) return;
        if (task.ParentTaskId is not Guid parentTaskId) return;

        var parent = await _repo.GetTaskAsync(parentTaskId, cancellationToken);
        if (parent is null) return;

        var userIds = new HashSet<string>(StringComparer.Ordinal);

        var specialistAssigneeId = parent.AssigneeId?.Trim();
        if (!string.IsNullOrWhiteSpace(specialistAssigneeId))
        {
            var specialistUserId = await _recipients.ResolveUserIdForDistributionAssigneeAsync(
                specialistAssigneeId,
                cancellationToken);
            if (!string.IsNullOrWhiteSpace(specialistUserId))
                userIds.Add(specialistUserId);
        }

        var supervisorUserIds = await _recipients.ResolveUserIdsWithPrototypeRoleAsync(
            "section-supervisor",
            cancellationToken);
        foreach (var id in supervisorUserIds)
            userIds.Add(id);

        if (userIds.Count == 0) return;

        var refLabel = task.PoNumber?.Trim();
        var body = string.IsNullOrEmpty(refLabel) ? $"{text.Body}." : $"{text.Body} على {refLabel}.";

        await _notifications.CreateForUsersAsync(
            userIds,
            new CreateUserNotificationRequest
            {
                Title = text.Title,
                Body = body,
                Tone = "info",
                Href = $"/case-study/{Uri.EscapeDataString(parent.Id.ToString())}",
                Category = "workflow",
                EntityType = "task",
                EntityId = parent.Id.ToString(),
                SourceEvent = $"party-submitted:{task.Id}",
            },
            cancellationToken);
    }

    private async Task<WorkflowTask?> FindSiblingAsync(
        WorkflowTask task,
        WorkflowTaskKind kind,
        CancellationToken cancellationToken)
    {
        if (task.ParentTaskId is not Guid parentId || task.PropertyId is not Guid propertyId)
            return null;

        var siblings = await _repo.ListSiblingTasksAsync([parentId], [propertyId], cancellationToken);
        return siblings.FirstOrDefault(t => t.Kind == kind);
    }

    /// <summary>
    /// When the inspector submits field inspection, tell the sibling engineering-office
    /// assignee that work on the property has started and survey can begin.
    /// </summary>
    private async Task NotifySiblingSurveyInspectionSubmittedAsync(
        WorkflowTask inspectionTask,
        CancellationToken cancellationToken)
    {
        var survey = await FindSiblingAsync(inspectionTask, WorkflowTaskKind.EngineeringSurvey, cancellationToken);
        if (survey is null) return;

        var refLabel = inspectionTask.PoNumber?.Trim();
        var body = string.IsNullOrEmpty(refLabel)
            ? "رفع المعاين المعاينة الميدانية. يمكنك الآن بدء الرفع المساحي على العقار."
            : $"رفع المعاين المعاينة الميدانية على {refLabel}. يمكنك الآن بدء الرفع المساحي على العقار.";

        await NotifyPartyAssigneeAsync(
            survey,
            title: "بدء العمل على العقار — رُفعت المعاينة",
            body: body,
            tone: "info",
            sourceEvent: $"field-inspection-submitted-survey:{inspectionTask.Id}",
            href: $"/active-survey/{Uri.EscapeDataString(survey.Id.ToString())}",
            cancellationToken);
    }

    private async Task NotifySiblingAppraiserInspectionAcceptedAsync(
        WorkflowTask inspectionTask,
        CancellationToken cancellationToken)
    {
        var appraisal = await FindSiblingAsync(inspectionTask, WorkflowTaskKind.PropertyAppraisal, cancellationToken);
        if (appraisal is null) return;

        await NotifyPartyAssigneeAsync(
            appraisal,
            title: "بيانات المعاينة معتمدة — يمكن بدء التقييم",
            body: "اعتمد الأخصائي بيانات الأطراف. يمكنك الآن حساب القيمة داخل النظام.",
            tone: "success",
            sourceEvent: $"field-inspection-accepted-appraiser:{inspectionTask.Id}",
            href: $"/property-appraisal/{Uri.EscapeDataString(appraisal.Id.ToString())}",
            cancellationToken);
    }
}

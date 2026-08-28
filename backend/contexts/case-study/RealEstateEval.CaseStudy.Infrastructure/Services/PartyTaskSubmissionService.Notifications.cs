using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Authorization;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Notifications;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.Failures.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Application.Rules;

namespace RealEstateEval.CaseStudy.Infrastructure.Services;

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

 /// <summary>
 /// Party submit (engineering office / inspector / evaluator) currently only notifies via a
 /// same-tab frontend window event, which never reaches the assigned case specialist or the
 /// section supervisor on their own sessions. Fan out server-side so both actually get an
 /// inbox notification when a party sends work in for review.
 /// </summary>
    private async Task NotifySpecialistAndSupervisorOnSubmitAsync(
        WorkflowTask task,
        CancellationToken cancellationToken)
    {
        if (!SubmitNotificationText.TryGetValue(task.Kind, out var text)) return;
        if (task.ParentTaskId is not Guid parentTaskId) return;

        var parent = await _db.WorkflowTasks.AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == parentTaskId, cancellationToken);
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

    /// <summary>
    /// When the inspector submits field inspection, tell the sibling engineering-office
    /// assignee that work on the property has started and survey can begin.
    /// </summary>
    private async Task NotifySiblingSurveyInspectionSubmittedAsync(
        WorkflowTask inspectionTask,
        CancellationToken cancellationToken)
    {
        if (inspectionTask.ParentTaskId is not Guid parentId
            || inspectionTask.PropertyId is not Guid propertyId)
            return;

        var survey = await _db.WorkflowTasks.AsNoTracking()
            .FirstOrDefaultAsync(
                t => t.ParentTaskId == parentId
                    && t.PropertyId == propertyId
                    && t.Kind == WorkflowTaskKind.EngineeringSurvey,
                cancellationToken);
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
        if (inspectionTask.ParentTaskId is not Guid parentId
            || inspectionTask.PropertyId is not Guid propertyId)
            return;

        var appraisal = await _db.WorkflowTasks.AsNoTracking()
            .FirstOrDefaultAsync(
                t => t.ParentTaskId == parentId
                    && t.PropertyId == propertyId
                    && t.Kind == WorkflowTaskKind.PropertyAppraisal,
                cancellationToken);
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

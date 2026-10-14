using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Shared.Contracts;

namespace RealEstateEval.CaseStudy.Application.Services;

public partial class CaseStudyReportService
{
    /// <summary>
    /// Issuing the report is what opens the appraiser's submission. The source event carries the
    /// issue timestamp because an unread duplicate notification is merged — a re-issue after a
    /// reopening must still reach the appraiser.
    /// </summary>
    private Task NotifyAppraiserStudyReportIssuedAsync(
        CaseStudyReport report,
        Guid? propertyId,
        CancellationToken cancellationToken) =>
        NotifyAppraiserAsync(
            propertyId,
            title: "صدر تقرير دراسة الحالة",
            body: "أصدر الأخصائي تقرير دراسة الحالة — يمكنك الآن تسليم التقييم.",
            tone: NotificationContract.Tones.Success,
            sourceEvent: $"study-report-issued:{report.Id}:{report.UpdatedAtUtc:O}",
            cancellationToken);

    /// <summary>
    /// The report was reopened after the appraiser had already submitted. The package is left as
    /// it is; the appraiser only needs to know the study it was built on is open again.
    /// </summary>
    private Task NotifyAppraiserStudyReportReopenedAsync(
        CaseStudyReport report,
        Guid? propertyId,
        string reason,
        CancellationToken cancellationToken) =>
        NotifyAppraiserAsync(
            propertyId,
            title: "أُعيد فتح تقرير دراسة الحالة",
            body: $"أعاد الأخصائي فتح تقرير دراسة الحالة بعد تسليمك التقييم: {reason}. سيحدد الأخصائي ما يلزم.",
            tone: NotificationContract.Tones.Warn,
            sourceEvent: $"study-report-reopened:{report.Id}:{report.UpdatedAtUtc:O}",
            cancellationToken);

    private async Task NotifyAppraiserAsync(
        Guid? propertyId,
        string title,
        string body,
        string tone,
        string sourceEvent,
        CancellationToken cancellationToken)
    {
        if (_notifications is null || _recipients is null) return;
        if (propertyId is not Guid pid || pid == Guid.Empty) return;

        var recipients = await _recipients.ResolveAssigneeUserIdsForPropertyAsync(
            pid,
            [WorkflowTaskKind.PropertyAppraisal],
            cancellationToken);
        if (recipients.Count == 0) return;

        await _notifications.CreateForUsersAsync(
            recipients,
            new CreateUserNotificationRequest
            {
                Title = title,
                Body = body,
                Tone = tone,
                Href = "/property-appraisal",
                Category = NotificationContract.Categories.Workflow,
                EntityType = NotificationContract.EntityTypes.Property,
                EntityId = pid.ToString("D"),
                SourceEvent = sourceEvent,
            },
            cancellationToken);
    }

    /// <summary>
    /// The deed↔nature match is the specialist decision the appraiser's calculation is gated on
    /// («بانتظار مطابقة الصك على الطبيعة»). Before this they had to keep reopening the screen to
    /// find out it had been decided.
    /// </summary>
    private async Task NotifyAppraiserOnMatchOutcomeAsync(
        Guid taskId,
        CaseStudyReport entity,
        string previousOutcome,
        CancellationToken cancellationToken)
    {
        if (_notifications is null || _recipients is null) return;

        var outcome = (entity.DeedNatureMatchOutcome ?? "").Trim();
        if (outcome.Length == 0 || string.Equals(outcome, previousOutcome, StringComparison.Ordinal))
            return;

        var propertyId = entity.PropertyId;
        if (propertyId is not Guid pid || pid == Guid.Empty)
        {
            var task = await _db.GetTaskAsync(taskId, cancellationToken);
            propertyId = task?.PropertyId;
        }
        if (propertyId is not Guid resolved || resolved == Guid.Empty) return;

        var recipients = await _recipients.ResolveAssigneeUserIdsForPropertyAsync(
            resolved,
            [WorkflowTaskKind.PropertyAppraisal],
            cancellationToken);
        if (recipients.Count == 0) return;

        var matched = string.Equals(
            DeedNatureMatchOutcomes.Normalize(outcome),
            DeedNatureMatchOutcomes.Matched,
            StringComparison.Ordinal);
        var notes = (entity.DeedNatureMatchNotes ?? "").Trim();
        var body = matched
            ? "اعتمد الأخصائي مطابقة الصك على الطبيعة — رُفع الحجب عن حساب القيمة"
            : "سجّل الأخصائي نتيجة مطابقة الصك على الطبيعة — راجع تبويب تقييم العقار";

        await _notifications.CreateForUsersAsync(
            recipients,
            new CreateUserNotificationRequest
            {
                Title = matched ? "مطابقة الصك معتمدة" : "نتيجة مطابقة الصك",
                Body = notes.Length == 0 ? $"{body}." : $"{body}: {notes}",
                Tone = matched ? NotificationContract.Tones.Success : NotificationContract.Tones.Warn,
                Href = "/property-appraisal",
                Category = NotificationContract.Categories.Workflow,
                EntityType = NotificationContract.EntityTypes.Property,
                EntityId = resolved.ToString("D"),
                SourceEvent = $"deed-nature-match:{entity.Id}:{outcome}",
            },
            cancellationToken);
    }
}

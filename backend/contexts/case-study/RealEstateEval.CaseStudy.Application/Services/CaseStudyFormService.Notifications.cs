using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Shared.Contracts;

namespace RealEstateEval.CaseStudy.Application.Services;

public partial class CaseStudyFormService
{
    /// <summary>
    /// The deed↔nature match is the specialist decision the appraiser's calculation is gated on
    /// («بانتظار مطابقة الصك على الطبيعة»). Before this they had to keep reopening the screen to
    /// find out it had been decided.
    /// </summary>
    private async Task NotifyAppraiserOnMatchOutcomeAsync(
        Guid taskId,
        CaseStudyForm entity,
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

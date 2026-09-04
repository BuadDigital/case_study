using System.Text.Json;
using RealEstateEval.Application;
using RealEstateEval.Domain;
using RealEstateEval.Operations.Application.Contracts;
using RealEstateEval.Operations.Application.Rules;
using RealEstateEval.Operations.Domain;

namespace RealEstateEval.Operations.Application.Services;

public sealed partial class KeyEnvelopesService
{
    public async Task<IReadOnlyList<PropertyCourtAccessDto>> ListCourtAccessAsync(
        string? requestNumber = null,
        CancellationToken cancellationToken = default)
    {
        var rows = await _repo.ListCourtAccessAsync(requestNumber, cancellationToken);
        return rows.Select(KeyEnvelopeMapper.ToAccessDto).ToList();
    }

    public async Task<(PropertyCourtAccessDto? Access, string? Error)> UpsertCourtAccessAsync(
        UpsertPropertyCourtAccessRequest request,
        string actorUserId,
        string actorDisplayName,
        CancellationToken cancellationToken = default)
    {
        var property = await _caseStudy.GetPropertyAsync(request.PropertyId, cancellationToken);
        if (property is null) return (null, "العقار غير موجود");

        if (request.HasEnablingLetter)
        {
            if (request.EnablingLetterAttachmentId is null
                || request.EnablingLetterAttachmentId == Guid.Empty)
                return (null, "مرفق خطاب التمكين مطلوب");
            if (!await AttachmentExistsAsync(request.EnablingLetterAttachmentId.Value, cancellationToken))
                return (null, "ملف خطاب التمكين غير موجود");
        }

        if (request.HasEvictionNotice)
        {
            if (request.EvictionNoticeAttachmentId is null
                || request.EvictionNoticeAttachmentId == Guid.Empty)
                return (null, "مرفق محظر الإخلاء مطلوب");
            if (!await AttachmentExistsAsync(request.EvictionNoticeAttachmentId.Value, cancellationToken))
                return (null, "ملف محظر الإخلاء غير موجود");
        }

        var now = _time.UtcNow();
        var row = await _repo.FindCourtAccessAsync(request.PropertyId, cancellationToken);

        if (row is null)
        {
            row = new PropertyCourtAccess
            {
                Id = Guid.NewGuid(),
                PropertyId = property.Id,
            };
            await _repo.AddCourtAccessAsync(row, cancellationToken);
        }

        var previousHold = row.StudyHoldStatus;

        row.PoNumber = property.PoNumber;
        row.DeedNumber = property.DeedNumber;
        row.RequestNumber = property.RequestNumber;

        if (request.HasEnablingLetter)
        {
            row.HasEnablingLetter = true;
            row.EnablingLetterAttachmentId = request.EnablingLetterAttachmentId;
        }
        else
        {
            row.HasEnablingLetter = false;
            row.EnablingLetterAttachmentId = null;
        }

        if (request.HasEvictionNotice)
        {
            row.HasEvictionNotice = true;
            row.EvictionNoticeAttachmentId = request.EvictionNoticeAttachmentId;
        }
        else
        {
            row.HasEvictionNotice = false;
            row.EvictionNoticeAttachmentId = null;
        }

        if (row.HasEvictionNotice)
            row.StudyHoldStatus = PropertyCourtAccessStatuses.SuspendedEviction;
        else if (row.HasEnablingLetter)
            row.StudyHoldStatus = PropertyCourtAccessStatuses.EnabledNoKey;
        else
            row.StudyHoldStatus = PropertyCourtAccessStatuses.None;

        row.ContactPhones = Texts.NullIfBlank(request.ContactPhones);
        row.Notes = Texts.NullIfBlank(request.Notes);
        row.UpdatedByUserId = actorUserId;
        row.UpdatedByName = actorDisplayName.Trim();
        row.UpdatedAtUtc = now;

        var holdStatus = row.StudyHoldStatus;
        var propertyId = row.PropertyId;
        await SaveAndDetachAsync(cancellationToken);

        if (holdStatus == PropertyCourtAccessStatuses.SuspendedEviction)
        {
            await _holds.EnsureEvictionHoldAsync(
                propertyId,
                actorDisplayName,
                cancellationToken);
        }
        else if (previousHold == PropertyCourtAccessStatuses.SuspendedEviction)
        {
            await _holds.ResolveEvictionHoldAsync(
                propertyId,
                actorDisplayName,
                cancellationToken);
        }

        var access = await _repo.GetCourtAccessAsync(propertyId, cancellationToken);
        return (access is null ? null : KeyEnvelopeMapper.ToAccessDto(access), null);
    }

    private async Task<string?> ValidateCourtVisitTaskLinkAsync(
        Guid taskId,
        CancellationToken cancellationToken)
    {
        var task = await _repo.FindCourtVisitTaskFactsAsync(taskId, cancellationToken);

        if (task is null)
            return "مهمة العمليات المرتبطة غير موجودة";
        if (task.Type != OperationsTaskType.CourtVisit)
            return "ربط الظرف مسموح فقط بمهمة زيارة محكمة";
        if (task.Status is not (OperationsTaskStatus.InProgress or OperationsTaskStatus.Completed))
            return "يجب أن تكون مهمة زيارة المحكمة قيد التنفيذ أو مكتملة لربط الظرف";

        if (task.Status == OperationsTaskStatus.Completed
            && !string.IsNullOrWhiteSpace(task.CourtVisitResultJson))
        {
            try
            {
                var result = JsonSerializer.Deserialize<OperationsTaskCourtVisitResultDto>(
                    task.CourtVisitResultJson,
                    JsonOpts);
                if (result is not null
                    && !string.IsNullOrWhiteSpace(result.Kind)
                    && result.Kind.Trim() != CourtVisitOutcomeKindValues.Received)
                {
                    return "تسجيل الظرف مرتبط بنتيجة «استُلم ظرف» فقط";
                }
            }
            catch
            {
 // Legacy / malformed JSON — allow link for completed court_visit.
            }
        }

        return null;
    }
}

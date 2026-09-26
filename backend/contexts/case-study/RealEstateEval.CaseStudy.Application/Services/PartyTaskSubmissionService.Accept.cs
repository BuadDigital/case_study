using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Services;

/// <summary>Specialist acceptance of a party package (fee accrual, sibling unblock, audit).</summary>
public partial class PartyTaskSubmissionService
{
    public async Task<(PartyTaskSubmissionDto? Result, Dictionary<string, string>? Errors)> AcceptAsync(
        Guid taskId,
        PartySubmissionActor actor,
        CancellationToken cancellationToken = default)
    {
        var task = await _repo.GetTaskAsync(taskId, cancellationToken);
        if (task is null)
            return (null, Error("المهمة غير موجودة"));

        if (!PartyTaskSubmissionRules.IsPartySubmissionKind(task.Kind))
            return (null, Error("قبول المخرجات غير متاح لهذا النوع من المهام"));

        if (!PoRoleMatrixRules.CanManagePartySubmissions(actor.PrototypeRole))
            return (null, Error("ليس لديك صلاحية قبول مخرجات الطرف"));

        var entity = await _repo.GetSubmissionAsync(taskId, track: true, cancellationToken);
        if (entity is null || entity.Status != PartyTaskSubmissionStatus.Submitted)
            return (null, Error("لا يوجد إرسال مكتمل لقبوله"));

        if (task.Status != WorkflowTaskStatus.Completed)
            return (null, Error("المهمة غير مكتملة بعد"));

        var actorUserId = PartyTaskSubmissionRules.AcceptActorUserId(actor);
        var alreadyAccepted = entity.AcceptedAtUtc is not null;

        InspectorFeeRowDto? accruedFee = null;
        if (task.Kind == WorkflowTaskKind.EngineeringSurvey)
        {
            // Fee accrual and acceptance timestamp must succeed or fail together.
            var (feeError, feeRow) = await _repo.ExecuteInTransactionAsync(
                async ct =>
                {
                    var (row, error) = await _inspectorFees.AccrueEngineeringSurveyFeeAsync(
                        taskId,
                        actorUserId,
                        ct);
                    if (error is not null)
                        return (Commit: false, Result: (Error: error, Row: (InspectorFeeRowDto?)null));

                    if (!alreadyAccepted)
                    {
                        _ = entity.Accept(_time.UtcNow(), actorUserId, actor.DisplayName);
                        await _repo.SaveChangesAsync(ct);
                    }

                    return (Commit: true, Result: (Error: (string?)null, Row: row));
                },
                cancellationToken);

            if (feeError is not null)
                return (null, Error(feeError));
            accruedFee = feeRow;
        }
        else if (!alreadyAccepted)
        {
            // Appraisal accept = specialist اعتماد of تقرير التقييم in دراسة الحالة.
            // Field inspection accept stamp is legacy/optional (no longer gates appraisal).
            _ = entity.Accept(_time.UtcNow(), actorUserId, actor.DisplayName);
            if (task.Kind == WorkflowTaskKind.FieldInspection && task.PropertyId is Guid boundaryPropertyId)
            {
                await _repo.SyncInspectorDeedBoundariesAsync(
                    boundaryPropertyId,
                    InspectorBoundarySyncRules.FromPayload(entity.PayloadJson),
                    cancellationToken);
            }
            await _repo.SaveChangesAsync(cancellationToken);
        }

        if (task.PropertyId is Guid propertyId)
        {
            await _timeline.RecordAsync(
                task.PoNumber,
                propertyId,
                $"party:{taskId}:accepted",
                PartyTaskSubmissionRules.AcceptedTimelineTitle(task.Kind),
                entity.AcceptedByName ?? task.AssigneeName,
                "done",
                _time.UtcNow(),
                cancellationToken);

            if (accruedFee is not null)
            {
                await _timeline.RecordAsync(
                    task.PoNumber,
                    propertyId,
                    $"party:{taskId}:fee-accrued",
                    "احتساب أتعاب الرفع المساحي",
                    $"{accruedFee.NetFeeSar:N0} ر.س",
                    "done",
                    _time.UtcNow(),
                    cancellationToken);
                await NotifyCdoFeeAccruedAsync(task, propertyId, accruedFee.NetFeeSar, cancellationToken);
            }
        }

        if (!alreadyAccepted)
            await NotifyPartyAcceptedAsync(task, cancellationToken);
            if (task.Kind == WorkflowTaskKind.FieldInspection)
                await NotifySiblingsInspectionAcceptedAsync(task, cancellationToken);

        if (!alreadyAccepted)
        {
            await _auditLog.AppendAsync(_audit.Create(
                actorId: string.IsNullOrWhiteSpace(actorUserId) ? "unknown" : actorUserId,
                action: "case-study.party-submission.accepted",
                entityType: "PartyTaskSubmission",
                entityId: taskId.ToString("D"),
                before: new { status = "Submitted" },
                after: new
                {
                    status = "Accepted",
                    kind = task.Kind.ToString(),
                    poNumber = task.PoNumber,
                    acceptedBy = entity.AcceptedByName,
                    acceptedAtUtc = entity.AcceptedAtUtc,
                }), cancellationToken);
        }

        return (await ToDtoAsync(entity, cancellationToken), null);
    }
}

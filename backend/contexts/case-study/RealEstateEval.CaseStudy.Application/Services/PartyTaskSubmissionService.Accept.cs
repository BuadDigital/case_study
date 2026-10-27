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

/// <summary>Specialist acceptance of a party package (fee accrual, sibling notices, audit).</summary>
public partial class PartyTaskSubmissionService
{
    /// <summary>
    /// Specialist accepts a party package. For the engineering survey this accrues the office's fee
    /// — straight to finance, or to the supervisor when <paramref name="request"/> carries a proposed
    /// discount.
    /// </summary>
    /// <remarks>
    /// <para><b>Proposal edge cases:</b></para>
    /// <list type="bullet">
    /// <item>A proposal on any other package (inspection, appraisal) is refused before anything
    /// happens — those fees are not accrued here, so there is nothing to discount.</item>
    /// <item>A proposal without a reason is refused as a field error (<c>discountReason</c>), so the
    /// dialog can point at the field.</item>
    /// <item>Re-accepting an accepted survey keeps the first acceptance stamp but still sends a new
    /// proposal to Financial, which routes it to the unbilled lines.</item>
    /// <item>Financial is a separate service: a refused proposal returns before the acceptance stamp
    /// is saved, so the package stays unaccepted and the specialist can retry.</item>
    /// </list>
    /// </remarks>
    public async Task<(PartyTaskSubmissionDto? Result, Dictionary<string, string>? Errors)> AcceptAsync(
        Guid taskId,
        PartySubmissionActor actor,
        CancellationToken cancellationToken = default,
        AcceptPartyTaskSubmissionRequest? request = null)
    {
        var task = await _repo.GetTaskAsync(taskId, cancellationToken);
        if (task is null)
            return (null, Error("المهمة غير موجودة"));

        // The specialist may propose a discount on the engineering office's fee while accepting its
        // outputs. The proposal is only meaningful for the survey (the one fee accrued here) and
        // always needs a reason — the supervisor decides on it and the office is told why.
        var proposesDiscount = request?.ProposedDiscountSar is > 0m;
        if (proposesDiscount && task.Kind != WorkflowTaskKind.EngineeringSurvey)
            return (null, Error("اقتراح الحسم عند القبول متاح لمخرجات الرفع المساحي فقط"));
        if (proposesDiscount && string.IsNullOrWhiteSpace(request!.DiscountReason))
            return (null, new Dictionary<string, string> { ["discountReason"] = "سبب الحسم المقترح إلزامي" });

        if (!PartyTaskSubmissionRules.IsPartySubmissionKind(task.Kind))
            return (null, Error("قبول المخرجات غير متاح لهذا النوع من المهام"));

        if (!PoRoleMatrixRules.CanManagePartySubmissions(actor.PrototypeRole))
            return (null, Error("ليس لديك صلاحية قبول مخرجات الطرف"));

        var entity = await _repo.GetSubmissionAsync(taskId, track: true, cancellationToken);
        if (entity is null || entity.Status != PartyTaskSubmissionStatus.Submitted)
            return (null, Error("لا يوجد إرسال مكتمل لقبوله"));

        // The appraiser's task stays open after the hand-over (it completes at the final issuance),
        // so only the other kinds must be completed before acceptance.
        if (task.Kind != WorkflowTaskKind.PropertyAppraisal && task.Status != WorkflowTaskStatus.Completed)
            return (null, Error("المهمة غير مكتملة بعد"));

        var actorUserId = PartyTaskSubmissionRules.AcceptActorUserId(actor);
        var alreadyAccepted = entity.AcceptedAtUtc is not null;

        // The specialist writes «مكونات العقار» (the report text) from the inspector's
        // description before accepting the inspection. The inventory table is not a condition.
        if (!alreadyAccepted
            && task.Kind == WorkflowTaskKind.FieldInspection
            && task.PropertyId is Guid gatePropertyId)
        {
            var gateProperty = await _repo.GetPropertyWithInventoryAsync(gatePropertyId, cancellationToken);
            var missing = gateProperty is null
                ? []
                : SpecialistComponentsRules.MissingForAcceptance(gateProperty);
            if (missing.Count > 0)
                return (null, missing);
        }

        InspectorFeeRowDto? accruedFee = null;
        if (task.Kind == WorkflowTaskKind.EngineeringSurvey)
        {
            // Fee accrual and acceptance timestamp must succeed or fail together.
            var (feeError, feeRow) = await _repo.ExecuteInTransactionAsync(
                async ct =>
                {
                    // With a proposal the accrued fee waits for the supervisor instead of going
                    // straight to finance; the proposer's name travels with it.
                    var (row, error) = await _inspectorFees.AccrueEngineeringSurveyFeeAsync(
                        taskId,
                        actorUserId,
                        ct,
                        proposesDiscount
                            ? new EngineeringSurveyDiscountProposalInput
                            {
                                ProposedDiscountSar = request!.ProposedDiscountSar,
                                DiscountReason = request.DiscountReason!.Trim(),
                                ProposedByName = actor.DisplayName,
                            }
                            : null);
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
            // Appraisal accept is only the specialist's acknowledgement stamp: the report is approved by
            // the appraiser (not a gate). Field inspection accept stamp is legacy/optional too.
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
            // One row per acceptance: the key carries the acceptance stamp (a repeated click on an accepted
            // package adds nothing, a re-acceptance after a return adds a new row).
            var acceptedStamp = (entity.AcceptedAtUtc ?? _time.UtcNow()).Ticks;
            if (!alreadyAccepted)
            {
                await _timeline.RecordAsync(
                    task.PoNumber,
                    propertyId,
                    $"party:{taskId}:accepted:{acceptedStamp}",
                    PartyTaskSubmissionRules.AcceptedTimelineTitle(task.Kind),
                    entity.AcceptedByName ?? task.AssigneeName,
                    "done",
                    entity.AcceptedAtUtc ?? _time.UtcNow(),
                    cancellationToken);
            }

            if (accruedFee is not null)
            {
                await _timeline.RecordAsync(
                    task.PoNumber,
                    propertyId,
                    $"party:{taskId}:fee-accrued:{acceptedStamp}",
                    "احتساب أتعاب الرفع المساحي",
                    // The timeline shows the full fee and the pending proposal until it is decided.
                    accruedFee.ProposedDiscountSar is > 0m
                        ? $"{accruedFee.AgreedFeeSar:N0} ر.س — حسم مقترح {accruedFee.ProposedDiscountSar:N0} ر.س بانتظار المشرف"
                        : $"{accruedFee.NetFeeSar:N0} ر.س",
                    "done",
                    entity.AcceptedAtUtc ?? _time.UtcNow(),
                    cancellationToken);
                await NotifyCdoFeeAccruedAsync(task, propertyId, accruedFee.NetFeeSar, cancellationToken);
            }
        }

        if (!alreadyAccepted)
        {
            await NotifyPartyAcceptedAsync(task, cancellationToken);
            if (task.Kind == WorkflowTaskKind.FieldInspection)
                await NotifySiblingsInspectionAcceptedAsync(task, cancellationToken);

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

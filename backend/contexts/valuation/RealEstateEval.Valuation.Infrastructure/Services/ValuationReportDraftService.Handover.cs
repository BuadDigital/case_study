using RealEstateEval.Application.Rules;
using RealEstateEval.Shared.Contracts;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Application.Rules;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Valuation.Infrastructure.Services;

/// <summary>
/// The handover between review and the appraiser (Omar 2026-11-08): review issues the draft once it
/// approved the study and accepted the value; the appraiser approves it or returns it to review with a
/// reason. The study's own send and review's return to the study are the study report's issue / reopen
/// in Case Study (the 2026-11-05 draft hand-over to review is retired).
/// </summary>
public sealed partial class ValuationReportDraftService
{
    /// <summary>The transaction review states Case Study understands (TransactionReviewStates there).</summary>
    public const string ReviewStateStudy = "study";

    /// <summary>The gates a handover (to review or to the appraiser) must pass, or null.</summary>
    /// <remarks>
    /// How it works: evaluates the issuance gates once and returns the first refusal — documents only the
    /// specialist uploads, the deed/nature match, then the issued study report (one batch).
    /// Edge cases: no gate service (tests) → null.
    /// </remarks>
    private async Task<Dictionary<string, string>?> HandoverGateErrorAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken,
        bool requireReview = false)
    {
        if (issuanceGates is null) return null;
        var gates = await issuanceGates.EvaluateAsync(valuationRequestId, cancellationToken);
        return ReportDraftSendRules.MissingSpecialistDocumentsError(gates)
            ?? ReportDraftSendRules.DeedNatureMatchError(gates)
            ?? ReportDraftSendRules.StudyReportNotIssuedError(gates)
            ?? (requireReview ? ReportDraftSendRules.ReviewNotDoneError(gates) : null);
    }

    /// <summary>
    /// The assigned appraiser returns the draft to review with a reason (Omar 2026-11-08) — his final
    /// approval stays a choice; he never edits the draft himself.
    /// </summary>
    /// <remarks>
    /// How it works: the assigned appraiser only; a sent draft goes back to preparing with the reason as the
    /// review note; notice to review, timeline. Edge cases: a draft not sent → «لم تُرسَل»; a blank reason is
    /// refused as the field error «reason».
    /// </remarks>
    public async Task<(ValuationReportDraftDto? Result, Dictionary<string, string>? Errors)> ReturnToReviewerAsync(
        Guid valuationRequestId,
        ReturnReportDraftToStudyRequest request,
        ReportDraftActor actor,
        CancellationToken cancellationToken = default)
    {
        var (vr, refused) = await FindForAssignedAppraiserAsync(valuationRequestId, actor, cancellationToken);
        if (vr is null) return (null, refused);
        var draft = await CurrentDraftAsync(valuationRequestId, tracked: true, cancellationToken);
        if (draft is null) return (null, Error(ValuationReportDraft.NotSentAr));

        var now = _time.GetUtcNow().UtcDateTime;
        var returnError = draft.ReturnToReviewer(request.Reason, now);
        if (returnError is not null)
        {
            return (null, returnError == ValuationReportDraft.ReturnToReviewReasonRequiredAr
                ? new Dictionary<string, string> { ["reason"] = returnError }
                : Error(returnError));
        }

        await StageNoticeAsync(
            vr,
            ValuationNoticeAudiences.CaseSpecialistReview,
            "أعاد المقيّم مسودة التقرير",
            $"أعاد المقيّم مسودة تقرير التقييم للعقار {vr.DisplayId}: {draft.ReviewNote}",
            NotificationContract.Tones.Warn,
            cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        await RecordTimelineAsync(
            vr.PropertyId,
            po => ValuationTimelineTexts.ReturnedToReviewer(po, vr.PropertyId, vr.Id, actor.DisplayName, draft.ReviewNote, now),
            cancellationToken);
        return (await GetAsync(vr.Id, cancellationToken), null);
    }

    /// <summary>Moves the transaction's review state in Case Study; returns its Arabic error, or null.</summary>
    /// <remarks>
    /// How it works: calls <c>ICaseStudyCommands.SetTransactionReviewStateAsync</c> before the draft is saved,
    /// so a failure leaves both sides as they were. Edge cases: no bridge (tests) → null.
    /// </remarks>
    private async Task<string?> MoveTransactionAsync(
        Guid propertyId,
        string state,
        ReportDraftActor actor,
        CancellationToken cancellationToken) =>
        caseStudyCommands is null
            ? null
            : await caseStudyCommands.SetTransactionReviewStateAsync(propertyId, state, actor.UserId, cancellationToken);
}

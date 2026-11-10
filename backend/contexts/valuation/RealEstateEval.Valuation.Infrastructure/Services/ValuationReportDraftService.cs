// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • Access  Constructor takes IAssignedAppraiserCheck (default: AssignedAppraiserCheck over the same db) and
//            IValuationReconciliationService (for the final-value check on approval).
// Round 2 (1b19bedc)
//  • Sending the draft to the appraiser is refused while a required document only the specialist uploads
//         is missing (ReportDraftSendRules.MissingSpecialistDocumentsError over the gates).
// ──────────────────────────────────────────────────────────────────────────────────────────────

using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Shared.Contracts;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Application.Rules;
using RealEstateEval.Valuation.Domain;
using RealEstateEval.Valuation.Infrastructure.Data.Contexts;

namespace RealEstateEval.Valuation.Infrastructure.Services;

/// <summary>
/// The valuation-report draft use case (see <see cref="IValuationReportDraftService"/>): the case
/// specialist prepares and sends, the assigned appraiser approves (the report freezes as the deposit
/// copy) or takes his approval back. The role rules live here, not only on the controller, so every
/// caller gets them. A refused role answers with <see cref="ReportDraftErrorKeys.Forbidden"/> (the controller maps it to 403).
/// </summary>
public sealed partial class ValuationReportDraftService(
    ValuationDbContext db,
    IValuationReportIssuanceService issuance,
    ICaseStudyLookup caseStudy,
    IValuationEventPublisher events,
    TimeProvider? time = null,
    IValuationFinalReportService? finalReports = null,
    ValuationTimelineWriter? timeline = null,
    // Confirms the transaction's PR reference in Case Study so the report number (PRV) can be fixed.
    ICaseStudyCommands? caseStudyCommands = null,
    IAssignedAppraiserCheck? assignedAppraisers = null,
    IValuationReconciliationService? reconciliation = null,
    IValuationIssuanceGateService? issuanceGates = null)
    : IValuationReportDraftService
{
    private IAssignedAppraiserCheck AssignedAppraisers { get; } =
        assignedAppraisers ?? new AssignedAppraiserCheck(db, caseStudy);

    public const string ReportNumberUnavailableAr = "تعذّر تثبيت رقم التقرير من خدمة دراسة الحالة — أعد المحاولة";

    public const string PrepareForbiddenAr = "إعداد مسودة تقرير التقييم للأخصائي فقط";
    public const string ReviewForbiddenAr = "اعتماد تقرير التقييم للمقيّم المُسنَد للعقار فقط";
    public const string PackageNotSubmittedAr = "سلّم المقيّم تقييمه للأخصائي أولاً";
    public const string AlreadyApprovedAr = "اعتمد المقيّم التقرير — اسحب الاعتماد أولاً";
    public const string RequestClosedAr = "صدر التقرير النهائي — يُعدَّل بنسخة جديدة ";
    public const string ReviewSendForbiddenAr = "إرسال المسودة للمقيّم وسحبها منه للمراجع (المراجعة والاعتماد والرفع)";
    public const string InReviewEditForbiddenAr = "المسودة عند المراجع — التعديل له وحده حتى يرسلها أو يُرجعها للدراسة";

    private readonly TimeProvider _time = time ?? TimeProvider.System;

    public async Task<ValuationReportDraftDto?> GetAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken = default)
    {
        var vr = await db.ValuationRequests.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == valuationRequestId, cancellationToken);
        if (vr is null) return null;

        var draft = await CurrentDraftAsync(valuationRequestId, tracked: false, cancellationToken);
        var packageStatus = await PackageStatusAsync(vr.PropertyId, cancellationToken);
        var issuance = await db.ValuationReportIssuances.AsNoTracking()
            .FirstOrDefaultAsync(x => x.ValuationRequestId == valuationRequestId && x.SupersededAtUtc == null, cancellationToken);
        var canPrepare = packageStatus == PartyTaskSubmissionStatus.Submitted
            && vr.Status != ValuationRequestStatus.Done
            && issuance is null
            && (draft is null || draft.IsPreparing);
        var version = draft?.Version ?? await NextVersionAsync(valuationRequestId, cancellationToken);
        return ToDto(valuationRequestId, draft, packageStatus, canPrepare, issuance, version, vr.ReportNumber);
    }

    public async Task<ValuationReportDraftDto?> GetByPropertyAsync(
        Guid propertyId,
        CancellationToken cancellationToken = default)
    {
        var requestId = await db.ValuationRequests.AsNoTracking()
            .Where(x => x.PropertyId == propertyId)
            .OrderByDescending(x => x.UpdatedAtUtc)
            .Select(x => (Guid?)x.Id)
            .FirstOrDefaultAsync(cancellationToken);
        return requestId is { } id ? await GetAsync(id, cancellationToken) : null;
    }

    public async Task<(ValuationReportDraftDto? Result, Dictionary<string, string>? Errors)> SaveChoicesAsync(
        Guid valuationRequestId,
        SaveReportDraftChoicesRequest request,
        ReportDraftActor actor,
        CancellationToken cancellationToken = default)
    {
        // Omar 2026-11-08: the three case-specialist sub-roles edit the report's data at the same level.
        var mayPrepare = PoRoleMatrixRules.CanPrepareReportDraft(actor.Staff) || actor.Staff.IsCaseSpecialist;
        var mayReview = PoRoleMatrixRules.CanReviewTransaction(actor.Staff);
        if (!mayPrepare && !mayReview)
            return (null, Forbidden(PrepareForbiddenAr));

        var (json, choiceErrors) = ReportDraftChoiceRules.Normalize(request.Choices);
        if (choiceErrors is not null) return (null, choiceErrors);

        var (vr, draft, error) = await PrepareForWriteAsync(valuationRequestId, cancellationToken);
        if (error is not null) return (null, error);

        // Review lock: in review only review edits; while preparing, the study does.
        if (draft!.IsInReview ? !mayReview : !mayPrepare)
            return (null, Forbidden(draft.IsInReview ? InReviewEditForbiddenAr : PrepareForbiddenAr));

        // 2026-11-10: a newer draft than the screen loaded is not overwritten (409, reload).
        var (expected, sawNoDraft) = ParseDraftToken(request.ExpectedUpdatedAtUtc);
        var isNewDraft = db.Entry(draft).State == EntityState.Added;
        if (draft.IsStaleFor(expected, sawNoDraft, isNewDraft))
            return (null, new Dictionary<string, string> { [ReportDraftErrorKeys.Conflict] = ValuationReportDraft.StaleChoicesAr });

        var saveError = draft.SaveChoices(json!, _time.GetUtcNow().UtcDateTime);
        if (saveError is not null) return (null, Error(saveError));

        await db.SaveChangesAsync(cancellationToken);
        return (await GetAsync(vr!.Id, cancellationToken), null);
    }

    public async Task<(ValuationReportDraftDto? Result, Dictionary<string, string>? Errors)> SendAsync(
        Guid valuationRequestId,
        SendReportDraftRequest request,
        ReportDraftActor actor,
        CancellationToken cancellationToken = default)
    {
        var existing = await CurrentDraftAsync(valuationRequestId, tracked: false, cancellationToken);
        if (existing is { IsSent: true } or { IsApproved: true })
            return (await GetAsync(valuationRequestId, cancellationToken), null);

        // Omar 2026-11-08: review issues the draft to the appraiser for his final approval — after it
        // approved the study and accepted the appraiser's value (the study no longer hands a draft over).
        if (!PoRoleMatrixRules.CanReviewTransaction(actor.Staff))
            return (null, Forbidden(ReviewSendForbiddenAr));

        var (vr, draft, error) = await PrepareForWriteAsync(valuationRequestId, cancellationToken);
        if (error is not null) return (null, error);

        if (await HandoverGateErrorAsync(valuationRequestId, cancellationToken, requireReview: true) is { } gateError)
            return (null, gateError);

        var sendError = draft!.Send(
            request.ConformityConfirmed, request.Note, actor.UserId, _time.GetUtcNow().UtcDateTime);
        if (sendError is not null) return (null, Error(sendError));

        await StageNoticeAsync(
            vr!,
            ValuationNoticeAudiences.Appraiser,
            "مسودة تقرير التقييم بانتظار اعتمادك",
            string.IsNullOrWhiteSpace(draft.SpecialistNote)
                ? $"أرسل الأخصائي مسودة تقرير التقييم للعقار {vr!.DisplayId} — راجعها واعتمدها."
                : $"أرسل الأخصائي مسودة تقرير التقييم للعقار {vr!.DisplayId}: {draft.SpecialistNote}",
            NotificationContract.Tones.Info,
            cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        await RecordTimelineAsync(
            vr!.PropertyId,
            po => ValuationTimelineTexts.DraftSent(
                po, vr.PropertyId, vr.Id, actor.DisplayName, draft.SpecialistNote, _time.GetUtcNow().UtcDateTime),
            cancellationToken);
        return (await GetAsync(vr!.Id, cancellationToken), null);
    }

    public async Task<(ValuationReportDraftDto? Result, Dictionary<string, string>? Errors)> WithdrawAsync(
        Guid valuationRequestId,
        WithdrawReportDraftRequest request,
        ReportDraftActor actor,
        CancellationToken cancellationToken = default)
    {
        var mayPrepare = PoRoleMatrixRules.CanPrepareReportDraft(actor.Staff);
        var mayReview = PoRoleMatrixRules.CanReviewTransaction(actor.Staff);
        if (!mayPrepare && !mayReview)
            return (null, Forbidden(PrepareForbiddenAr));

        var vr = await db.ValuationRequests.FirstOrDefaultAsync(x => x.Id == valuationRequestId, cancellationToken);
        if (vr is null) return (null, Error("طلب التقييم غير موجود"));

        var draft = await CurrentDraftAsync(valuationRequestId, tracked: true, cancellationToken);
        if (draft is null || draft.IsPreparing)
            return (await GetAsync(valuationRequestId, cancellationToken), null);

        // Omar 2026-11-08: review pulls a sent draft back from the appraiser to correct it (a legacy draft
        // still «in review» comes back the same way). The study's own state is Case Study's.
        if (!mayReview && !(draft.IsInReview && mayPrepare))
            return (null, Forbidden(ReviewSendForbiddenAr));
        var now = _time.GetUtcNow().UtcDateTime;
        var withdrawError = draft.Withdraw(request.Note, now);
        if (withdrawError is not null) return (null, Error(withdrawError));

        await StageNoticeAsync(
            vr,
            ValuationNoticeAudiences.Appraiser,
            "سُحبت مسودة تقرير التقييم",
            string.IsNullOrWhiteSpace(draft.SpecialistNote)
                ? $"سحب الأخصائي مسودة تقرير التقييم للعقار {vr.DisplayId} لتعديلها."
                : $"سحب الأخصائي مسودة تقرير التقييم للعقار {vr.DisplayId}: {draft.SpecialistNote}",
            NotificationContract.Tones.Warn,
            cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        await RecordTimelineAsync(
            vr.PropertyId,
            po => ValuationTimelineTexts.DraftWithdrawn(
                po, vr.PropertyId, vr.Id, actor.DisplayName, draft.SpecialistNote, _time.GetUtcNow().UtcDateTime),
            cancellationToken);
        return (await GetAsync(vr.Id, cancellationToken), null);
    }


    /// <summary>
    /// Everything a specialist write needs: the open request, the package handed over, nothing
    /// approved — and the tracked current draft (started when there is none).
    /// </summary>
    private async Task<(ValuationRequest? Request, ValuationReportDraft? Draft, Dictionary<string, string>? Error)>
        PrepareForWriteAsync(Guid valuationRequestId, CancellationToken cancellationToken)
    {
        var vr = await db.ValuationRequests.FirstOrDefaultAsync(x => x.Id == valuationRequestId, cancellationToken);
        if (vr is null) return (null, null, Error("طلب التقييم غير موجود"));
        if (vr.Status == ValuationRequestStatus.Done) return (null, null, Error(RequestClosedAr));

        var packageStatus = await PackageStatusAsync(vr.PropertyId, cancellationToken);
        if (packageStatus == PackageStatusUnknown)
            return (null, null, Error(ValuationReportFreezeRules.PackageStateUnavailableMessageAr));
        if (packageStatus != PartyTaskSubmissionStatus.Submitted)
            return (null, null, Error(PackageNotSubmittedAr));

        var draft = await CurrentDraftAsync(valuationRequestId, tracked: true, cancellationToken);
        if (draft is { IsApproved: true }) return (null, null, Error(AlreadyApprovedAr));
        if (draft is null)
        {
            var version = await NextVersionAsync(valuationRequestId, cancellationToken);
            draft = ValuationReportDraft.Start(valuationRequestId, version, _time.GetUtcNow().UtcDateTime);
            db.ValuationReportDrafts.Add(draft);
        }

        return (vr, draft, null);
    }

    private async Task<ValuationReportDraft?> CurrentDraftAsync(
        Guid valuationRequestId,
        bool tracked,
        CancellationToken cancellationToken)
    {
        var query = tracked ? db.ValuationReportDrafts.AsQueryable() : db.ValuationReportDrafts.AsNoTracking();
        // A draft whose deposit copy was superseded (a new version was opened) belongs to a finished cycle.
        return await query
            .Where(x => x.ValuationRequestId == valuationRequestId)
            .Where(x => !db.ValuationReportIssuances.Any(i =>
                i.ValuationRequestId == valuationRequestId
                && i.Version == x.Version
                && i.SupersededAtUtc != null))
            .OrderByDescending(x => x.Version)
            .FirstOrDefaultAsync(cancellationToken);
    }

    /// <summary>The next cycle number: after the highest deposit copy ever issued (superseded ones count).</summary>
    private async Task<int> NextVersionAsync(Guid valuationRequestId, CancellationToken cancellationToken)
    {
        var issued = await db.ValuationReportIssuances.AsNoTracking()
            .Where(x => x.ValuationRequestId == valuationRequestId)
            .Select(x => (int?)x.Version)
            .MaxAsync(cancellationToken) ?? 0;
        var drafted = await db.ValuationReportDrafts.AsNoTracking()
            .Where(x => x.ValuationRequestId == valuationRequestId)
            .Select(x => (int?)x.Version)
            .MaxAsync(cancellationToken) ?? 0;
        return Math.Max(issued, drafted) + 1;
    }

    /// <summary>The screen's concurrency token: (stamp, caller saw no draft).</summary>
    /// <remarks>
    /// How it works: null → (null, false) = no check; blank → (null, true) = the screen loaded no draft;
    /// an ISO-8601 stamp (round-trip «o», as <see cref="ToDto"/> writes it) → (stamp, false).
    /// Edge cases: an unreadable value counts as absent (no check) rather than refusing every save.
    /// </remarks>
    private static (DateTime? Expected, bool SawNoDraft) ParseDraftToken(string? token)
    {
        if (token is null) return (null, false);
        if (string.IsNullOrWhiteSpace(token)) return (null, true);
        return DateTime.TryParse(
            token.Trim(),
            System.Globalization.CultureInfo.InvariantCulture,
            System.Globalization.DateTimeStyles.RoundtripKind,
            out var stamp)
            ? (stamp, false)
            : (null, false);
    }

    private static Dictionary<string, string> Error(string message) => new() { ["_"] = message };

    private static Dictionary<string, string> Forbidden(string message) =>
        new() { [ReportDraftErrorKeys.Forbidden] = message };
}

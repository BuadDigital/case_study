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
    IValuationFinalReportService? finalReports = null)
    : IValuationReportDraftService
{
    public const string PrepareForbiddenAr = "إعداد مسودة تقرير التقييم للأخصائي فقط";
    public const string ReviewForbiddenAr = "اعتماد تقرير التقييم للمقيّم المُسنَد للعقار فقط";
    public const string PackageNotSubmittedAr = "سلّم المقيّم تقييمه للأخصائي أولاً";
    public const string AlreadyApprovedAr = "اعتمد المقيّم التقرير — اسحب الاعتماد أولاً";
    public const string RequestClosedAr = "صدر التقرير النهائي — يُعدَّل بنسخة جديدة ";

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
        return ToDto(valuationRequestId, draft, packageStatus, canPrepare, issuance, version);
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
        if (!PoRoleMatrixRules.CanPrepareReportDraft(actor.PrototypeRole))
            return (null, Forbidden(PrepareForbiddenAr));

        var (json, choiceErrors) = ReportDraftChoiceRules.Normalize(request.Choices);
        if (choiceErrors is not null) return (null, choiceErrors);

        var (vr, draft, error) = await PrepareForWriteAsync(valuationRequestId, cancellationToken);
        if (error is not null) return (null, error);

        var saveError = draft!.SaveChoices(json!, _time.GetUtcNow().UtcDateTime);
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
        if (!PoRoleMatrixRules.CanPrepareReportDraft(actor.PrototypeRole))
            return (null, Forbidden(PrepareForbiddenAr));

        var existing = await CurrentDraftAsync(valuationRequestId, tracked: false, cancellationToken);
        if (existing is { IsSent: true } or { IsApproved: true })
            return (await GetAsync(valuationRequestId, cancellationToken), null);

        var (vr, draft, error) = await PrepareForWriteAsync(valuationRequestId, cancellationToken);
        if (error is not null) return (null, error);

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
        return (await GetAsync(vr!.Id, cancellationToken), null);
    }

    public async Task<(ValuationReportDraftDto? Result, Dictionary<string, string>? Errors)> WithdrawAsync(
        Guid valuationRequestId,
        WithdrawReportDraftRequest request,
        ReportDraftActor actor,
        CancellationToken cancellationToken = default)
    {
        if (!PoRoleMatrixRules.CanPrepareReportDraft(actor.PrototypeRole))
            return (null, Forbidden(PrepareForbiddenAr));

        var vr = await db.ValuationRequests.FirstOrDefaultAsync(x => x.Id == valuationRequestId, cancellationToken);
        if (vr is null) return (null, Error("طلب التقييم غير موجود"));

        var draft = await CurrentDraftAsync(valuationRequestId, tracked: true, cancellationToken);
        if (draft is null || draft.IsPreparing)
            return (await GetAsync(valuationRequestId, cancellationToken), null);

        var withdrawError = draft.Withdraw(request.Note, _time.GetUtcNow().UtcDateTime);
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
        return (await GetAsync(vr.Id, cancellationToken), null);
    }

    public async Task<string?> GetApprovedSnapshotHtmlAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken = default)
    {
        var draft = await CurrentDraftAsync(valuationRequestId, tracked: false, cancellationToken);
        return draft is { IsApproved: true, SnapshotHtmlGz: { Length: > 0 } gz }
            ? ReportDraftSnapshot.Decompress(gz)
            : null;
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

    private static Dictionary<string, string> Error(string message) => new() { ["_"] = message };

    private static Dictionary<string, string> Forbidden(string message) =>
        new() { [ReportDraftErrorKeys.Forbidden] = message };
}

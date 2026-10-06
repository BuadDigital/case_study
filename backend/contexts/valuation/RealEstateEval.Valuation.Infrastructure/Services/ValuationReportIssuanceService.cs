using RealEstateEval.Domain;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Application.Rules;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Domain;
using RealEstateEval.Valuation.Infrastructure.Data.Contexts;
using RealEstateEval.Shared.Contracts;
using Microsoft.Extensions.Logging;
using RealEstateEval.Attachments.Application.Abstractions;

namespace RealEstateEval.Valuation.Infrastructure.Services;

/// <summary>
/// Q-6: two-phase issuance + deposit certificate. The frozen snapshot (DocumentJson) is the source
/// for both copies: deposit copy is generated at freeze with empty code field; final copy is the same
/// snapshot literally + code in the field and metadata + attached certificate page.
/// </summary>
public sealed partial class ValuationReportIssuanceService(
    ValuationDbContext db,
    IValuationIssuanceGateService gates,
    IValuationReportDocumentService documents,
    TimeProvider? time = null,
    ILogger<ValuationReportIssuanceService>? logger = null,
    IAuditLogWriter? audit = null,
    IAuditLogAppend? auditLog = null,
    IValuationEventPublisher? events = null,
    IPriorValuationBankFeeder? bankFeeder = null,
    ICaseStudyLookup? caseStudy = null,
    ICaseStudyRecallCommands? caseStudyCommands = null,
    IAttachmentFileStore? files = null)
    : IValuationReportIssuanceService
{
    private readonly TimeProvider _time = time ?? TimeProvider.System;

    private static readonly JsonSerializerOptions SnapshotJson = JsonDefaults.CamelCase;

    public async Task<ValuationReportIssuanceStateDto?> GetStateAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken = default)
    {
        var vr = await db.ValuationRequests.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == valuationRequestId, cancellationToken);
        if (vr is null) return null;

        // R2: only the current copy drives the phase — superseded copies stay on file and count only.
        var row = await db.ValuationReportIssuances.AsNoTracking()
            .FirstOrDefaultAsync(
                x => x.ValuationRequestId == valuationRequestId && x.SupersededAtUtc == null,
                cancellationToken);
        var supersededCount = await db.ValuationReportIssuances.AsNoTracking()
            .CountAsync(
                x => x.ValuationRequestId == valuationRequestId && x.SupersededAtUtc != null,
                cancellationToken);

        if (row is not null)
            return ToState(row, allowsDepositIssue: false, blockingReasons: [], supersededCount);

        // Status display degrades safely when gate evaluation fails (upstream unavailable) —
        // actual issuance still requires a successful evaluation in IssueDepositAsync.
        ValuationIssuanceGatesDto? gateState = null;
        try
        {
            gateState = await gates.EvaluateAsync(valuationRequestId, cancellationToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // Safe degradation is intentional — but the failure must appear in logs.
            logger?.LogWarning(ex, "تعذّر تقييم بوابات إصدار تقرير التقييم للطلب {ValuationRequestId}", valuationRequestId);
        }

        return new ValuationReportIssuanceStateDto
        {
            ValuationRequestId = valuationRequestId,
            Stage = ReportIssuanceStages.Draft,
            AllowsDepositIssue = gateState?.AllowsIssuance == true,
            BlockingReasonsAr = gateState?.BlockingReasonsAr
                ?? ["تعذّر تقييم بوابات الإصدار — تحقق من توافر الخدمات"],
            Version = supersededCount + 1,
            SupersededCount = supersededCount,
        };
    }

    public async Task<(ValuationReportIssuanceStateDto? Result, Dictionary<string, string>? Errors)>
        IssueDepositAsync(
            Guid valuationRequestId,
            string? issuedByUserId,
            CancellationToken cancellationToken = default)
    {
        var vr = await db.ValuationRequests
            .FirstOrDefaultAsync(x => x.Id == valuationRequestId, cancellationToken);
        if (vr is null)
            return (null, new Dictionary<string, string> { ["_"] = "طلب التقييم غير موجود" });

        // R2: only the current copy blocks issuance — after reopen, cycle N+1 is issued.
        var hasActive = await db.ValuationReportIssuances.AsNoTracking()
            .AnyAsync(
                x => x.ValuationRequestId == valuationRequestId && x.SupersededAtUtc == null,
                cancellationToken);
        if (hasActive)
            return (null, new Dictionary<string, string> { ["_"] = "نسخة الإيداع صادرة سلفاً — التقرير مجمّد" });

        var handOverError = await HandOverRequiredErrorAsync(vr.PropertyId, cancellationToken);
        if (handOverError is not null)
            return (null, new Dictionary<string, string> { ["_"] = handOverError });

        // Q-6-1: no issuance until gates pass — evaluation failure itself blocks with a clear
        // message instead of crashing the request.
        ValuationIssuanceGatesDto? gateState;
        try
        {
            gateState = await gates.EvaluateAsync(valuationRequestId, cancellationToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            gateState = null;
        }

        if (gateState is null)
            return (null, new Dictionary<string, string> { ["_"] = "تعذّر تقييم بوابات الإصدار — تحقق من توافر الخدمات ثم أعد المحاولة" });
        if (!gateState.AllowsIssuance)
        {
            return (null, new Dictionary<string, string>
            {
                ["_"] = "بوابات الإصدار غير مكتملة: "
                        + string.Join(" · ", gateState.BlockingReasonsAr.Take(4)),
            });
        }

        var document = await documents.GetPreviewAsync(valuationRequestId, cancellationToken);
        if (document is null)
            return (null, new Dictionary<string, string> { ["_"] = "تعذّر بناء لقطة التقرير" });

        // R2: cycle number = max prior cycle + 1 (superseded count — numbers are not reused).
        var priorVersion = await db.ValuationReportIssuances.AsNoTracking()
            .Where(x => x.ValuationRequestId == valuationRequestId)
            .Select(x => (int?)x.Version)
            .MaxAsync(cancellationToken) ?? 0;

        // B2: freeze transition on the aggregate — service prepares snapshot and generator only.
        var row = ValuationReportIssuance.IssueDeposit(
            valuationRequestId,
            JsonSerializer.Serialize(document, SnapshotJson),
            issuedByUserId,
            _time.UtcNow(),
            priorVersion + 1);
        db.ValuationReportIssuances.Add(row);
        await db.SaveChangesAsync(cancellationToken);

        // All prior cycles are necessarily superseded (else issuance would have been blocked above).
        return (ToState(row, allowsDepositIssue: false, blockingReasons: [], supersededCount: priorVersion), null);
    }

    public async Task<(ValuationReportIssuanceStateDto? Result, Dictionary<string, string>? Errors)>
        RegisterCertificateAsync(
            Guid valuationRequestId,
            RegisterDepositCertificateRequest request,
            string? uploadedByUserId,
            CancellationToken cancellationToken = default)
    {
        var row = await db.ValuationReportIssuances
            .FirstOrDefaultAsync(
                x => x.ValuationRequestId == valuationRequestId && x.SupersededAtUtc == null,
                cancellationToken);
        if (row is null)
            return (null, new Dictionary<string, string> { ["_"] = "أصدر نسخة الإيداع أولاً (ق-6-1)" });

        var requestPropertyId = await db.ValuationRequests.AsNoTracking()
            .Where(x => x.Id == valuationRequestId)
            .Select(x => x.PropertyId)
            .FirstOrDefaultAsync(cancellationToken);
        var handOverError = await HandOverRequiredErrorAsync(requestPropertyId, cancellationToken);
        if (handOverError is not null)
            return (null, new Dictionary<string, string> { ["_"] = handOverError });

        if (string.IsNullOrWhiteSpace(request.DepositCode))
            return (null, new Dictionary<string, string> { ["depositCode"] = "رمز الإيداع مطلوب" });

        // The deposit certificate (a one-page PDF) and its code are both required; a corrective
        // re-registration may re-send the code alone while the certificate already on the copy stays.
        var (certificate, certificateErrors) = DepositCertificateRules.Read(
            request.CertificateContentBase64,
            request.CertificateContentType,
            request.CertificateFileName,
            alreadyHasCertificate: row.HasCertificate);
        if (certificateErrors is not null) return (null, certificateErrors);

        var correctedCode = row.FinalIssuedAtUtc is not null ? row.DepositCode : null;

        // The certificate goes to the attachments service; the copy keeps only its reference.
        var replacedCertificate = row.CertificateAttachmentId;
        Guid? certificateId = null;
        byte[]? inlineCertificate = null;
        if (certificate is not null)
        {
            if (files is null)
            {
                inlineCertificate = certificate;
            }
            else
            {
                var (id, storeError) = await files.StoreAsync(
                    ReportFileScopes.DepositCertificate,
                    ReportFileScopes.Key(requestPropertyId, "deposit", row.Version),
                    ReportFileScopes.PdfFileName(request.CertificateFileName, "deposit-certificate"),
                    "application/pdf",
                    certificate,
                    cancellationToken);
                if (id is null)
                    return (null, new Dictionary<string, string>
                    {
                        ["certificateContentBase64"] = storeError ?? "تعذّر حفظ شهادة الإيداع — حاول مرة أخرى",
                    });
                certificateId = id;
            }
        }

        // B2: certificate/code transitions on the aggregate — corrective re-registration is allowed.
        var certError = row.RegisterCertificate(
            request.DepositCode,
            request.CertificateFileName,
            request.CertificateContentType,
            certificateId,
            inlineCertificate,
            uploadedByUserId,
            _time.UtcNow());
        if (certError is not null)
            return (null, new Dictionary<string, string> { ["depositCode"] = certError });

        var finalError = row.IssueFinal(_time.UtcNow());
        if (finalError is not null)
            return (null, new Dictionary<string, string> { ["_"] = finalError });

        if (correctedCode is not null && !string.Equals(correctedCode, row.DepositCode, StringComparison.Ordinal)
            && audit is not null && auditLog is not null)
        {
            // The code is corrected after the final issuance (it comes from the authority, not from this system):
            // no new version, but the change is on record.
            await auditLog.AppendAsync(audit.Create(
                actorId: string.IsNullOrWhiteSpace(uploadedByUserId) ? "unknown" : uploadedByUserId,
                action: "valuation.report-issuance.code-corrected",
                entityType: "ValuationReportIssuance",
                entityId: valuationRequestId.ToString("D"),
                before: new { depositCode = correctedCode },
                after: new { depositCode = row.DepositCode }),
                cancellationToken);
        }

        // Completes the professional valuation-report step (Q-9 separates it from Infath bulk upload).
        // The final issuance is the one place the request closes: it publishes the single
        // "report delivered" event (completes the appraiser's task in Case Study) and feeds
        // the comparables bank. A corrective re-registration finds the request already closed
        // and publishes nothing.
        var vr = await db.ValuationRequests
            .FirstOrDefaultAsync(x => x.Id == valuationRequestId, cancellationToken);
        var closedNow = vr?.SubmitReport(_time.UtcNow()) == ValuationRequestTransition.Applied;
        if (closedNow && vr is not null && events is not null)
        {
            await events.PublishAsync(
                IntegrationEventTypes.ValuationReportSubmitted,
                new ValuationReportSubmittedPayload(
                    vr.Id,
                    vr.PropertyId.ToString("D"),
                    vr.DisplayId,
                    vr.Appraiser),
                cancellationToken);
        }

        await db.SaveChangesAsync(cancellationToken);

        // The certificate this one replaced is no longer referenced.
        if (files is not null && replacedCertificate is { } oldId && oldId != certificateId && certificateId is not null)
            await files.DeleteAsync(oldId, cancellationToken);

        if (closedNow && bankFeeder is not null)
        {
            try
            {
                await bankFeeder.FeedAsync(valuationRequestId, cancellationToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                // Missing bank inputs skip inside the feeder; a harvest failure must never fail the issuance.
                logger?.LogWarning(
                    ex,
                    "Prior-valuation bank feed failed after final issuance for {ValuationRequestId}",
                    valuationRequestId);
            }
        }

        var supersededCount = await db.ValuationReportIssuances.AsNoTracking()
            .CountAsync(
                x => x.ValuationRequestId == valuationRequestId && x.SupersededAtUtc != null,
                cancellationToken);
        return (ToState(row, allowsDepositIssue: false, blockingReasons: [], supersededCount), null);
    }

    /// <summary>
    /// The deposit steps belong to a package the appraiser has handed over: the appraiser submits
    /// to the case specialist first. No appraisal package at all (legacy) or an older Case Study
    /// host does not block; a failed read fails closed.
    /// </summary>
    private async Task<string?> HandOverRequiredErrorAsync(
        Guid propertyId,
        CancellationToken cancellationToken)
    {
        if (caseStudy is null || propertyId == Guid.Empty)
            return null;

        RealEstateEval.Application.Contracts.CaseStudyAppraisalPackageStateDto? state;
        try
        {
            state = await caseStudy.GetAppraisalPackageStateAsync(propertyId, cancellationToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            return ValuationReportFreezeRules.PackageStateUnavailableMessageAr;
        }

        if (state is null || state.PackageStatus == RealEstateEval.Application.Contracts.AppraisalPackageStates.None)
            return null;
        return state.PackageStatus == PartyTaskSubmissionStatus.Submitted
            ? null
            : "سلّم التقييم للأخصائي أولاً";
    }

    private static ValuationReportIssuanceStateDto ToState(
        ValuationReportIssuance row,
        bool allowsDepositIssue,
        IReadOnlyList<string> blockingReasons,
        int supersededCount = 0) =>
        new()
        {
            ValuationRequestId = row.ValuationRequestId,
            Stage = row.FinalIssuedAtUtc is not null
                ? ReportIssuanceStages.FinalIssued
                : ReportIssuanceStages.DepositIssued,
            AllowsDepositIssue = allowsDepositIssue,
            BlockingReasonsAr = blockingReasons,
            DepositIssuedAtUtc = row.DepositIssuedAtUtc.ToString("o"),
            DepositCode = row.DepositCode,
            CertificateFileName = row.CertificateFileName,
            CertificateUploadedAtUtc = row.CertificateUploadedAtUtc?.ToString("o"),
            FinalIssuedAtUtc = row.FinalIssuedAtUtc?.ToString("o"),
            FinalReportStatus = row.FinalReportStatus,
            Version = row.Version,
            SupersededCount = supersededCount,
        };
}

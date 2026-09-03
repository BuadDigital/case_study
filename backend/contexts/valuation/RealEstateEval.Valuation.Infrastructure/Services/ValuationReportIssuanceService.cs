using RealEstateEval.Domain;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Domain;
using RealEstateEval.Valuation.Infrastructure.Data.Contexts;
using Microsoft.Extensions.Logging;

namespace RealEstateEval.Valuation.Infrastructure.Services;

/// <summary>
/// Q-6: two-phase issuance + deposit certificate. The frozen snapshot (DocumentJson) is the source
/// for both copies: deposit copy is generated at freeze with empty code field; final copy is the same
/// snapshot literally + code in the field and metadata + attached certificate page.
/// </summary>
public sealed class ValuationReportIssuanceService(
    ValuationDbContext db,
    IValuationIssuanceGateService gates,
    IValuationReportDocumentService documents,
    TimeProvider? time = null,
    ILogger<ValuationReportIssuanceService>? logger = null,
    IAuditLogWriter? audit = null,
    IAuditLogAppend? auditLog = null)
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
            return (null, new Dictionary<string, string> { ["_"] = "نسخة الإيداع صادرة سلفاً — التقرير مجمّد (ق-6)" });

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
            ValuationReportPdfGenerator.Generate(document),
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

        byte[]? certificate = null;
        if (!string.IsNullOrWhiteSpace(request.CertificateContentBase64))
        {
            try
            {
                certificate = Convert.FromBase64String(request.CertificateContentBase64);
            }
            catch (FormatException)
            {
                return (null, new Dictionary<string, string>
                {
                    ["certificateContentBase64"] = "محتوى الشهادة غير صالح (Base64)",
                });
            }
        }

        // B2: certificate/code transitions on the aggregate — corrective re-registration is allowed
        // and regenerates the final copy from the same frozen snapshot.
        var certError = row.RegisterCertificate(
            request.DepositCode,
            request.CertificateFileName,
            request.CertificateContentType,
            certificate,
            uploadedByUserId,
            _time.UtcNow());
        if (certError is not null)
            return (null, new Dictionary<string, string> { ["depositCode"] = certError });

        var code = row.DepositCode!;
        var frozen = WithDepositCode(row.DocumentJson, code);
        var document = frozen.Deserialize<ValuationReportDocumentDto>(SnapshotJson);
        if (document is null)
            return (null, new Dictionary<string, string> { ["_"] = "لقطة التقرير المجمّدة تالفة" });

        var finalError = row.IssueFinal(
            ValuationReportPdfGenerator.Generate(
                document,
                new ValuationReportPdfGenerator.IssuanceCertificateStamp(
                    code,
                    row.CertificateFileName,
                    row.CertificateContentType,
                    row.CertificateContent)),
            _time.UtcNow());
        if (finalError is not null)
            return (null, new Dictionary<string, string> { ["_"] = finalError });

        // Completes the professional valuation-report step (Q-9 separates it from Infath bulk upload).
        var vr = await db.ValuationRequests
            .FirstOrDefaultAsync(x => x.Id == valuationRequestId, cancellationToken);
        vr?.SubmitReport(_time.UtcNow());

        await db.SaveChangesAsync(cancellationToken);

        var supersededCount = await db.ValuationReportIssuances.AsNoTracking()
            .CountAsync(
                x => x.ValuationRequestId == valuationRequestId && x.SupersededAtUtc != null,
                cancellationToken);
        return (ToState(row, allowsDepositIssue: false, blockingReasons: [], supersededCount), null);
    }

    public async Task<(ValuationReportIssuanceStateDto? Result, Dictionary<string, string>? Errors)>
        ReopenAfterDepositAsync(
            Guid valuationRequestId,
            ReopenReportIssuanceRequest request,
            string? requestedByUserId,
            CancellationToken cancellationToken = default)
    {
        var vr = await db.ValuationRequests
            .FirstOrDefaultAsync(x => x.Id == valuationRequestId, cancellationToken);
        if (vr is null)
            return (null, new Dictionary<string, string> { ["_"] = "طلب التقييم غير موجود" });

        var row = await db.ValuationReportIssuances
            .FirstOrDefaultAsync(
                x => x.ValuationRequestId == valuationRequestId && x.SupersededAtUtc == null,
                cancellationToken);
        if (row is null)
        {
            return (null, new Dictionary<string, string>
            {
                ["_"] = "لا نسخة إيداع سارية — الرجوع قبل الإيداع يمر عبر استدعاء المهمة (ر1)",
            });
        }

        // R2: deposited copy is not edited — marked superseded and kept on file; the new cycle ends
        // with deposit copy N+1 and a new Qiama deposit.
        var error = row.Supersede(requestedByUserId, request.Reason, _time.UtcNow());
        if (error is not null)
            return (null, new Dictionary<string, string> { ["reason"] = error });

        // Reverses professional-step completion — request reopens and holds the property until the new cycle.
        vr.ReopenReport(_time.UtcNow());
        await db.SaveChangesAsync(cancellationToken);

        // 2-B: every reopen leaves an audit entry with actor and reason — best-effort after the main save.
        if (audit is not null && auditLog is not null)
        {
            await auditLog.AppendAsync(audit.Create(
                actorId: string.IsNullOrWhiteSpace(requestedByUserId) ? "unknown" : requestedByUserId,
                action: "valuation.report-issuance.reopened",
                entityType: "ValuationReportIssuance",
                entityId: valuationRequestId.ToString("D"),
                before: new { row.Version, stage = ReportIssuanceStages.DepositIssued },
                after: new { reason = row.SupersededReason, nextVersion = row.Version + 1 }),
                cancellationToken);
        }

        return (await GetStateAsync(valuationRequestId, cancellationToken), null);
    }

    public async Task<byte[]?> GetDepositPdfAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken = default) =>
        (await db.ValuationReportIssuances.AsNoTracking()
            .FirstOrDefaultAsync(
                x => x.ValuationRequestId == valuationRequestId && x.SupersededAtUtc == null,
                cancellationToken))
        ?.DepositPdf;

    public async Task<byte[]?> GetFinalPdfAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken = default) =>
        (await db.ValuationReportIssuances.AsNoTracking()
            .FirstOrDefaultAsync(
                x => x.ValuationRequestId == valuationRequestId && x.SupersededAtUtc == null,
                cancellationToken))
        ?.FinalPdf;

 /// <summary>
 /// Q-6-4: the code is filled into its existing field in the snapshot (report.deposit_code) without touching others —
 /// edit via JsonNode to preserve "the same frozen report literally".
 /// </summary>
    private static JsonNode WithDepositCode(string documentJson, string depositCode)
    {
        var root = JsonNode.Parse(documentJson) ?? new JsonObject();
        if (root["sections"] is JsonArray sections)
        {
            foreach (var section in sections)
            {
                if (section?["fields"] is JsonObject fields
                    && fields.ContainsKey("report.deposit_code"))
                {
                    fields["report.deposit_code"] = depositCode;
                }
            }
        }

        return root;
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
            HasDepositPdf = row.DepositPdf.Length > 0,
            HasFinalPdf = row.FinalPdf is { Length: > 0 },
            Version = row.Version,
            SupersededCount = supersededCount,
        };
}

/// <summary>Q-6: freeze guard — after deposit copy, nothing is editable except code and certificate.</summary>
public static class ValuationReportFreeze
{
    public const string FrozenMessageAr =
        "التقرير مجمّد — صدرت نسخة الإيداع (ق-6)؛ الرمز والشهادة وحدهما قابلان للتسجيل";

    // R2: freeze follows the current copy only — reopen (superseding) lifts the
    // Q-6 layer only; freeze of adopted party outputs is a lower layer untouched (2-C).
    public static Task<bool> IsFrozenAsync(
        ValuationDbContext db,
        Guid valuationRequestId,
        CancellationToken cancellationToken = default) =>
        db.ValuationReportIssuances.AsNoTracking()
            .AnyAsync(
                x => x.ValuationRequestId == valuationRequestId && x.SupersededAtUtc == null,
                cancellationToken);
}
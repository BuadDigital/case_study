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
/// ق-6: الإصدار ثنائي المرحلة + شهادة الإيداع. اللقطة المجمّدة (DocumentJson) مصدر
/// النسختين: نسخة الإيداع تُولَّد عند التجميد وخانة الرمز فارغة؛ النسخة النهائية نفس
/// اللقطة حرفياً + الرمز في الحقل والميتا + صفحة الشهادة المرفقة.
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

        // ر2: النسخة السارية وحدها تحكم المرحلة — الملغاة تبقى بالملف وتظهر عدّاً فقط.
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

        // عرض الحالة يتدهور بأمان عند تعذّر تقييم الحواجب (خدمة upstream غير متاحة) —
        // الإصدار الفعلي يبقى مشروطاً بتقييم ناجح في IssueDepositAsync.
        ValuationIssuanceGatesDto? gateState = null;
        try
        {
            gateState = await gates.EvaluateAsync(valuationRequestId, cancellationToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // التدهور الآمن مقصود — لكن العطل يجب أن يظهر في السجلات.
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

        // ر2: النسخة السارية وحدها تمنع الإصدار — بعد إعادة الفتح يصدر الدور N+1.
        var hasActive = await db.ValuationReportIssuances.AsNoTracking()
            .AnyAsync(
                x => x.ValuationRequestId == valuationRequestId && x.SupersededAtUtc == null,
                cancellationToken);
        if (hasActive)
            return (null, new Dictionary<string, string> { ["_"] = "نسخة الإيداع صادرة سلفاً — التقرير مجمّد (ق-6)" });

        // ق-6-1: لا إصدار إلا باكتمال الحواجب — تعذّر التقييم نفسه يمنع الإصدار برسالة
        // واضحة بدل انهيار الطلب.
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

        // ر2: رقم الدور = أعلى دور سابق + 1 (الملغاة تُحتسب — لا إعادة استخدام لرقم).
        var priorVersion = await db.ValuationReportIssuances.AsNoTracking()
            .Where(x => x.ValuationRequestId == valuationRequestId)
            .Select(x => (int?)x.Version)
            .MaxAsync(cancellationToken) ?? 0;

        // B2: انتقال التجميد داخل الجذر — الخدمة تجهّز اللقطة والمولّد فقط.
        var row = ValuationReportIssuance.IssueDeposit(
            valuationRequestId,
            JsonSerializer.Serialize(document, SnapshotJson),
            ValuationReportPdfGenerator.Generate(document),
            issuedByUserId,
            _time.UtcNow(),
            priorVersion + 1);
        db.ValuationReportIssuances.Add(row);
        await db.SaveChangesAsync(cancellationToken);

        // كل الأدوار السابقة ملغاة بالضرورة (وإلا لَمنعت الإصدار أعلاه).
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

        // B2: انتقالات الشهادة/الرمز داخل الجذر — إعادة التسجيل تصحيحاً مسموحة
        // وتعيد توليد النسخة النهائية من اللقطة المجمّدة نفسها.
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

        // اكتمال الخطوة المهنية لتقرير التقييم (ق-9 يفصلها عن رفع إنفاذ الشامل).
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

        // ر2: النسخة المودعة لا تُعدَّل — تُعلَّم ملغاة وتبقى بالملف، والدور الجديد ينتهي
        // بنسخة إيداع N+1 وإيداع جديد في قيمة.
        var error = row.Supersede(requestedByUserId, request.Reason, _time.UtcNow());
        if (error is not null)
            return (null, new Dictionary<string, string> { ["reason"] = error });

        // عكس اكتمال الخطوة المهنية — الطلب يعود مفتوحاً ويحجز العقار حتى الدور الجديد.
        vr.ReopenReport(_time.UtcNow());
        await db.SaveChangesAsync(cancellationToken);

        // ٢-ب: كل رجوع يترك قيد تدقيق بالمُجري والسبب — best-effort بعد الحفظ الرئيس.
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
 /// ق-6-4: الرمز يتعبأ في حقله القائم داخل اللقطة (report.deposit_code) دون مساس بغيره —
 /// التعديل عبر JsonNode حفاظاً على «نفس التقرير المجمّد حرفياً».
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

/// <summary>ق-6: حارس التجميد — بعد صدور نسخة الإيداع لا يُحرَّر شيء سوى الرمز والشهادة.</summary>
public static class ValuationReportFreeze
{
    public const string FrozenMessageAr =
        "التقرير مجمّد — صدرت نسخة الإيداع (ق-6)؛ الرمز والشهادة وحدهما قابلان للتسجيل";

    // ر2: التجميد يتبع النسخة السارية وحدها — إعادة الفتح (إلغاء النسخة) تفكّ طبقة
    // ق-6 فقط؛ تجميد مخرجات الأطراف المعتمدة طبقة أدنى لا تمسّها (٢-ج).
    public static Task<bool> IsFrozenAsync(
        ValuationDbContext db,
        Guid valuationRequestId,
        CancellationToken cancellationToken = default) =>
        db.ValuationReportIssuances.AsNoTracking()
            .AnyAsync(
                x => x.ValuationRequestId == valuationRequestId && x.SupersededAtUtc == null,
                cancellationToken);
}
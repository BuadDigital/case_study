using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Domain;
using RealEstateEval.Valuation.Infrastructure.Data.Contexts;

namespace RealEstateEval.Valuation.Infrastructure.Services;

/// <summary>
/// Renders the report HTML the browser built (same bytes as the print tab, self-contained)
/// into a PDF, keeps the newest few per request, and issues signed <c>.pdf?k=…</c> links.
/// </summary>
public sealed class ValuationReportPdfService(
    ValuationDbContext db,
    IHtmlPdfRenderer renderer,
    IReportLinkSigner signer,
    TimeProvider? time = null,
    ILogger<ValuationReportPdfService>? logger = null) : IValuationReportPdfService
{
    private readonly TimeProvider _time = time ?? TimeProvider.System;

    public async Task<ValuationReportPdfCreateResult> CreateFromHtmlAsync(
        Guid valuationRequestId,
        CreateValuationReportPdfRequest request,
        string? actorId,
        CancellationToken cancellationToken = default)
    {
        var html = request.Html ?? "";
        if (html.Trim().Length < 64 || !html.Contains('<'))
        {
            return ValuationReportPdfCreateResult.Fail(
                ValuationReportPdfFailure.InvalidHtml,
                "محتوى التقرير فارغ أو غير صالح.");
        }
        if (Encoding.UTF8.GetByteCount(html) > ValuationReportPdfRules.MaxHtmlBytes)
        {
            return ValuationReportPdfCreateResult.Fail(
                ValuationReportPdfFailure.HtmlTooLarge,
                "حجم التقرير يتجاوز الحد المسموح (64 م.ب) — قلّل عدد الصور المرفقة.");
        }

        var vr = await db.ValuationRequests.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == valuationRequestId, cancellationToken);
        if (vr is null)
        {
            return ValuationReportPdfCreateResult.Fail(
                ValuationReportPdfFailure.RequestNotFound,
                "طلب التقييم غير موجود.");
        }

        if (!renderer.IsConfigured)
        {
            return ValuationReportPdfCreateResult.Fail(
                ValuationReportPdfFailure.RendererUnavailable,
                "خدمة تحويل التقرير إلى PDF غير مهيأة على الخادم (PdfRenderer:BaseUrl).");
        }

        byte[] pdf;
        try
        {
            pdf = await renderer.RenderAsync(html, cancellationToken);
        }
        catch (HtmlPdfRendererUnavailableException ex)
        {
            logger?.LogWarning(ex, "Report PDF renderer unavailable for request {RequestId}", valuationRequestId);
            return ValuationReportPdfCreateResult.Fail(
                ValuationReportPdfFailure.RendererUnavailable,
                "خدمة تحويل PDF غير متاحة حالياً — حاول مرة أخرى بعد قليل.");
        }
        catch (HtmlPdfRenderFailedException ex)
        {
            logger?.LogWarning(ex, "Report PDF render failed for request {RequestId}", valuationRequestId);
            return ValuationReportPdfCreateResult.Fail(
                ValuationReportPdfFailure.RendererFailed,
                "تعذّر تحويل التقرير إلى PDF.");
        }

        var now = _time.GetUtcNow().UtcDateTime;
        var reportNumber = (request.ReportNumber ?? "").Trim();
        if (reportNumber.Length == 0) reportNumber = vr.DisplayId;
        var fileName = ValuationReportPdfRules.BuildFileName(reportNumber, vr.DisplayId);
        var sha256 = Convert.ToHexStringLower(SHA256.HashData(pdf));

        var row = ValuationReportPdf.Create(
            valuationRequestId,
            reportNumber,
            fileName,
            pdf,
            sha256,
            renderer.Name,
            actorId,
            now);
        db.ValuationReportPdfs.Add(row);

        // Retention: the new row plus the newest (KeepPerRequest - 1) existing ones survive.
        var stale = await db.ValuationReportPdfs
            .Where(x => x.ValuationRequestId == valuationRequestId)
            .OrderByDescending(x => x.CreatedAtUtc)
            .Skip(Math.Max(0, ValuationReportPdfRules.KeepPerRequest - 1))
            .ToListAsync(cancellationToken);
        if (stale.Count > 0) db.ValuationReportPdfs.RemoveRange(stale);

        await db.SaveChangesAsync(cancellationToken);
        logger?.LogInformation(
            "Report PDF {FileName} ({Size} bytes) rendered for request {RequestId}",
            fileName,
            pdf.Length,
            valuationRequestId);

        return ValuationReportPdfCreateResult.Ok(ToLink(
            row.Id,
            row.ValuationRequestId,
            row.ReportNumber,
            row.FileName,
            row.SizeBytes,
            row.Sha256,
            row.CreatedAtUtc,
            now));
    }

    public async Task<ValuationReportPdfLinkDto?> GetLatestLinkAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken = default)
    {
        var latest = await db.ValuationReportPdfs.AsNoTracking()
            .Where(x => x.ValuationRequestId == valuationRequestId)
            .OrderByDescending(x => x.CreatedAtUtc)
            .Select(x => new
            {
                x.Id,
                x.ValuationRequestId,
                x.ReportNumber,
                x.FileName,
                x.SizeBytes,
                x.Sha256,
                x.CreatedAtUtc,
            })
            .FirstOrDefaultAsync(cancellationToken);
        if (latest is null) return null;
        return ToLink(
            latest.Id,
            latest.ValuationRequestId,
            latest.ReportNumber,
            latest.FileName,
            latest.SizeBytes,
            latest.Sha256,
            latest.CreatedAtUtc,
            _time.GetUtcNow().UtcDateTime);
    }

    public async Task<ValuationReportPdfFile?> OpenSharedAsync(
        string fileName,
        string token,
        CancellationToken cancellationToken = default)
    {
        var name = (fileName ?? "").Trim();
        if (name.Length == 0) return null;
        var parsed = signer.Verify(token, name, _time.GetUtcNow());
        if (parsed is null) return null;

        var row = await db.ValuationReportPdfs.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == parsed.PdfId, cancellationToken);
        if (row is null) return null;
        if (!string.Equals(row.FileName, name, StringComparison.OrdinalIgnoreCase)) return null;

        return new ValuationReportPdfFile(row.Id, row.FileName, row.Content, row.Sha256, row.CreatedAtUtc);
    }

    private ValuationReportPdfLinkDto ToLink(
        Guid pdfId,
        Guid valuationRequestId,
        string reportNumber,
        string fileName,
        long sizeBytes,
        string sha256,
        DateTime createdAtUtc,
        DateTime nowUtc)
    {
        var expires = new DateTimeOffset(DateTime.SpecifyKind(nowUtc, DateTimeKind.Utc)).Add(signer.Lifetime);
        var token = signer.Sign(pdfId, fileName, expires);
        return new ValuationReportPdfLinkDto
        {
            PdfId = pdfId,
            ValuationRequestId = valuationRequestId,
            ReportNumber = reportNumber,
            FileName = fileName,
            Url = $"/api/valuation-reports/{Uri.EscapeDataString(fileName)}?k={token}",
            ExpiresAtUtc = expires.UtcDateTime.ToString("O"),
            CreatedAtUtc = DateTime.SpecifyKind(createdAtUtc, DateTimeKind.Utc).ToString("O"),
            SizeBytes = sizeBytes,
            Sha256 = sha256,
        };
    }
}

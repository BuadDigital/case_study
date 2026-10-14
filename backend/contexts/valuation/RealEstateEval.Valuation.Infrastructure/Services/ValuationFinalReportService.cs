using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RealEstateEval.Application;
using RealEstateEval.Attachments.Application.Abstractions;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Application.Rules;
using RealEstateEval.Valuation.Domain;
using RealEstateEval.Valuation.Infrastructure.Data.Contexts;

namespace RealEstateEval.Valuation.Infrastructure.Services;

/// <summary>See <see cref="IValuationFinalReportService"/>.</summary>
public sealed class ValuationFinalReportService(
    ValuationDbContext db,
    IHtmlPdfRenderer renderer,
    IPdfMerger merger,
    IAttachmentFileStore files,
    TimeProvider? time = null,
    ILogger<ValuationFinalReportService>? logger = null) : IValuationFinalReportService
{
    private readonly TimeProvider _time = time ?? TimeProvider.System;

    public async Task<string> EnsureGeneratedAsync(Guid valuationRequestId, CancellationToken cancellationToken = default)
    {
        var row = await CurrentCopyAsync(valuationRequestId, tracked: true, cancellationToken);
        if (row?.FinalIssuedAtUtc is null || string.IsNullOrWhiteSpace(row.DepositCode))
            return FinalReportStatuses.None;
        if (row.FinalPdfIsCurrent) return FinalReportStatuses.Ready;

        // The render + merge + store is one unit that must finish once started: a browser that gives up waiting
        // (or a proxy that cuts the request) must not leave the PDF half done. The renderer has its own timeouts.
        var work = CancellationToken.None;
        try
        {
            var html = await ApprovedHtmlAsync(row, work);
            if (html is null)
            {
                logger?.LogWarning("No approved report snapshot for request {RequestId} v{Version}", valuationRequestId, row.Version);
                return FinalReportStatuses.Preparing;
            }

            var rewritten = ReportDepositCodeRewriter.Apply(html, row.DepositCode);
            if (rewritten.Replaced == 0)
            {
                // A final copy without the code in its headers would be wrong: leave it unprepared.
                logger?.LogWarning("The approved report of request {RequestId} has no deposit-code line to fill", valuationRequestId);
                return FinalReportStatuses.Preparing;
            }

            var certificate = await CertificateBytesAsync(row, work);
            if (certificate is null)
            {
                logger?.LogWarning("The deposit certificate of request {RequestId} could not be read", valuationRequestId);
                return FinalReportStatuses.Preparing;
            }

            var propertyId = await db.ValuationRequests.AsNoTracking()
                .Where(x => x.Id == valuationRequestId)
                .Select(x => x.PropertyId)
                .FirstAsync(work);
            var report = await renderer.RenderAsync(rewritten.Html, work);
            var merged = await merger.MergeAsync([report, certificate], work);

            var (id, error) = await files.StoreAsync(
                ReportFileScopes.FinalReport,
                ReportFileScopes.Key(propertyId, "final", row.Version),
                ReportFileScopes.PdfFileName(null, $"final-report-v{row.Version}"),
                "application/pdf",
                merged,
                work);
            if (id is null)
            {
                logger?.LogWarning("Storing the final report of request {RequestId} failed: {Error}", valuationRequestId, error);
                return FinalReportStatuses.Preparing;
            }

            var replaced = row.FinalPdfAttachmentId;
            row.SetFinalPdf(id.Value, row.DepositCode, _time.UtcNow());
            await db.SaveChangesAsync(work);
            if (replaced is { } old) await files.DeleteAsync(old, work);
            return FinalReportStatuses.Ready;
        }
        catch (Exception ex) when (ex is HtmlPdfRendererUnavailableException or HtmlPdfRenderFailedException)
        {
            logger?.LogWarning(ex, "Generating the final report of request {RequestId} failed", valuationRequestId);
            return FinalReportStatuses.Preparing;
        }
    }

    public async Task<FinalReportFile?> GetFileAsync(Guid valuationRequestId, CancellationToken cancellationToken = default)
    {
        var row = await CurrentCopyAsync(valuationRequestId, tracked: false, cancellationToken);
        if (row is null || !row.FinalPdfIsCurrent || row.FinalPdfAttachmentId is not { } id) return null;

        var bytes = await files.ReadAsync(id, cancellationToken);
        return bytes is null ? null : new FinalReportFile(bytes, $"final-report-v{row.Version}.pdf");
    }

    private Task<ValuationReportIssuance?> CurrentCopyAsync(Guid valuationRequestId, bool tracked, CancellationToken ct)
    {
        var query = tracked ? db.ValuationReportIssuances.AsQueryable() : db.ValuationReportIssuances.AsNoTracking();
        return query.FirstOrDefaultAsync(
            x => x.ValuationRequestId == valuationRequestId && x.SupersededAtUtc == null, ct);
    }

    private async Task<string?> ApprovedHtmlAsync(ValuationReportIssuance row, CancellationToken ct)
    {
        var gz = await db.ValuationReportDrafts.AsNoTracking()
            .Where(x => x.ValuationRequestId == row.ValuationRequestId && x.Version == row.Version)
            .Select(x => x.SnapshotHtmlGz)
            .FirstOrDefaultAsync(ct);
        return gz is { Length: > 0 } ? ReportDraftSnapshot.Decompress(gz) : null;
    }

    private async Task<byte[]?> CertificateBytesAsync(ValuationReportIssuance row, CancellationToken ct)
    {
        if (row.CertificateAttachmentId is { } id) return await files.ReadAsync(id, ct);
        return row.CertificateContent is { Length: > 0 } legacy ? legacy : null;
    }
}

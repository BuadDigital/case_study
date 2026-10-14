using Microsoft.EntityFrameworkCore;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Infrastructure.Data.Contexts;

namespace RealEstateEval.Valuation.Infrastructure.Services;

/// <summary>
/// Serves stored report PDF copies from the signed <c>.pdf?k=…</c> links already shared.
/// </summary>
public sealed class ValuationReportPdfService(
    ValuationDbContext db,
    IReportLinkSigner signer,
    TimeProvider? time = null) : IValuationReportPdfService
{
    private readonly TimeProvider _time = time ?? TimeProvider.System;

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
}

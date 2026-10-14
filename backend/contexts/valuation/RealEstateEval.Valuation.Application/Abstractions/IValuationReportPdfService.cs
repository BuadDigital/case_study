namespace RealEstateEval.Valuation.Application.Abstractions;

/// <summary>
/// Stored report PDF copies served from signed <c>.pdf?k=…</c> links already shared.
/// </summary>
public interface IValuationReportPdfService
{
 /// <summary>
 /// Resolve a public link. Null for an unknown, expired, tampered or mismatched token —
 /// callers answer 404 in every case so the link leaks nothing.
 /// </summary>
    Task<ValuationReportPdfFile?> OpenSharedAsync(
        string fileName,
        string token,
        CancellationToken cancellationToken = default);
}

/// <summary>Bytes served from the public link.</summary>
public sealed record ValuationReportPdfFile(
    Guid PdfId,
    string FileName,
    byte[] Content,
    string Sha256,
    DateTime CreatedAtUtc);

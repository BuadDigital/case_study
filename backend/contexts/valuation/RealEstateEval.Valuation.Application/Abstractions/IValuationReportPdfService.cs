using RealEstateEval.Valuation.Application.Contracts;

namespace RealEstateEval.Valuation.Application.Abstractions;

/// <summary>
/// Report PDF copies rendered from the on-screen HTML and served from signed <c>.pdf?k=…</c> links.
/// </summary>
public interface IValuationReportPdfService
{
 /// <summary>Render the posted HTML, store the PDF, and return a fresh signed link.</summary>
    Task<ValuationReportPdfCreateResult> CreateFromHtmlAsync(
        Guid valuationRequestId,
        CreateValuationReportPdfRequest request,
        string? actorId,
        CancellationToken cancellationToken = default);

 /// <summary>Signed link for the most recent stored PDF, or null when none was rendered yet.</summary>
    Task<ValuationReportPdfLinkDto?> GetLatestLinkAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken = default);

 /// <summary>
 /// Resolve a public link. Null for an unknown, expired, tampered or mismatched token —
 /// callers answer 404 in every case so the link leaks nothing.
 /// </summary>
    Task<ValuationReportPdfFile?> OpenSharedAsync(
        string fileName,
        string token,
        CancellationToken cancellationToken = default);
}

public enum ValuationReportPdfFailure
{
    None = 0,
    RequestNotFound,
    InvalidHtml,
    HtmlTooLarge,
    RendererUnavailable,
    RendererFailed,
}

/// <summary>Outcome of a render request — the controller maps failures to HTTP statuses.</summary>
public sealed record ValuationReportPdfCreateResult(
    ValuationReportPdfLinkDto? Link,
    ValuationReportPdfFailure Failure,
    string? MessageAr)
{
    public static ValuationReportPdfCreateResult Ok(ValuationReportPdfLinkDto link) =>
        new(link, ValuationReportPdfFailure.None, null);

    public static ValuationReportPdfCreateResult Fail(ValuationReportPdfFailure failure, string messageAr) =>
        new(null, failure, messageAr);
}

/// <summary>Bytes served from the public link.</summary>
public sealed record ValuationReportPdfFile(
    Guid PdfId,
    string FileName,
    byte[] Content,
    string Sha256,
    DateTime CreatedAtUtc);

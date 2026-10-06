namespace RealEstateEval.Valuation.Application.Abstractions;

/// <summary>Joins PDF files into one, in the order given (the final report + the deposit certificate page).</summary>
public interface IPdfMerger
{
    /// <exception cref="HtmlPdfRendererUnavailableException">Merger not configured or unreachable.</exception>
    /// <exception cref="HtmlPdfRenderFailedException">The service answered but produced no valid PDF.</exception>
    Task<byte[]> MergeAsync(IReadOnlyList<byte[]> pdfs, CancellationToken cancellationToken = default);
}

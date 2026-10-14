namespace RealEstateEval.Valuation.Application.Abstractions;

/// <summary>The generated final report: the approved report with the deposit code in its headers + the certificate page.</summary>
public sealed record FinalReportFile(byte[] Content, string FileName);

/// <summary>
/// Generates and serves the final PDF of a request's current deposit copy. The approved report (frozen at approval)
/// is the source; only the deposit code and the certificate page are added. A renderer or store failure never
/// blocks anything: the status stays <c>preparing</c> and the call can be repeated.
/// </summary>
public interface IValuationFinalReportService
{
    /// <summary>
    /// Makes sure the stored PDF carries the current deposit code: generates it when missing and regenerates it
    /// after a code correction. Returns the resulting <c>FinalReportStatuses</c> value (none | preparing | ready).
    /// </summary>
    Task<string> EnsureGeneratedAsync(Guid valuationRequestId, CancellationToken cancellationToken = default);

    /// <summary>The stored final PDF of the current copy; null when it is not generated (yet).</summary>
    Task<FinalReportFile?> GetFileAsync(Guid valuationRequestId, CancellationToken cancellationToken = default);
}

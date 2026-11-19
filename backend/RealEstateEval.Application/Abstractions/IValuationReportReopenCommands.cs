namespace RealEstateEval.Application.Abstractions;

/// <summary>
/// Case Study → Valuation: reopen a deposited valuation report as a new version (n+1) — what an Enfaz return
/// does when the specialist chose to reopen the valuation. Valuation owns the operation (it also reopens the
/// appraiser's package and task); Case Study only calls it, as the case specialist (the forwarded bearer).
/// </summary>
public interface IValuationReportReopenCommands
{
    /// <summary>
    /// Reopens the property's deposited report. A refusal (role, nothing deposited) comes back as an Arabic
    /// message; transport failures throw. Idempotent on the owner side: a report already reopened is not deposited.
    /// </summary>
    Task<(bool Reopened, string? Error)> ReopenDepositedReportAsync(
        Guid propertyId,
        string reason,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Review voids the appraiser's approval of the property's report before returning the valuation to an
    /// appraiser (Omar 2026-11-18). No open request or no approval → succeeds with nothing to do. A recorded
    /// deposit code or another refusal comes back as an Arabic message; transport failures come back as one too.
    /// </summary>
    Task<string?> WithdrawApprovalForReturnAsync(
        Guid propertyId,
        string note,
        CancellationToken cancellationToken = default);
}

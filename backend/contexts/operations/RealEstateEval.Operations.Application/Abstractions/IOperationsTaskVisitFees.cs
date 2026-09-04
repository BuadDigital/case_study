using RealEstateEval.Application.Contracts;
using RealEstateEval.Operations.Domain;

namespace RealEstateEval.Operations.Application.Abstractions;

/// <summary>
/// Court-visit pricing seam used by the operations-task commands. The implementation reaches
/// the Financial pricing service and the charge writer, so the use case depends on this port
/// instead of the Infrastructure helper that owns those collaborators.
/// </summary>
public interface IOperationsTaskVisitFees
{
    /// <summary>
    /// Create-time visit fee for a court visit: employees get none, cooperators need a positive
    /// amount (the request value, else the active pricing table default).
    /// </summary>
    Task<(decimal? Fee, Guid? PricingTableId, string? Error)> ResolveCreateVisitFeeAsync(
        string assigneeId,
        decimal? requestedAmount,
        CancellationToken cancellationToken);

    /// <summary>
    /// Fee to charge on complete. Employees and already-charged visits come back unresolved
    /// with no error; a cooperator without a resolvable amount comes back as an error so the
    /// visit is never completed silently unpaid.
    /// </summary>
    Task<(ResolvedPartyFee Fee, string? Error)> ResolveCourtVisitFeeAsync(
        OperationsTask entity,
        CancellationToken cancellationToken);

    /// <summary>Opens the court-visit charge for a completed visit.</summary>
    Task AddCourtVisitFeeChargeAsync(
        OperationsTask entity,
        ResolvedPartyFee fee,
        CancellationToken cancellationToken = default);
}

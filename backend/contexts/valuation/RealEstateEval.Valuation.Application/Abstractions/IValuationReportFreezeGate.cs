namespace RealEstateEval.Valuation.Application.Abstractions;

/// <summary>
/// The valuation write lock. Two layers, one answer for every editing use case:
/// ق-6 — once a deposit copy is issued the report is frozen and only the deposit code and the
/// certificate stay recordable; and the hand-over lock — from the moment the appraiser submits
/// the appraisal package to the case specialist until it is returned, his numbers are closed.
/// </summary>
/// <remarks>
/// R2: the deposit layer follows the current copy only — superseding lifts it; the freeze of
/// adopted party outputs is a lower layer that is untouched (2-C).
/// </remarks>
public interface IValuationReportFreezeGate
{
    Task<bool> IsFrozenAsync(Guid valuationRequestId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Null when the request may be edited; otherwise the Arabic reason to return as the field
    /// error. Fails closed (a retry message) when the package state cannot be read.
    /// </summary>
    Task<string?> GetFrozenMessageAsync(
        Guid valuationRequestId,
        Guid propertyId,
        CancellationToken cancellationToken = default);
}

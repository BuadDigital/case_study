namespace RealEstateEval.Valuation.Application.Abstractions;

/// <summary>
/// ق-6: once a deposit copy is issued the report is frozen and only the deposit code and the
/// certificate stay recordable. Every editing use case asks this before it writes.
/// </summary>
/// <remarks>
/// R2: the freeze follows the current copy only — superseding lifts this layer; the freeze of
/// adopted party outputs is a lower layer that is untouched (2-C).
/// </remarks>
public interface IValuationReportFreezeGate
{
    Task<bool> IsFrozenAsync(Guid valuationRequestId, CancellationToken cancellationToken = default);
}

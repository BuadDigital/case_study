using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Abstractions;

/// <summary>
/// Key-receipt fee charges and Enfaz key-fee lines. Financial host uses EF; Operations calls HTTP.
/// </summary>
public interface IKeyReceiptFeeChargeService
{
    Task<IReadOnlyList<KeyReceiptFeeChargeDto>> ListAsync(
        CancellationToken cancellationToken = default);

    Task DeleteForEnvelopeAsync(
        Guid envelopeId,
        CancellationToken cancellationToken = default);

    Task<(KeyReceiptFeeChargeDto? Charge, string? Error)> MarkCollectedAsync(
        Guid envelopeId,
        string? invoiceReference,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<PoEnfazKeyRevenueLineDto>> ListKeyRevenueLinesAsync(
        IReadOnlyList<Guid> envelopeIds,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyDictionary<string, PoEnfazInvoiceRefDto>> GetInvoicesByPoAsync(
        IReadOnlyList<string> poNumbers,
        CancellationToken cancellationToken = default);
}

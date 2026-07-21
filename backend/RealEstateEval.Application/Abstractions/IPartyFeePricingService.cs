using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Abstractions;

public interface IPartyFeePricingService
{
    Task<IReadOnlyList<PartyFeePricingTableSummaryDto>> ListAsync(
        string? category = null,
        CancellationToken cancellationToken = default);

    /// <summary>Active schedule (used for resolve and default GET).</summary>
    Task<PartyFeePricingDto> GetActiveAsync(CancellationToken cancellationToken = default);

    Task<PartyFeePricingDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    Task<PartyFeePricingDto> CreateAsync(
        CreatePartyFeePricingTableRequest request,
        CancellationToken cancellationToken = default);

    Task<PartyFeePricingDto> SaveAsync(
        Guid id,
        PartyFeePricingDto request,
        CancellationToken cancellationToken = default);

    Task<PartyFeePricingDto> ActivateAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>Returns false when the table was not found.</summary>
    Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>
    /// Resolves the default agreed fee for a new ledger from the active table.
    /// Returns null when the fee must not be stamped yet (missing survey area)
    /// or when the party is an employee (manual entry required).
    /// </summary>
    Task<decimal?> ResolveDefaultFeeAsync(
        string taskKind,
        string partyType,
        decimal? areaM2 = null,
        CancellationToken cancellationToken = default);
}

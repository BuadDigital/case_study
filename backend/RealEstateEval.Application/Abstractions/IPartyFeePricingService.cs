using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Abstractions;

public interface IPartyFeePricingService
{
    Task<IReadOnlyList<PartyFeePricingTableSummaryDto>> ListAsync(
        string? category = null,
        CancellationToken cancellationToken = default);

    /// <summary>Merged category-default schedules (legacy / admin overview).</summary>
    Task<PartyFeePricingDto> GetActiveAsync(CancellationToken cancellationToken = default);

    Task<PartyFeePricingDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    Task<PartyFeePricingDto> CreateAsync(
        CreatePartyFeePricingTableRequest request,
        CancellationToken cancellationToken = default);

    Task<PartyFeePricingDto> SaveAsync(
        Guid id,
        PartyFeePricingDto request,
        CancellationToken cancellationToken = default);

    /// <summary>Marks the table as the category default (fallback when unassigned).</summary>
    Task<PartyFeePricingDto> ActivateAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>Returns false when the table was not found.</summary>
    Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<string>> ListAssignmentsAsync(
        Guid tableId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Replaces assignees for this table. Assignees are removed from other tables
    /// in the same category. Empty list clears all assignments on this table.
    /// </summary>
    Task<PartyFeePricingDto> SetAssignmentsAsync(
        Guid tableId,
        IReadOnlyList<string> assigneeIds,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Resolves the default agreed fee for a new ledger.
    /// Uses the assignee's assigned table when present; otherwise the category default.
    /// Engineering survey returns null when area is missing.
    /// Employees (field inspector) return null (manual entry).
    /// </summary>
    Task<decimal?> ResolveDefaultFeeAsync(
        string taskKind,
        string partyType,
        decimal? areaM2 = null,
        string? assigneeId = null,
        CancellationToken cancellationToken = default);
}

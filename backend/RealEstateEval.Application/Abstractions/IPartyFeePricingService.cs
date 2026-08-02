using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;

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
        CancellationToken cancellationToken = default,
        string actorId = "system");

    Task<PartyFeePricingDto> SaveAsync(
        Guid id,
        PartyFeePricingDto request,
        CancellationToken cancellationToken = default,
        string actorId = "system");

    /// <summary>
    /// Copies an assigned immutable table, applies the requested rates to the copy, and moves all
    /// of the source table's assignments to it in one database save.
    /// </summary>
    Task<PartyFeePricingDto> ReviseAsync(
        Guid sourceId,
        PartyFeePricingDto request,
        CancellationToken cancellationToken = default,
        string actorId = "system");

    /// <summary>Marks the table as the category default (fallback when unassigned).</summary>
    Task<PartyFeePricingDto> ActivateAsync(
        Guid id,
        CancellationToken cancellationToken = default,
        string actorId = "system");

    /// <summary>Returns false when the table was not found.</summary>
    Task<bool> DeleteAsync(
        Guid id,
        CancellationToken cancellationToken = default,
        string actorId = "system");

    Task<IReadOnlyList<string>> ListAssignmentsAsync(
        Guid tableId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Replaces assignees for this table. Assignees are removed from other tables
    /// in the same category. Empty list clears all assignments on this table.
    /// </summary>
    Task<PartyFeePricingDto> SetAssignmentsAsync(Guid tableId,IReadOnlyList<string> assigneeIds,CancellationToken cancellationToken = default,string actorId = "system");

    /// <summary>
    /// Resolves the default agreed fee for a new ledger, with the table that produced it.
    /// Uses the assignee's assigned table when present; otherwise the category default.
    /// Engineering survey is unresolved when area is missing.
    /// Employees resolve only from a flat incentive table (usually via assignment).
    /// </summary>
    Task<ResolvedPartyFee> ResolveDefaultFeeAsync(
        WorkflowTaskKind taskKind,
        string partyType,
        decimal? areaM2 = null,
        string? assigneeId = null,
        CancellationToken cancellationToken = default);
}

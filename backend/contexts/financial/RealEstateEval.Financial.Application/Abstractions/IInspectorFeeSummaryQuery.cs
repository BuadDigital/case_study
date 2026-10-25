using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Financial.Application.Abstractions;

/// <summary>
/// Read path for fee ledger list/detail (includes snapshot sync + backfill side effects).
/// </summary>
public interface IInspectorFeeSummaryQuery
{
 /// <summary>
 /// Set <paramref name="hideDisputed"/> for a finance-only actor: a line under pricing dispute must
 /// not reach finance in any response, counts included, until operations resolves it.
 /// </summary>
    Task<InspectorFeesSummaryDto> GetSummaryAsync(
        string? assigneeId,
        string? workflowTaskId,
        bool submittedOnly,
        string? taskKind = null,
        string? billingStatus = null,
        string? returnTo = null,
        bool hideDisputed = false,
        CancellationToken cancellationToken = default,
        string? supervisingDepartment = null);

    Task<InspectorFeeRowDto?> GetByWorkflowTaskIdAsync(
        Guid workflowTaskId,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<InspectorFeeAuditEntryDto>> ListTransitionsAsync(
        Guid workflowTaskId,
        CancellationToken cancellationToken = default);
}

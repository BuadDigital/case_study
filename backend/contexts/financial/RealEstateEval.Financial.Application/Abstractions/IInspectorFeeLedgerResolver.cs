using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.Financial.Application.Abstractions;

/// <summary>
/// Resolves ledger identity, deed targets, area, party type, and compensation flags
/// for inspector-fee accrual (no mutate side effects).
/// </summary>
public readonly record struct InspectorFeeDeedTarget(Guid DeedId, Guid? PropertyId);

public interface IInspectorFeeLedgerResolver
{
    Task<IReadOnlyList<InspectorFeeDeedTarget>> ResolveDeedTargetsAsync(
        WorkflowTask task,
        CancellationToken cancellationToken = default);

 /// <summary>one line per (transaction, deed, user).</summary>
    Task<(Guid TransactionId, Guid DeedId, string UserId)> ResolveLedgerIdentityAsync(
        WorkflowTask task,
        CancellationToken cancellationToken = default,
        Guid? deedIdOverride = null);

    Task<decimal?> ResolvePropertyAreaM2Async(
        WorkflowTask task,
        CancellationToken cancellationToken = default,
        Guid? propertyIdOverride = null);

    Task<string> ResolvePartyTypeAsync(
        WorkflowTask task,
        CancellationToken cancellationToken = default);

    Task<bool> AssigneeHasCompensationAsync(
        string? assigneeId,
        CancellationToken cancellationToken = default);
}

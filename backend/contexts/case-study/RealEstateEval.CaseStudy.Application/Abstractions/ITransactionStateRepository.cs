using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Abstractions;

/// <summary>
/// Persistence boundary for the Q-9 transaction-state use case. The use case in
/// <c>CaseStudy.Application</c> composes these calls; only the Infrastructure adapter opens EF.
/// </summary>
public interface ITransactionStateRepository
{
    /// <summary>
    /// Tracked property of <paramref name="workOrderId"/>, or null when the pair does not exist.
    /// Edits are persisted by <see cref="SaveChangesAsync"/>.
    /// </summary>
    Task<WorkOrderProperty?> GetPropertyAsync(
        Guid workOrderId,
        Guid propertyId,
        CancellationToken cancellationToken);

    /// <summary>Every untracked workflow task on the property, any kind or status.</summary>
    Task<IReadOnlyList<WorkflowTask>> ListPropertyTasksAsync(
        Guid propertyId,
        CancellationToken cancellationToken);

    Task<string?> GetPoNumberAsync(Guid workOrderId, CancellationToken cancellationToken);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}

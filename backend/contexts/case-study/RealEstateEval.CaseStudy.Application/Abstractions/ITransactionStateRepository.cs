using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Abstractions;

/// <summary>
/// Persistence boundary for the transaction-state use case. The use case in
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

    /// <summary>True when the case-study (non-party) report of the parent task is issued.</summary>
    Task<bool> IsCaseStudyReportIssuedAsync(Guid parentTaskId, CancellationToken cancellationToken);

    /// <summary>True when the party package of the workflow task is submitted (handed over).</summary>
    Task<bool> IsPartyPackageSubmittedAsync(Guid workflowTaskId, CancellationToken cancellationToken);

    Task<string?> GetPoNumberAsync(Guid workOrderId, CancellationToken cancellationToken);

    /// <summary>The transaction's reopening still open or awaiting the reply to Enfaz (tracked), or null.</summary>
    Task<TransactionReopening?> GetActiveReopeningAsync(Guid transactionId, CancellationToken cancellationToken);

    void AddReopening(TransactionReopening reopening);

    /// <summary>Every reopening not closed yet, newest first (the «أعمالي» rows and the reopened chip).</summary>
    Task<IReadOnlyList<TransactionReopening>> ListActiveReopeningsAsync(CancellationToken cancellationToken);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}

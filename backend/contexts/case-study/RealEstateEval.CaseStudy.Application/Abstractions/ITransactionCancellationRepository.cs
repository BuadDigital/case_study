using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Abstractions;

/// <summary>
/// Persistence boundary for «إلغاء المعاملة». Deeds and tasks come back tracked (with their work
/// order and transaction loaded) so the use case can cancel or restore them and save once.
/// </summary>
public interface ITransactionCancellationRepository
{
    /// <summary>Tracked deed with its work order and transaction, or null.</summary>
    Task<WorkOrderProperty?> GetDeedAsync(Guid propertyId, CancellationToken cancellationToken);

    /// <summary>Every tracked deed of one transaction (removed ones included), with work order and transaction.</summary>
    Task<IReadOnlyList<WorkOrderProperty>> ListTransactionDeedsAsync(
        Guid transactionId,
        CancellationToken cancellationToken);

    /// <summary>
    /// Every tracked deed of every transaction that has a deed on the work order — so a linked
    /// deed in another work order comes along with its transaction.
    /// </summary>
    Task<IReadOnlyList<WorkOrderProperty>> ListWorkOrderTransactionDeedsAsync(
        string poNumber,
        CancellationToken cancellationToken);

    /// <summary>Tracked deeds by id, with work order and transaction.</summary>
    Task<IReadOnlyList<WorkOrderProperty>> ListDeedsByIdsAsync(
        IReadOnlyCollection<Guid> propertyIds,
        CancellationToken cancellationToken);

    /// <summary>Tracked workflow tasks (every kind and status) of the deeds.</summary>
    Task<IReadOnlyList<WorkflowTask>> ListTasksForUpdateAsync(
        IReadOnlyCollection<Guid> propertyIds,
        CancellationToken cancellationToken);

    /// <summary>Tracked request by id.</summary>
    Task<TransactionCancellation?> FindAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>Untracked requests, newest first; a null status lists them all.</summary>
    Task<IReadOnlyList<TransactionCancellation>> ListAsync(
        string? status,
        CancellationToken cancellationToken);

    Task AddAsync(TransactionCancellation request, CancellationToken cancellationToken);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}

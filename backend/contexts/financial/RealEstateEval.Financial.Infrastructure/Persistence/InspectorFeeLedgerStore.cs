using Microsoft.EntityFrameworkCore;
using RealEstateEval.Financial.Application.Abstractions;
using RealEstateEval.Financial.Domain;
using RealEstateEval.Financial.Infrastructure.Data.Contexts;

namespace RealEstateEval.Financial.Infrastructure.Persistence;

/// <summary>
/// EF adapter for <see cref="IInspectorFeeLedgerStore"/>. Reads are tracked on purpose: the
/// use case mutates the returned ledgers and the transition applier shares this unit of work.
/// </summary>
public sealed class InspectorFeeLedgerStore : IInspectorFeeLedgerStore
{
    private readonly FinancialDbContext _financial;

    public InspectorFeeLedgerStore(FinancialDbContext financial) => _financial = financial;

    public async Task<IReadOnlyList<InspectorFeeLedger>> ListByWorkflowTaskAsync(
        Guid workflowTaskId,
        CancellationToken cancellationToken) =>
        await _financial.InspectorFeeLedgers
            .Where(x => x.WorkflowTaskId == workflowTaskId)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<InspectorFeeLedger>> ListByWorkflowTaskNewestFirstAsync(
        Guid workflowTaskId,
        CancellationToken cancellationToken) =>
        await _financial.InspectorFeeLedgers
            .Where(x => x.WorkflowTaskId == workflowTaskId)
            .OrderByDescending(x => x.UpdatedAtUtc)
            .ThenByDescending(x => x.CreatedAtUtc)
            .ToListAsync(cancellationToken);

    public Task<InspectorFeeLedger?> FindByWorkflowTaskAsync(
        Guid workflowTaskId,
        CancellationToken cancellationToken) =>
        _financial.InspectorFeeLedgers
            .FirstOrDefaultAsync(x => x.WorkflowTaskId == workflowTaskId, cancellationToken);

    public Task<InspectorFeeLedger?> FindByIdentityAsync(
        Guid transactionId,
        Guid deedId,
        string userId,
        CancellationToken cancellationToken) =>
        _financial.InspectorFeeLedgers.FirstOrDefaultAsync(
            x => x.TransactionId == transactionId
                && x.DeedId == deedId
                && x.UserId == userId,
            cancellationToken);

    public void AddLedger(InspectorFeeLedger ledger) => _financial.InspectorFeeLedgers.Add(ledger);

    public void AddTransition(InspectorFeeTransition transition) =>
        _financial.InspectorFeeTransitions.Add(transition);

    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        _financial.SaveChangesAsync(cancellationToken);

    public async Task DeleteForWorkflowTasksAsync(
        IReadOnlyCollection<Guid> workflowTaskIds,
        CancellationToken cancellationToken)
    {
        if (workflowTaskIds.Count == 0) return;

        await _financial.InspectorFeeTransitions
            .Where(x => workflowTaskIds.Contains(x.WorkflowTaskId))
            .ExecuteDeleteAsync(cancellationToken);

        await _financial.InspectorFeeLedgers
            .Where(x => workflowTaskIds.Contains(x.WorkflowTaskId))
            .ExecuteDeleteAsync(cancellationToken);
    }
}

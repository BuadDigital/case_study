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

    public async Task<IReadOnlyList<InspectorFeeLedger>> ListByPoAndAssigneeAsync(
        string poNumber,
        string assigneeId,
        CancellationToken cancellationToken)
    {
        var po = poNumber.Trim();
        var assignee = assigneeId.Trim();
        return await _financial.InspectorFeeLedgers
            .Where(x => x.PoNumber == po && x.AssigneeId == assignee)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<DiscountFlag>> ListPendingProposalsAsync(
        IReadOnlyCollection<Guid> workflowTaskIds,
        CancellationToken cancellationToken)
    {
        if (workflowTaskIds.Count == 0) return [];
        return await _financial.DiscountFlags
            .Where(f => f.WorkflowTaskId != null
                && workflowTaskIds.Contains(f.WorkflowTaskId.Value)
                && f.Status == DiscountFlagStatuses.Pending)
            .ToListAsync(cancellationToken);
    }

    public void AddLedger(InspectorFeeLedger ledger) => _financial.InspectorFeeLedgers.Add(ledger);

    public void AddDiscountFlag(DiscountFlag flag) => _financial.DiscountFlags.Add(flag);

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

        // Proposals belong to the task's fee; they go with it.
        await _financial.DiscountFlags
            .Where(x => x.WorkflowTaskId != null && workflowTaskIds.Contains(x.WorkflowTaskId.Value))
            .ExecuteDeleteAsync(cancellationToken);

        await _financial.InspectorFeeLedgers
            .Where(x => workflowTaskIds.Contains(x.WorkflowTaskId))
            .ExecuteDeleteAsync(cancellationToken);
    }
}

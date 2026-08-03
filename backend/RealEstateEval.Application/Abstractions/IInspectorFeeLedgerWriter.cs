using RealEstateEval.Domain;

namespace RealEstateEval.Application.Abstractions;

/// <summary>
/// Opens missing inspector-fee ledger lines for field-inspection / government-review tasks.
/// </summary>
public interface IInspectorFeeLedgerWriter
{
    Task EnsureLedgersForTasksAsync(
        IEnumerable<WorkflowTask> tasks,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Backfill draft ledgers for tasks whose case-study is complete (engineering survey excluded).
    /// </summary>
    Task BackfillMissingLedgersAsync(CancellationToken cancellationToken = default);
}

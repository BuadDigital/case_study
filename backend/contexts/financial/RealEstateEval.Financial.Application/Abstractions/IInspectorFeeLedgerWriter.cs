using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.Financial.Application.Abstractions;

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

 /// <summary>
 /// Mirrors task snapshot fields (property, ordinal, assignee) onto existing ledgers.
 /// Runs from the maintenance loop — reads must not pay for it per request.
 /// </summary>
    Task SyncLedgerSnapshotsFromTasksAsync(CancellationToken cancellationToken = default);
}

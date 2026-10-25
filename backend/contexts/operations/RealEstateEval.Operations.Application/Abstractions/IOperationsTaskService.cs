using RealEstateEval.Application.Contracts;
using RealEstateEval.Operations.Application.Contracts;

namespace RealEstateEval.Operations.Application.Abstractions;

/// <summary>
/// The operations-task façade: the reads of <see cref="IOperationsTaskQuery"/> (without its
/// row mapper, which the remote client cannot offer), every command, and the fee backfill.
/// </summary>
public interface IOperationsTaskService : IOperationsTaskCommands
{
    Task<IReadOnlyList<OperationsTaskDto>> ListAsync(
        string? assigneeId,
        string? createdBy,
        string? status,
        string actorUserId,
        string? actorAssigneeId,
        string actorRole,
        CancellationToken cancellationToken = default);

 /// <summary>Filtered / sorted plain list. Paging members of the query are ignored here.</summary>
    Task<IReadOnlyList<OperationsTaskDto>> ListAsync(
        OperationsTaskListQuery query,
        string actorUserId,
        string? actorAssigneeId,
        string actorRole,
        CancellationToken cancellationToken = default);

 /// <summary>Filtered / sorted page. The executor-queue narrowing is applied before the count.</summary>
    Task<PagedResultDto<OperationsTaskDto>> ListPagedAsync(
        OperationsTaskListQuery query,
        string actorUserId,
        string? actorAssigneeId,
        string actorRole,
        CancellationToken cancellationToken = default);

    Task<OperationsTaskDto?> GetAsync(Guid id, CancellationToken cancellationToken = default);

 /// <summary>Idempotent court-visit fee charges for completed cooperator visits missing a stamp.</summary>
    Task<int> BackfillMissingCourtVisitChargesAsync(CancellationToken cancellationToken = default);

 /// <summary>Visit fees generated from completed court_visit ops tasks.</summary>
    Task<IReadOnlyList<CourtVisitFeeReportRowDto>> ListCourtVisitFeesAsync(
        string? creditAssigneeId = null,
        CancellationToken cancellationToken = default);
}

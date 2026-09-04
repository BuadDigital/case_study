using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Operations.Application.Contracts;
using RealEstateEval.Operations.Domain;

namespace RealEstateEval.Operations.Application.Abstractions;

public interface IOperationsTaskQuery
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

    Task<IReadOnlyList<CourtVisitFeeReportRowDto>> ListCourtVisitFeesAsync(
        string? creditAssigneeId = null,
        CancellationToken cancellationToken = default);

    Task<OperationsTaskDto> MapAsync(OperationsTask row, CancellationToken cancellationToken = default);
}

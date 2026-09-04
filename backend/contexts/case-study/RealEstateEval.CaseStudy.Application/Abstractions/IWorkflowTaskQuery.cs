using RealEstateEval.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Contracts;

namespace RealEstateEval.CaseStudy.Application.Abstractions;

public interface IWorkflowTaskQuery
{
    Task<IReadOnlyList<WorkflowTaskDto>> ListAsync(
        PermissionsDto? actor = null,
        CancellationToken cancellationToken = default);

    Task<PagedResultDto<WorkflowTaskDto>> ListPagedAsync(
        int? page,
        int? pageSize,
        PermissionsDto? actor = null,
        CancellationToken cancellationToken = default);

 /// <summary>Filtered / sorted plain list. Paging members of the query are ignored here.</summary>
    Task<IReadOnlyList<WorkflowTaskDto>> ListAsync(
        WorkflowTaskListQuery query,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default);

 /// <summary>Filtered / sorted page. Party visibility is applied before the count.</summary>
    Task<PagedResultDto<WorkflowTaskDto>> ListPagedAsync(
        WorkflowTaskListQuery query,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default);

    Task<bool> IsAssignedToAsync(
        Guid id,
        string assigneeId,
        CancellationToken cancellationToken = default);
}

using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Infrastructure.Services;

public sealed class WorkflowTaskQueryService : IWorkflowTaskQuery
{
    private readonly ApplicationDbContext _db;
    private readonly IWorkflowTaskVisibilityFilter _visibility;
    private readonly DatabaseOptions _dbOptions;

    public WorkflowTaskQueryService(
        ApplicationDbContext db,
        IWorkflowTaskVisibilityFilter? visibility = null,
        IOptions<DatabaseOptions>? dbOptions = null)
    {
        _db = db;
        _visibility = visibility ?? new WorkflowTaskVisibilityFilter();
        _dbOptions = dbOptions?.Value ?? new DatabaseOptions();
    }

    public async Task<IReadOnlyList<WorkflowTaskDto>> ListAsync(
        PermissionsDto? actor = null,
        CancellationToken cancellationToken = default)
    {
        var (_, take, _, _) = NpgsqlConfiguration.ResolveListPaging(null, null, _dbOptions);
        var list = await _visibility.VisibleTaskQuery(_db.WorkflowTasks.AsNoTracking(), actor)
            .Take(take)
            .ToListAsync(cancellationToken);
        return list.Select(WorkflowTaskMapper.ToDto).ToList();
    }

    public async Task<PagedResultDto<WorkflowTaskDto>> ListPagedAsync(
        int? page,
        int? pageSize,
        PermissionsDto? actor = null,
        CancellationToken cancellationToken = default)
    {
        var (skip, take, resolvedPage, _) = NpgsqlConfiguration.ResolveListPaging(
            page,
            pageSize,
            _dbOptions);
        var query = _visibility.VisibleTaskQuery(_db.WorkflowTasks.AsNoTracking(), actor);
        var total = await query.CountAsync(cancellationToken);
        var list = await query
            .Skip(skip)
            .Take(take)
            .ToListAsync(cancellationToken);

        return new PagedResultDto<WorkflowTaskDto>
        {
            Items = list.Select(WorkflowTaskMapper.ToDto).ToList(),
            TotalCount = total,
            Page = resolvedPage,
            PageSize = take,
        };
    }

    public Task<bool> IsAssignedToAsync(
        Guid id,
        string assigneeId,
        CancellationToken cancellationToken = default)
    {
        var normalizedAssigneeId = assigneeId.Trim();
        return _db.WorkflowTasks
            .AsNoTracking()
            .AnyAsync(
                task => task.Id == id && task.AssigneeId == normalizedAssigneeId,
                cancellationToken);
    }
}

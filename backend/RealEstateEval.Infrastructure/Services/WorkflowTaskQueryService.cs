using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
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
        var dtos = list.Select(WorkflowTaskMapper.ToDto).ToList();
        await EnrichFieldInspectionCompletedAsync(dtos, cancellationToken);
        return dtos;
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

        var items = list.Select(WorkflowTaskMapper.ToDto).ToList();
        await EnrichFieldInspectionCompletedAsync(items, cancellationToken);

        return new PagedResultDto<WorkflowTaskDto>
        {
            Items = items,
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

    /// <summary>
    /// Marks engineering-survey DTOs with whether their sibling field-inspection is completed.
    /// Query is scoped to parent+property pairs present in the page (no full-table scan).
    /// </summary>
    internal async Task EnrichFieldInspectionCompletedAsync(
        IReadOnlyList<WorkflowTaskDto> dtos,
        CancellationToken cancellationToken)
    {
        var surveys = dtos
            .Where(d =>
                d.Kind == WorkflowTaskKindValues.EngineeringSurvey
                && !string.IsNullOrWhiteSpace(d.ParentTaskId)
                && !string.IsNullOrWhiteSpace(d.PropertyId))
            .ToList();
        if (surveys.Count == 0) return;

        var parentIds = new HashSet<Guid>();
        var propertyIds = new HashSet<Guid>();
        foreach (var survey in surveys)
        {
            if (Guid.TryParse(survey.ParentTaskId, out var parentId))
                parentIds.Add(parentId);
            if (Guid.TryParse(survey.PropertyId, out var propertyId))
                propertyIds.Add(propertyId);
        }

        if (parentIds.Count == 0 || propertyIds.Count == 0) return;

        var completedKeys = await _db.WorkflowTasks.AsNoTracking()
            .Where(t =>
                t.Kind == WorkflowTaskKind.FieldInspection
                && t.Status == WorkflowTaskStatus.Completed
                && t.ParentTaskId != null
                && parentIds.Contains(t.ParentTaskId.Value)
                && t.PropertyId != null
                && propertyIds.Contains(t.PropertyId.Value))
            .Select(t => new { ParentId = t.ParentTaskId!.Value, PropertyId = t.PropertyId!.Value })
            .ToListAsync(cancellationToken);

        var completed = completedKeys
            .Select(k => (Parent: k.ParentId.ToString(), Prop: k.PropertyId.ToString()))
            .ToHashSet();

        foreach (var survey in surveys)
        {
            survey.FieldInspectionCompleted = completed.Contains(
                (survey.ParentTaskId!, survey.PropertyId!));
        }
    }
}

using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Infrastructure.Services;

public sealed class WorkflowTaskQueryService : IWorkflowTaskQuery
{
    private readonly ICaseStudyRepository _caseStudy;
    private readonly IWorkflowTaskVisibilityFilter _visibility;
    private readonly DatabaseOptions _dbOptions;

    public WorkflowTaskQueryService(
        ICaseStudyRepository caseStudy,
        IWorkflowTaskVisibilityFilter? visibility = null,
        IOptions<DatabaseOptions>? dbOptions = null)
    {
        _caseStudy = caseStudy;
        _visibility = visibility ?? new WorkflowTaskVisibilityFilter();
        _dbOptions = dbOptions?.Value ?? new DatabaseOptions();
    }

    public async Task<IReadOnlyList<WorkflowTaskDto>> ListAsync(
        PermissionsDto? actor = null,
        CancellationToken cancellationToken = default)
    {
        var (_, take, _, _) = NpgsqlConfiguration.ResolveListPaging(null, null, _dbOptions);
        var list = await _visibility.VisibleTaskQuery(_caseStudy.WorkflowTasks.AsNoTracking(), actor)
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
        var query = _visibility.VisibleTaskQuery(_caseStudy.WorkflowTasks.AsNoTracking(), actor);
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
        return _caseStudy.WorkflowTasks
            .AsNoTracking()
            .AnyAsync(
                task => task.Id == id && task.AssigneeId == normalizedAssigneeId,
                cancellationToken);
    }

 /// <summary>
 /// Marks engineering-survey DTOs with sibling field-inspection completed, and
 /// property-appraisal DTOs with completed + specialist-accepted. Populated so
 /// EO/appraiser unlock works without seeing the inspection task row
 /// (party visibility hides it). Query is scoped to parent+property pairs
 /// present in the page (no full-table scan).
 /// </summary>
    internal async Task EnrichFieldInspectionCompletedAsync(
        IReadOnlyList<WorkflowTaskDto> dtos,
        CancellationToken cancellationToken)
    {
        var targets = dtos
            .Where(d =>
                (d.Kind == WorkflowTaskKindValues.EngineeringSurvey
                    || d.Kind == WorkflowTaskKindValues.PropertyAppraisal)
                && !string.IsNullOrWhiteSpace(d.ParentTaskId)
                && !string.IsNullOrWhiteSpace(d.PropertyId))
            .ToList();
        if (targets.Count == 0) return;

        var parentIds = new HashSet<Guid>();
        var propertyIds = new HashSet<Guid>();
        foreach (var target in targets)
        {
            if (Guid.TryParse(target.ParentTaskId, out var parentId))
                parentIds.Add(parentId);
            if (Guid.TryParse(target.PropertyId, out var propertyId))
                propertyIds.Add(propertyId);
        }

        if (parentIds.Count == 0 || propertyIds.Count == 0) return;

        var inspectionRows = await _caseStudy.WorkflowTasks.AsNoTracking()
            .Where(t =>
                t.Kind == WorkflowTaskKind.FieldInspection
                && t.Status == WorkflowTaskStatus.Completed
                && t.ParentTaskId != null
                && parentIds.Contains(t.ParentTaskId.Value)
                && t.PropertyId != null
                && propertyIds.Contains(t.PropertyId.Value))
            .Select(t => new
            {
                t.Id,
                ParentId = t.ParentTaskId!.Value,
                PropertyId = t.PropertyId!.Value,
            })
            .ToListAsync(cancellationToken);

        var completed = inspectionRows
            .Select(k => (Parent: k.ParentId.ToString(), Prop: k.PropertyId.ToString()))
            .ToHashSet();

        var inspectionIds = inspectionRows.Select(r => r.Id).ToList();
        var acceptedInspectionIds = inspectionIds.Count == 0
            ? new HashSet<Guid>()
            : (await _caseStudy.PartyTaskSubmissions.AsNoTracking()
                .Where(s =>
                    inspectionIds.Contains(s.WorkflowTaskId)
                    && s.AcceptedAtUtc != null)
                .Select(s => s.WorkflowTaskId)
                .ToListAsync(cancellationToken))
                .ToHashSet();

        var accepted = inspectionRows
            .Where(k => acceptedInspectionIds.Contains(k.Id))
            .Select(k => (Parent: k.ParentId.ToString(), Prop: k.PropertyId.ToString()))
            .ToHashSet();

        foreach (var target in targets)
        {
            var key = (target.ParentTaskId!, target.PropertyId!);
            target.FieldInspectionCompleted = completed.Contains(key);
            if (target.Kind == WorkflowTaskKindValues.PropertyAppraisal)
                target.FieldInspectionAccepted = accepted.Contains(key);
        }
    }
}

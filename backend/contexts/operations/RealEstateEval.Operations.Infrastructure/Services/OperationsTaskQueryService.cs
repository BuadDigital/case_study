using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Operations.Application.Abstractions;
using RealEstateEval.Operations.Infrastructure.Data.Contexts;
using RealEstateEval.Operations.Application.Contracts;
using RealEstateEval.Operations.Domain;
using RealEstateEval.Operations.Application.Rules;
using RealEstateEval.Infrastructure.Data;
using Microsoft.Extensions.Options;

namespace RealEstateEval.Operations.Infrastructure.Services;

public sealed class OperationsTaskQueryService : IOperationsTaskQuery
{
    private readonly OperationsDbContext _ops;
    private readonly ICourtVisitFeeChargeService _charges;
    private readonly IUserLabelLookup _labels;
    private readonly DatabaseOptions _dbOptions;

    [ActivatorUtilitiesConstructor]
    public OperationsTaskQueryService(
        OperationsDbContext ops,
        ICourtVisitFeeChargeService charges,
        IUserLabelLookup labels,
        IOptions<DatabaseOptions>? dbOptions = null)
    {
        _ops = ops;
        _charges = charges;
        _labels = labels;
        _dbOptions = dbOptions?.Value ?? new DatabaseOptions();
    }

    public Task<IReadOnlyList<OperationsTaskDto>> ListAsync(
        string? assigneeId,
        string? createdBy,
        string? status,
        string actorUserId,
        string? actorAssigneeId,
        string actorRole,
        CancellationToken cancellationToken = default) =>
        ListAsync(
            new OperationsTaskListQuery
            {
                AssigneeId = assigneeId,
                CreatedBy = createdBy,
                Status = status,
            },
            actorUserId,
            actorAssigneeId,
            actorRole,
            cancellationToken);

    public async Task<IReadOnlyList<OperationsTaskDto>> ListAsync(
        OperationsTaskListQuery query,
        string actorUserId,
        string? actorAssigneeId,
        string actorRole,
        CancellationToken cancellationToken = default)
    {
        var (_, take, _, _) = NpgsqlConfiguration.ResolveListPaging(null, null, _dbOptions);
        var rows = FilteredTasks(query, actorUserId, actorAssigneeId, actorRole);
        if (rows is null) return [];

        return await MapRowsAsync(
            await SortTasks(rows, query).Take(take).ToListAsync(cancellationToken),
            cancellationToken);
    }

 /// <summary>
 /// Filters and sorts in the database, then pages. The executor-queue narrowing is part of the
 /// same query, so TotalCount is the actor's total, not the table's.
 /// </summary>
    public async Task<PagedResultDto<OperationsTaskDto>> ListPagedAsync(
        OperationsTaskListQuery query,
        string actorUserId,
        string? actorAssigneeId,
        string actorRole,
        CancellationToken cancellationToken = default)
    {
        var (skip, take, resolvedPage, _) = NpgsqlConfiguration.ResolveListPaging(
            query.Page,
            query.PageSize,
            _dbOptions);

        var rows = FilteredTasks(query, actorUserId, actorAssigneeId, actorRole);
        if (rows is null)
        {
            return new PagedResultDto<OperationsTaskDto>
            {
                Items = [],
                TotalCount = 0,
                Page = resolvedPage,
                PageSize = take,
            };
        }

        var total = await rows.CountAsync(cancellationToken);
        var page = await SortTasks(rows, query)
            .Skip(skip)
            .Take(take)
            .ToListAsync(cancellationToken);

        return new PagedResultDto<OperationsTaskDto>
        {
            Items = await MapRowsAsync(page, cancellationToken),
            TotalCount = total,
            Page = resolvedPage,
            PageSize = take,
        };
    }

 /// <summary>
 /// Actor narrowing plus the allow-listed filters as EF predicates. Null means "an unrecognised
 /// status / scope / type was asked for", which matches nothing rather than widening the list.
 /// </summary>
    private IQueryable<OperationsTask>? FilteredTasks(
        OperationsTaskListQuery query,
        string actorUserId,
        string? actorAssigneeId,
        string actorRole)
    {
        var rows = _ops.OperationsTasks.AsNoTracking();

        var assignee = OperationsTaskListQueryRules.NormalizeExact(query.AssigneeId);
        if (assignee is not null)
            rows = rows.Where(t => t.AssigneeId == assignee);

        var creator = OperationsTaskListQueryRules.NormalizeExact(query.CreatedBy);
        if (creator is not null)
            rows = rows.Where(t => t.CreatedBy == creator);

 // An unrecognised status / scope / type filter matches nothing rather than being ignored.
        var (statusOk, status) = OperationsTaskListQueryRules.ResolveStatus(query.Status);
        if (!statusOk) return null;
        if (status is not null)
            rows = rows.Where(t => t.Status == status.Value);

        var (scopeOk, scope) = OperationsTaskListQueryRules.ResolveScope(query.Scope);
        if (!scopeOk) return null;
        if (scope is not null)
            rows = rows.Where(t => t.Scope == scope.Value);

        var (typeOk, type) = OperationsTaskListQueryRules.ResolveType(query.Type);
        if (!typeOk) return null;
        if (type is not null)
            rows = rows.Where(t => t.Type == type.Value);

        if (query.ActiveOnly == true)
        {
            var active = OperationsTaskListQueryRules.ActiveStatuses.ToList();
            rows = rows.Where(t => active.Contains(t.Status));
        }

        if (query.ExcludeFailurePaused == true)
        {
            rows = rows.Where(t =>
                t.Status != OperationsTaskStatus.Paused
                || t.PauseReason == null
                || !t.PauseReason.StartsWith(OperationsTaskLifecycleRules.FailurePauseReasonPrefix));
        }

        var search = OperationsTaskListQueryRules.NormalizeSearch(query.Q);
        if (search is not null)
        {
            if (_ops.Database.IsNpgsql())
            {
                // Deed search is index-backed: jsonb containment (exact deed number) plus a trigram
                // LIKE over the generated DeedsText column. See pagination-contract.md §3.
                var containment = OperationsTaskDeedSearch.ContainmentJson(search);
                var pattern = OperationsTaskDeedSearch.SubstringPattern(search);
                rows = rows.Where(t =>
                    t.Title.Contains(search)
                    || t.DisplayId.Contains(search)
                    || t.AssigneeName.Contains(search)
                    || (t.PoNumber != null && t.PoNumber.Contains(search))
                    || (t.Reference != null && t.Reference.Contains(search))
                    || (t.DeedsJson != null && EF.Functions.JsonContains(t.DeedsJson, containment))
                    || EF.Functions.Like(
                        EF.Property<string>(t, OperationsModel.OperationsTaskDeedsTextColumn),
                        pattern,
                        OperationsTaskDeedSearch.LikeEscape));
            }
            else
            {
                // In-memory provider (tests): no jsonb or generated columns — plain substring.
                rows = rows.Where(t =>
                    t.Title.Contains(search)
                    || t.DisplayId.Contains(search)
                    || t.AssigneeName.Contains(search)
                    || (t.PoNumber != null && t.PoNumber.Contains(search))
                    || (t.Reference != null && t.Reference.Contains(search))
                    || (t.DeedsJson != null && t.DeedsJson.Contains(search)));
            }
        }

        if (!OperationsTaskLifecycleRules.IsManager(actorRole))
        {
 // Executor queue is independent: only tasks assigned to the actor
 // (or rare cases they themselves created). Do not pull other
 // assignees' tasks that merely share a PO.
            var userId = actorUserId.Trim();
            var myAssignee = actorAssigneeId?.Trim() ?? "";
            rows = rows.Where(t =>
                (myAssignee.Length > 0 && t.AssigneeId == myAssignee)
                || (userId.Length > 0 && t.CreatedBy == userId));
        }

        return rows;
    }

 /// <summary>Allow-listed sort key plus a stable tiebreaker so pages never overlap.</summary>
    private static IQueryable<OperationsTask> SortTasks(
        IQueryable<OperationsTask> rows,
        OperationsTaskListQuery query)
    {
        var descending = OperationsTaskListQueryRules.ResolveDescending(query.Dir);
        IOrderedQueryable<OperationsTask> ordered;

        switch (OperationsTaskListQueryRules.ResolveSort(query.Sort))
        {
            case OperationsTaskListSortKey.Created:
                ordered = descending
                    ? rows.OrderByDescending(t => t.CreatedAtUtc)
                    : rows.OrderBy(t => t.CreatedAtUtc);
                break;
            case OperationsTaskListSortKey.Due:
                ordered = descending
                    ? rows.OrderByDescending(t => t.DueAtUtc)
                    : rows.OrderBy(t => t.DueAtUtc);
                break;
            case OperationsTaskListSortKey.Updated:
                ordered = descending
                    ? rows.OrderByDescending(t => t.UpdatedAtUtc)
                    : rows.OrderBy(t => t.UpdatedAtUtc);
                break;
            case OperationsTaskListSortKey.Priority:
 // High before medium before low ظ¤ the stored string would sort alphabetically.
                ordered = descending
                    ? rows.OrderByDescending(t => t.Priority == OperationsTaskPriority.High
                        ? 0
                        : t.Priority == OperationsTaskPriority.Medium ? 1 : 2)
                    : rows.OrderBy(t => t.Priority == OperationsTaskPriority.High
                        ? 0
                        : t.Priority == OperationsTaskPriority.Medium ? 1 : 2);
                break;
            default:
 // Queue order is the screen's: band first (always ascending, mirroring taskStatusRank),
 // then newest in the band. The CASE is inline so the database does the ordering.
                ordered = rows.OrderBy(t => t.Status == OperationsTaskStatus.Paused
                    ? 1
                    : t.Status == OperationsTaskStatus.Completed
                        || t.Status == OperationsTaskStatus.Cancelled
                        ? 2
                        : 0);
                ordered = descending
                    ? ordered.ThenByDescending(t => t.CreatedAtUtc)
                    : ordered.ThenBy(t => t.CreatedAtUtc);
                break;
        }

        return ordered.ThenBy(t => t.DisplayId).ThenBy(t => t.Id);
    }

    private async Task<IReadOnlyList<OperationsTaskDto>> MapRowsAsync(
        IReadOnlyList<OperationsTask> rows,
        CancellationToken cancellationToken)
    {
        if (rows.Count == 0) return [];

        var links = await LoadLinkedEnvelopeIdsAsync(rows.Select(r => r.Id), cancellationToken);
        var visitFees = await LoadVisitFeeAmountsAsync(rows.Select(r => r.Id), cancellationToken);
        var peopleNames = await LoadPeopleNamesAsync(rows, cancellationToken);
        return rows.Select(r => OperationsTaskSerialization.Map(
            r,
            links.GetValueOrDefault(r.Id),
            visitFees.GetValueOrDefault(r.Id),
            peopleNames)).ToList();
    }

    public async Task<OperationsTaskDto?> GetAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var row = await _ops.OperationsTasks.AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == id, cancellationToken);
        if (row is null) return null;
        return await MapAsync(row, cancellationToken);
    }

    public async Task<IReadOnlyList<CourtVisitFeeReportRowDto>> ListCourtVisitFeesAsync(
        string? creditAssigneeId = null,
        CancellationToken cancellationToken = default)
    {
        return await _charges.ListAsync(creditAssigneeId, cancellationToken);
    }

    public async Task<OperationsTaskDto> MapAsync(OperationsTask row, CancellationToken cancellationToken = default)
    {
        var links = await LoadLinkedEnvelopeIdsAsync([row.Id], cancellationToken);
        var visitFees = await LoadVisitFeeAmountsAsync([row.Id], cancellationToken);
        var peopleNames = await LoadPeopleNamesAsync([row], cancellationToken);
        return OperationsTaskSerialization.Map(
            row,
            links.GetValueOrDefault(row.Id),
            visitFees.GetValueOrDefault(row.Id),
            peopleNames);
    }

    private async Task<IReadOnlyDictionary<string, string>> LoadPeopleNamesAsync(
        IReadOnlyList<OperationsTask> rows,
        CancellationToken cancellationToken)
    {
        if (rows.Count == 0)
            return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        return await _labels.ResolveManyAsync(
            rows.SelectMany(r => new[]
            {
                r.CreatedBy,
                r.CreatedByName,
                r.AssigneeName,
                r.OriginalAssigneeName,
                r.CreditAssigneeName,
            }),
            cancellationToken);
    }

    private async Task<Dictionary<Guid, decimal?>> LoadVisitFeeAmountsAsync(
        IEnumerable<Guid> taskIds,
        CancellationToken cancellationToken)
    {
        var ids = taskIds.Distinct().ToList();
        if (ids.Count == 0) return new Dictionary<Guid, decimal?>();

        var amounts = await _charges.GetAmountsByTaskIdsAsync(ids, cancellationToken);
        return amounts.ToDictionary(entry => entry.Key, entry => entry.Value);
    }

    private async Task<Dictionary<Guid, Guid>> LoadLinkedEnvelopeIdsAsync(
        IEnumerable<Guid> taskIds,
        CancellationToken cancellationToken)
    {
        var ids = taskIds.Distinct().ToList();
        if (ids.Count == 0) return new Dictionary<Guid, Guid>();

        var rows = await _ops.KeyEnvelopes.AsNoTracking()
            .Where(e => e.OperationsTaskId != null && ids.Contains(e.OperationsTaskId.Value))
            .Select(e => new { TaskId = e.OperationsTaskId!.Value, e.Id, e.CreatedAtUtc })
            .ToListAsync(cancellationToken);

        return rows
            .GroupBy(x => x.TaskId)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.CreatedAtUtc).First().Id);
    }
}



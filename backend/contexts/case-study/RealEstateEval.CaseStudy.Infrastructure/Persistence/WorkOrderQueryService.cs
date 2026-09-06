using RealEstateEval.CaseStudy.Application.Mapping;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.Failures.Application.Abstractions;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.Infrastructure.Services;
using RealEstateEval.CaseStudy.Infrastructure.Services;

namespace RealEstateEval.CaseStudy.Infrastructure.Persistence;

public sealed class WorkOrderQueryService : IWorkOrderQuery
{
    private const WorkflowTaskKind CaseStudyPropertyKind = WorkflowTaskKind.CaseStudyProperty;
    private const int MaxDetailRows = 500;

    private readonly CaseStudyDbContext _db;
    private readonly IFailureLookup _failureLookup;
    private readonly IPoEnfazInvoiceLookup _enfazInvoices;
    private readonly IUserLabelLookup _labels;
    private readonly IWorkOrderVisibilityFilter _visibility;
    private readonly IWorkOrderLoader _loader;
    private readonly DatabaseOptions _dbOptions;
    private readonly TimeProvider _time;

    [ActivatorUtilitiesConstructor]
    public WorkOrderQueryService(
        CaseStudyDbContext db,
        IFailureLookup failureLookup,
        IPoEnfazInvoiceLookup enfazInvoices,
        IUserLabelLookup labels,
        IWorkOrderLoader loader,
        IWorkOrderVisibilityFilter? visibility = null,
        IOptions<DatabaseOptions>? dbOptions = null,
        TimeProvider? time = null)
    {
        _db = db;
        _failureLookup = failureLookup;
        _enfazInvoices = enfazInvoices;
        _labels = labels;
        _loader = loader;
        _visibility = visibility ?? new WorkOrderVisibilityFilter(db);
        _dbOptions = dbOptions?.Value ?? new DatabaseOptions();
        _time = time ?? TimeProvider.System;
    }

    public Task<IReadOnlyList<WorkOrderListItemDto>> ListAsync(
        PermissionsDto? actor = null,
        CancellationToken cancellationToken = default) =>
        ListAsync(WorkOrderListQuery.Empty, actor, cancellationToken);

    public async Task<IReadOnlyList<WorkOrderListItemDto>> ListAsync(
        WorkOrderListQuery query,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default)
    {
        var (_, take, _, _) = NpgsqlConfiguration.ResolveListPaging(null, null, _dbOptions);
        var visiblePos = await _visibility.ResolveVisiblePoNumbersAsync(actor, cancellationToken);
        if (visiblePos is { Count: 0 })
            return [];

        return await BuildListItemsAsync(query, visiblePos, null, take, cancellationToken);
    }

    public Task<PagedResultDto<WorkOrderListItemDto>> ListPagedAsync(
        int? page,
        int? pageSize,
        PermissionsDto? actor = null,
        CancellationToken cancellationToken = default) =>
        ListPagedAsync(
            new WorkOrderListQuery { Page = page, PageSize = pageSize },
            actor,
            cancellationToken);

 /// <summary>
 /// Filters and sorts in the database, then pages. Party visibility narrows the query before the
 /// count so TotalCount is the actor's total, not the table's.
 /// </summary>
    public async Task<PagedResultDto<WorkOrderListItemDto>> ListPagedAsync(
        WorkOrderListQuery query,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default)
    {
        var (skip, take, resolvedPage, _) = NpgsqlConfiguration.ResolveListPaging(
            query.Page,
            query.PageSize,
            _dbOptions);
        var visiblePos = await _visibility.ResolveVisiblePoNumbersAsync(actor, cancellationToken);
        if (visiblePos is { Count: 0 })
        {
            return new PagedResultDto<WorkOrderListItemDto>
            {
                Items = [],
                TotalCount = 0,
                Page = resolvedPage,
                PageSize = take,
            };
        }

        var total = await FilteredWorkOrders(query, visiblePos).CountAsync(cancellationToken);
        var items = await BuildListItemsAsync(query, visiblePos, skip, take, cancellationToken);

        return new PagedResultDto<WorkOrderListItemDto>
        {
            Items = items,
            TotalCount = total,
            Page = resolvedPage,
            PageSize = take,
        };
    }

 /// <summary>
 /// PO list KPI counters. Every number is a SQL COUNT over the same filtered, visibility-narrowed
 /// set the list pages — no row is materialised. Mirrors poListKpi on the screen; see
 /// docs/architecture/pagination-contract.md §1.1.
 /// </summary>
    public async Task<WorkOrderListCountsDto> CountsAsync(
        WorkOrderListQuery query,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default)
    {
        var visiblePos = await _visibility.ResolveVisiblePoNumbersAsync(actor, cancellationToken);
        if (visiblePos is { Count: 0 })
            return new WorkOrderListCountsDto();

        var visible = VisibleWorkOrders(visiblePos);
        var filtered = FilteredWorkOrders(query, visiblePos);
        var active = NotTerminal(filtered);

        var today = DateOnly.FromDateTime(_time.UtcNow());
        var dueSoonUpper = WorkOrderListQueryRules.DueSoonUpperBound(today);

        return new WorkOrderListCountsDto
        {
            Total = await filtered.CountAsync(cancellationToken),
            TotalUnfiltered = await visible.CountAsync(cancellationToken),
            Active = await active.CountAsync(cancellationToken),
            Overdue = await active
                .Where(w => w.DueDateAt < today)
                .CountAsync(cancellationToken),
            DueSoon = await active
                .Where(w => w.DueDateAt > today && w.DueDateAt <= dueSoonUpper)
                .CountAsync(cancellationToken),
            DoneProperties = await filtered
                .SelectMany(w => w.Properties)
                .Where(p => !p.IsRemoved && _db.WorkflowTasks.Any(t =>
                    t.Kind == CaseStudyPropertyKind
                    && t.PropertyId == p.Id
                    && (t.Status == WorkflowTaskStatus.Completed
                        || t.Phase == WorkflowTaskPhase.Done)))
                .CountAsync(cancellationToken),
        };
    }

 /// <summary>
 /// Rows whose PO list status is not terminal — the screen's !isPoListStatusTerminal(status).
 /// cancelled / stopped are the lifecycle overrides; completed (and therefore fully_billed, which
 /// only refines it) is the count condition. new / under_study / partially_billed stay.
 /// </summary>
    private IQueryable<WorkOrder> NotTerminal(IQueryable<WorkOrder> rows) =>
        rows.Where(w =>
            (w.LifecycleStatus == null
                || (w.LifecycleStatus != WorkOrderLifecycleStatus.Cancelled
                    && w.LifecycleStatus != WorkOrderLifecycleStatus.Stopped))
            && !(w.Properties.Count(p => !p.IsRemoved) > 0
                && w.Properties.Count(p => !p.IsRemoved)
                    >= (w.ExpectedPropertyCount < 1 ? 1 : w.ExpectedPropertyCount)
                && w.Properties.Count(p => !p.IsRemoved && _db.WorkflowTasks.Any(t =>
                        t.Kind == CaseStudyPropertyKind
                        && t.PoNumber == w.PoNumber
                        && t.PropertyId == p.Id
                        && (t.Status == WorkflowTaskStatus.Completed
                            || t.Phase == WorkflowTaskPhase.Done)))
                    >= w.Properties.Count(p => !p.IsRemoved)));

    private IQueryable<WorkOrder> VisibleWorkOrders(HashSet<string>? visiblePos)
    {
        IQueryable<WorkOrder> rows = _db.WorkOrders.AsNoTracking();
        return visiblePos is null ? rows : rows.Where(w => visiblePos.Contains(w.PoNumber));
    }

 /// <summary>Visibility + filters as EF predicates; nothing is filtered after materialisation.</summary>
    private IQueryable<WorkOrder> FilteredWorkOrders(
        WorkOrderListQuery query,
        HashSet<string>? visiblePos)
    {
        var rows = VisibleWorkOrders(visiblePos);

        var type = WorkOrderListQueryRules.ResolveAssignmentType(query.Type);
        if (type is not null)
            rows = rows.Where(w => w.AssignmentType == type.Value);

        var status = WorkOrderListQueryRules.ResolveStatus(query.Status);
        if (status is not null)
            rows = WhereStatus(rows, status.Value);

        var search = WorkOrderListQueryRules.NormalizeSearch(query.Q);
        if (search is not null)
        {
            var typeMatches = WorkOrderListQueryRules.AssignmentTypesMatching(search).ToList();
            rows = rows.Where(w =>
                w.PoNumber.Contains(search)
                || (w.AssignmentSpecialist != null && w.AssignmentSpecialist.Contains(search))
                || typeMatches.Contains(w.AssignmentType)
                || w.Properties.Any(p =>
                    !p.IsRemoved
                    && (p.DeedNumber.Contains(search)
                        || (p.RealEstateRegNumber != null
                            && p.RealEstateRegNumber.Contains(search)))));
        }

        return rows;
    }

 /// <summary>
 /// WorkOrderListStatus.Resolve expressed over Case Study columns only. The billed refinement
 /// needs the Financial invoice set, so the two billing buckets are widened to their study
 /// equivalent by WorkOrderListQueryRules.ResolveStatus.
 /// </summary>
    private IQueryable<WorkOrder> WhereStatus(
        IQueryable<WorkOrder> rows,
        WorkOrderListStatusFilter status)
    {
        if (status == WorkOrderListStatusFilter.Cancelled)
            return rows.Where(w => w.LifecycleStatus == WorkOrderLifecycleStatus.Cancelled);

        if (status == WorkOrderListStatusFilter.Stopped)
            return rows.Where(w => w.LifecycleStatus == WorkOrderLifecycleStatus.Stopped);

        rows = rows.Where(w =>
            w.LifecycleStatus == null
            || (w.LifecycleStatus != WorkOrderLifecycleStatus.Cancelled
                && w.LifecycleStatus != WorkOrderLifecycleStatus.Stopped));

        return status switch
        {
            WorkOrderListStatusFilter.New =>
                rows.Where(w => w.Properties.Count(p => !p.IsRemoved) == 0),
            WorkOrderListStatusFilter.Completed =>
                rows.Where(w =>
                    w.Properties.Count(p => !p.IsRemoved) > 0
                    && w.Properties.Count(p => !p.IsRemoved)
                        >= (w.ExpectedPropertyCount < 1 ? 1 : w.ExpectedPropertyCount)
                    && w.Properties.Count(p => !p.IsRemoved && _db.WorkflowTasks.Any(t =>
                            t.Kind == CaseStudyPropertyKind
                            && t.PoNumber == w.PoNumber
                            && t.PropertyId == p.Id
                            && (t.Status == WorkflowTaskStatus.Completed
                                || t.Phase == WorkflowTaskPhase.Done)))
                        >= w.Properties.Count(p => !p.IsRemoved)),
            _ =>
                rows.Where(w =>
                    w.Properties.Count(p => !p.IsRemoved) > 0
                    && !(w.Properties.Count(p => !p.IsRemoved)
                            >= (w.ExpectedPropertyCount < 1 ? 1 : w.ExpectedPropertyCount)
                        && w.Properties.Count(p => !p.IsRemoved && _db.WorkflowTasks.Any(t =>
                                t.Kind == CaseStudyPropertyKind
                                && t.PoNumber == w.PoNumber
                                && t.PropertyId == p.Id
                                && (t.Status == WorkflowTaskStatus.Completed
                                    || t.Phase == WorkflowTaskPhase.Done)))
                            >= w.Properties.Count(p => !p.IsRemoved))),
        };
    }

 /// <summary>Allow-listed sort key plus a stable tiebreaker so pages never overlap.</summary>
    private static IQueryable<WorkOrder> SortWorkOrders(
        IQueryable<WorkOrder> rows,
        WorkOrderListQuery query)
    {
        var descending = WorkOrderListQueryRules.ResolveDescending(query.Dir);
        var ordered = WorkOrderListQueryRules.ResolveSort(query.Sort) switch
        {
            WorkOrderListSortKey.PoNumber => descending
                ? rows.OrderByDescending(w => w.PoNumber)
                : rows.OrderBy(w => w.PoNumber),
            WorkOrderListSortKey.ReceivedFromEnfath => descending
                ? rows.OrderByDescending(w => w.ReceivedFromEnfathAt)
                : rows.OrderBy(w => w.ReceivedFromEnfathAt),
            WorkOrderListSortKey.DueDate => descending
                ? rows.OrderByDescending(w => w.DueDateAt)
                : rows.OrderBy(w => w.DueDateAt),
            _ => descending
                ? rows.OrderByDescending(w => w.CreatedAtUtc)
                : rows.OrderBy(w => w.CreatedAtUtc),
        };

        return ordered.ThenBy(w => w.PoNumber);
    }

    public async Task<IReadOnlyList<WorkOrderDto>> ListDetailsAsync(
        PermissionsDto? actor = null,
        CancellationToken cancellationToken = default)
    {
        IQueryable<WorkOrder> query = _db.WorkOrders
            .AsNoTracking()
            .Include(w => w.Properties)
            .ThenInclude(p => p.Contacts)
            .OrderByDescending(w => w.CreatedAtUtc);

        var visiblePos = await _visibility.ResolveVisiblePoNumbersAsync(actor, cancellationToken);
        if (visiblePos is not null)
        {
            if (visiblePos.Count == 0)
                return [];
            query = query.Where(w => visiblePos.Contains(w.PoNumber));
        }

        var list = await query.Take(MaxDetailRows).ToListAsync(cancellationToken);
        return await WithResolvedSpecialistsAsync(
            list.Select(WorkOrderMapper.ToDto).ToList(),
            cancellationToken);
    }

    public async Task<IReadOnlyList<PropertyListItemDto>> ListPropertyListItemsAsync(
        PermissionsDto? actor = null,
        CancellationToken cancellationToken = default)
    {
        IQueryable<WorkOrder> query = _db.WorkOrders
            .AsNoTracking()
            .Include(w => w.Properties)
            .ThenInclude(p => p.Contacts)
            .OrderByDescending(w => w.CreatedAtUtc);

        var visiblePos = await _visibility.ResolveVisiblePoNumbersAsync(actor, cancellationToken);
        if (visiblePos is not null)
        {
            if (visiblePos.Count == 0)
                return [];
            query = query.Where(w => visiblePos.Contains(w.PoNumber));
        }

        var list = await query.Take(MaxDetailRows).ToListAsync(cancellationToken);

        var failureKeys = (await _failureLookup.ListApprovedPropertyKeysAsync(cancellationToken))
            .ToHashSet(StringComparer.Ordinal);

        var propertyIds = list.SelectMany(w => w.Properties.Select(p => p.Id)).ToList();
        var poNumbers = list.Select(w => w.PoNumber.Trim()).Distinct().ToList();
        var tasks = propertyIds.Count == 0
            ? []
            : await _db.WorkflowTasks
                .AsNoTracking()
                .Where(t => poNumbers.Contains(t.PoNumber)
                    && t.PropertyId != null
                    && propertyIds.Contains(t.PropertyId.Value))
                .ToListAsync(cancellationToken);

        var tasksByProperty = tasks
            .Where(t => t.PropertyId.HasValue)
            .GroupBy(t => t.PropertyId!.Value)
            .ToDictionary(
                g => g.Key,
                g => (IReadOnlyList<WorkflowTask>)g.ToList());

        return await WithResolvedPropertySpecialistsAsync(
            PropertyListRowBuilder.Build(list, failureKeys, tasksByProperty),
            cancellationToken);
    }

    public async Task<WorkOrderDto?> GetByPoNumberAsync(
        string poNumber,
        PermissionsDto? actor = null,
        CancellationToken cancellationToken = default)
    {
        if (!await _visibility.CanReadPoAsync(
                IWorkOrderLoader.NormalizePo(poNumber), actor, cancellationToken))
            return null;

        var entity = await _loader.LoadAsync(poNumber, cancellationToken, asNoTracking: true);
        return entity is null
            ? null
            : await WithResolvedSpecialistAsync(WorkOrderMapper.ToDto(entity), cancellationToken);
    }

    public Task<bool> ExistsAsync(string poNumber, CancellationToken cancellationToken) =>
        _db.WorkOrders.AnyAsync(
            w => w.PoNumber == IWorkOrderLoader.NormalizePo(poNumber),
            cancellationToken);

    public async Task<PriorDeedRegistrationDto?> FindPriorDeedAsync(
        string deedNumber,
        string? excludePoNumber,
        CancellationToken cancellationToken,
        Guid? excludePropertyId = null)
    {
        var list = await ListPriorDeedsAsync(
            deedNumber,
            excludePoNumber,
            cancellationToken,
            excludePropertyId,
            take: 1);
        return list.FirstOrDefault();
    }

    public async Task<IReadOnlyList<PriorDeedRegistrationDto>> ListPriorDeedsAsync(
        string deedNumber,
        string? excludePoNumber,
        CancellationToken cancellationToken,
        Guid? excludePropertyId = null,
        int take = 20)
    {
        var candidates = DeedNumberRules.MatchCandidates(deedNumber)
            .Where(c => !c.StartsWith("INQ-", StringComparison.OrdinalIgnoreCase))
            .ToList();
        if (candidates.Count == 0) return Array.Empty<PriorDeedRegistrationDto>();

        var limit = Math.Clamp(take, 1, 50);
        var exclude = string.IsNullOrWhiteSpace(excludePoNumber)
            ? null
            : IWorkOrderLoader.NormalizePo(excludePoNumber);

        var probe = await _db.WorkOrderProperties
            .AsNoTracking()
            .Include(p => p.WorkOrder)
            .Include(p => p.Contacts)
            .Where(p =>
                !p.IsRemoved &&
                !p.DeedNumber.StartsWith("INQ-") &&
                (candidates.Contains(p.DeedNumber) ||
                 (p.RealEstateRegNumber != null && candidates.Contains(p.RealEstateRegNumber))) &&
                (excludePropertyId == null || p.Id != excludePropertyId.Value) &&
                (exclude == null || p.WorkOrder!.PoNumber != exclude))
            .OrderByDescending(p => p.WorkOrder!.CreatedAtUtc)
            .Take(200)
            .ToListAsync(cancellationToken);

        return probe
            .Where(p =>
                DeedNumberRules.EqualsNormalized(p.DeedNumber, deedNumber)
                || DeedNumberRules.EqualsNormalized(p.RealEstateRegNumber, deedNumber))
            .Where(p => p.WorkOrder is not null)
            .GroupBy(p => p.Id)
            .Select(g => g.First())
            .OrderByDescending(p => p.WorkOrder!.CreatedAtUtc)
            .Take(limit)
            .Select(p => WorkOrderMapper.ToPriorDeedDto(p, p.WorkOrder!.PoNumber))
            .ToList();
    }

    public async Task<IReadOnlyList<PendingBoursePropertyDto>> ListPendingBourseAsync(
        CancellationToken cancellationToken)
    {
 // Only properties whose case-study task is currently in the bourse phase.
 // After revert to enfath, BourseDataCompleted stays false — without the phase
 // check the row would incorrectly remain on bourse inquiry.
        var list = await _db.WorkOrderProperties
            .AsNoTracking()
            .Include(p => p.WorkOrder)
            .Where(p => !p.IsRemoved && !p.BourseDataCompleted && p.WorkOrder != null)
            .Where(p => _db.WorkflowTasks.Any(t =>
                t.PropertyId == p.Id
                && t.Kind == CaseStudyPropertyKind
                && t.ParentTaskId == null
                && t.Phase == WorkflowTaskPhase.Bourse))
            .OrderByDescending(p => p.WorkOrder!.CreatedAtUtc)
            .ThenByDescending(p => p.WorkOrder!.ReceivedFromEnfathAt)
            .ThenBy(p => p.WorkOrder!.PoNumber)
            .ThenBy(p => p.DeedNumber)
            .Take(MaxDetailRows)
            .ToListAsync(cancellationToken);

        return list.Select(WorkOrderMapper.ToPendingBourse).ToList();
    }

    public async Task<WorkOrderDto> WithResolvedSpecialistAsync(
        WorkOrderDto dto,
        CancellationToken cancellationToken = default)
    {
        dto.AssignmentSpecialist = await _labels.ResolveAsync(
            dto.AssignmentSpecialist,
            cancellationToken);
        return dto;
    }

    private async Task<IReadOnlyList<WorkOrderListItemDto>> BuildListItemsAsync(
        WorkOrderListQuery listQuery,
        HashSet<string>? visiblePos,
        int? skip,
        int? take,
        CancellationToken cancellationToken)
    {
        var query = SortWorkOrders(FilteredWorkOrders(listQuery, visiblePos), listQuery);

        if (skip is > 0)
            query = query.Skip(skip.Value);
        if (take is > 0)
            query = query.Take(take.Value);

        var orders = await query
            .Include(w => w.Properties)
            .ToListAsync(cancellationToken);
        if (orders.Count == 0)
            return [];

        var poNumbers = orders.Select(w => w.PoNumber.Trim()).Distinct().ToList();
        var propertyIds = orders.SelectMany(w => w.Properties.Select(p => p.Id)).ToList();

        var caseStudyTasks = propertyIds.Count == 0
            ? []
            : await _db.WorkflowTasks
                .AsNoTracking()
                .Where(t => poNumbers.Contains(t.PoNumber)
                    && t.Kind == CaseStudyPropertyKind
                    && t.PropertyId != null
                    && propertyIds.Contains(t.PropertyId.Value))
                .ToListAsync(cancellationToken);

        var studiedByProperty = caseStudyTasks
            .Where(t => t.PropertyId.HasValue)
            .GroupBy(t => t.PropertyId!.Value)
            .ToDictionary(
                g => g.Key,
                g => g.Any(t =>
                    t.Status == WorkflowTaskStatus.Completed
                    || t.Phase == WorkflowTaskPhase.Done));

        var billedPos = poNumbers.Count == 0
            ? new HashSet<string>(StringComparer.Ordinal)
            : (await _enfazInvoices.ListBilledPoNumbersAsync(poNumbers, cancellationToken))
                .ToHashSet(StringComparer.Ordinal);

        var specialistNames = await _labels.ResolveManyAsync(
            orders.Select(w => w.AssignmentSpecialist),
            cancellationToken);

        return orders
            .Select(w =>
            {
                var item = WorkOrderMapper.ToListItem(
                    w,
                    studiedByProperty,
                    billedPos.Contains(w.PoNumber.Trim()));
                item.AssignmentSpecialist = PersonLabelResolver.ApplyResolved(
                    item.AssignmentSpecialist,
                    specialistNames);
                return item;
            })
            .ToList();
    }

    private async Task<IReadOnlyList<WorkOrderDto>> WithResolvedSpecialistsAsync(
        IReadOnlyList<WorkOrderDto> rows,
        CancellationToken cancellationToken)
    {
        var names = await _labels.ResolveManyAsync(
            rows.Select(r => r.AssignmentSpecialist),
            cancellationToken);
        foreach (var row in rows)
        {
            row.AssignmentSpecialist = PersonLabelResolver.ApplyResolved(
                row.AssignmentSpecialist,
                names);
        }

        return rows;
    }

    private async Task<IReadOnlyList<PropertyListItemDto>> WithResolvedPropertySpecialistsAsync(
        IReadOnlyList<PropertyListItemDto> rows,
        CancellationToken cancellationToken)
    {
        var names = await _labels.ResolveManyAsync(
            rows.Select(r => r.Row.Specialist),
            cancellationToken);
        foreach (var row in rows)
            row.Row.Specialist = PersonLabelResolver.ApplyResolved(row.Row.Specialist, names);
        return rows;
    }
}

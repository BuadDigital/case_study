using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.Failures.Application.Abstractions;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.Infrastructure.Services;

namespace RealEstateEval.CaseStudy.Infrastructure.Services;

public sealed class WorkOrderQueryService : IWorkOrderQuery
{
    private const WorkflowTaskKind CaseStudyPropertyKind = WorkflowTaskKind.CaseStudyProperty;
    private const int MaxDetailRows = 500;

    private readonly ICaseStudyRepository _db;
    private readonly IFailureLookup _failureLookup;
    private readonly IPoEnfazInvoiceLookup _enfazInvoices;
    private readonly IUserLabelLookup _labels;
    private readonly IWorkOrderVisibilityFilter _visibility;
    private readonly IWorkOrderLoader _loader;
    private readonly DatabaseOptions _dbOptions;

    [ActivatorUtilitiesConstructor]
    public WorkOrderQueryService(
        ICaseStudyRepository db,
        IFailureLookup failureLookup,
        IPoEnfazInvoiceLookup enfazInvoices,
        IUserLabelLookup labels,
        IWorkOrderLoader loader,
        IWorkOrderVisibilityFilter? visibility = null,
        IOptions<DatabaseOptions>? dbOptions = null)
    {
        _db = db;
        _failureLookup = failureLookup;
        _enfazInvoices = enfazInvoices;
        _labels = labels;
        _loader = loader;
        _visibility = visibility ?? new WorkOrderVisibilityFilter(db);
        _dbOptions = dbOptions?.Value ?? new DatabaseOptions();
    }

    public async Task<IReadOnlyList<WorkOrderListItemDto>> ListAsync(
        PermissionsDto? actor = null,
        CancellationToken cancellationToken = default)
    {
        var (_, take, _, _) = NpgsqlConfiguration.ResolveListPaging(null, null, _dbOptions);
        return await BuildListItemsAsync(null, take, actor, cancellationToken);
    }

    public async Task<PagedResultDto<WorkOrderListItemDto>> ListPagedAsync(
        int? page,
        int? pageSize,
        PermissionsDto? actor = null,
        CancellationToken cancellationToken = default)
    {
        var (skip, take, resolvedPage, _) = NpgsqlConfiguration.ResolveListPaging(
            page,
            pageSize,
            _dbOptions);
        var visiblePos = await _visibility.ResolveVisiblePoNumbersAsync(actor, cancellationToken);
        var totalQuery = _db.WorkOrders.AsNoTracking();
        if (visiblePos is not null)
            totalQuery = totalQuery.Where(w => visiblePos.Contains(w.PoNumber));
        var total = await totalQuery.CountAsync(cancellationToken);
        var items = await BuildListItemsAsync(skip, take, actor, cancellationToken);

        return new PagedResultDto<WorkOrderListItemDto>
        {
            Items = items,
            TotalCount = total,
            Page = resolvedPage,
            PageSize = take,
        };
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
 // check the row would incorrectly remain on استعلام البورصة.
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
        int? skip,
        int? take,
        PermissionsDto? actor,
        CancellationToken cancellationToken)
    {
        IQueryable<WorkOrder> query = _db.WorkOrders
            .AsNoTracking()
            .OrderByDescending(w => w.CreatedAtUtc);

        var visiblePos = await _visibility.ResolveVisiblePoNumbersAsync(actor, cancellationToken);
        if (visiblePos is not null)
        {
            if (visiblePos.Count == 0)
                return [];
            query = query.Where(w => visiblePos.Contains(w.PoNumber));
        }

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

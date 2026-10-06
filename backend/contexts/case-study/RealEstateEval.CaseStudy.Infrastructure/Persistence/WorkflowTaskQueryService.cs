using RealEstateEval.CaseStudy.Application.Mapping;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Failures.Application.Abstractions;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;
using RealEstateEval.CaseStudy.Infrastructure.Services;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Infrastructure.Persistence;

public sealed class WorkflowTaskQueryService : IWorkflowTaskQuery
{
    private readonly CaseStudyDbContext _caseStudy;
    private readonly DatabaseOptions _dbOptions;
    private readonly IFailureLookup? _failureLookup;

    public WorkflowTaskQueryService(
        CaseStudyDbContext caseStudy,
        IOptions<DatabaseOptions>? dbOptions = null,
        IFailureLookup? failureLookup = null)
    {
        _caseStudy = caseStudy;
        _dbOptions = dbOptions?.Value ?? new DatabaseOptions();
        _failureLookup = failureLookup;
    }

    public Task<IReadOnlyList<WorkflowTaskDto>> ListAsync(
        PermissionsDto? actor = null,
        CancellationToken cancellationToken = default) =>
        ListAsync(WorkflowTaskListQuery.Empty, actor, cancellationToken);

    public async Task<IReadOnlyList<WorkflowTaskDto>> ListAsync(
        WorkflowTaskListQuery query,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default)
    {
        var (_, take, _, _) = NpgsqlConfiguration.ResolveListPaging(null, null, _dbOptions);
        var dtos = await MaterializeAsync(
            VisibleOrderedTasks(query, actor),
            null,
            take,
            cancellationToken);
        await EnrichSiblingPartyFlagsAsync(dtos, cancellationToken);
        await EnrichFailureBlockedAsync(dtos, cancellationToken);
        return dtos;
    }

    public Task<PagedResultDto<WorkflowTaskDto>> ListPagedAsync(
        int? page,
        int? pageSize,
        PermissionsDto? actor = null,
        CancellationToken cancellationToken = default) =>
        ListPagedAsync(
            new WorkflowTaskListQuery { Page = page, PageSize = pageSize },
            actor,
            cancellationToken);

 /// <summary>
 /// Filters and sorts in the database, then pages. The visibility predicate is part of the same
 /// query, so TotalCount is the actor's total.
 /// </summary>
    public async Task<PagedResultDto<WorkflowTaskDto>> ListPagedAsync(
        WorkflowTaskListQuery query,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default)
    {
        var (skip, take, resolvedPage, _) = NpgsqlConfiguration.ResolveListPaging(
            query.Page,
            query.PageSize,
            _dbOptions);
        var rows = VisibleOrderedTasks(query, actor);
        var total = await rows.CountAsync(cancellationToken);
        var items = await MaterializeAsync(rows, skip, take, cancellationToken);
        await EnrichSiblingPartyFlagsAsync(items, cancellationToken);
        await EnrichFailureBlockedAsync(items, cancellationToken);

        return new PagedResultDto<WorkflowTaskDto>
        {
            Items = items,
            TotalCount = total,
            Page = resolvedPage,
            PageSize = take,
        };
    }

 /// <summary>
 /// Visibility rule from Application, then the allow-listed filters, then the sort. Everything is
 /// an EF expression: no row is dropped after materialisation, so paging and counts agree.
 /// </summary>
    private IQueryable<WorkflowTask> VisibleOrderedTasks(
        WorkflowTaskListQuery query,
        PermissionsDto? actor)
    {
        IQueryable<WorkflowTask> rows = _caseStudy.WorkflowTasks
            .AsNoTracking()
            .Where(WorkflowTaskVisibilityRules.VisibleTo(actor));

        var kinds = WorkflowTaskListQueryRules.ResolveKinds(query.Kind).ToList();
        if (kinds.Count > 0)
            rows = rows.Where(t => kinds.Contains(t.Kind));

        var statuses = WorkflowTaskListQueryRules.ResolveStatuses(query.Status).ToList();
        if (statuses.Count > 0)
            rows = rows.Where(t => statuses.Contains(t.Status));

        var phases = WorkflowTaskListQueryRules.ResolvePhases(query.Phase).ToList();
        if (phases.Count > 0)
            rows = rows.Where(t => phases.Contains(t.Phase));

        var assigneeId = WorkflowTaskListQueryRules.NormalizeExact(query.AssigneeId);
        if (assigneeId is not null)
            rows = rows.Where(t => t.AssigneeId == assigneeId);

        var assigneeRole = WorkflowTaskListQueryRules.NormalizeExact(query.AssigneeRole);
        if (assigneeRole is not null)
        {
            var lowered = assigneeRole.ToLowerInvariant();
            rows = rows.Where(t => t.AssigneeRole.ToLower() == lowered);
        }

        var poNumber = WorkflowTaskListQueryRules.NormalizeExact(query.PoNumber);
        if (poNumber is not null)
            rows = rows.Where(t => t.PoNumber == poNumber);

        var assignmentType = WorkflowTaskListQueryRules.NormalizeExact(query.AssignmentType);
        if (assignmentType is not null)
            rows = rows.Where(t => t.AssignmentType == assignmentType);

        var search = WorkflowTaskListQueryRules.NormalizeSearch(query.Q);
        if (search is not null)
        {
            rows = rows.Where(t =>
                t.PoNumber.Contains(search)
                || t.Title.Contains(search)
                || t.AssigneeName.Contains(search)
                || (t.AssignmentType != null && t.AssignmentType.Contains(search))
                || _caseStudy.WorkOrderProperties.Any(p =>
                    p.Id == t.PropertyId
                    && (p.DeedNumber.Contains(search)
                        || p.City.Contains(search)
                        || p.District.Contains(search)
                        || p.PropertyType.Contains(search)
                        || p.Classification.Contains(search))));
        }

        return SortTasks(rows, query);
    }

 /// <summary>
 /// Allow-listed sort key plus the queue tiebreakers (PO, then property slot) so pages are stable.
 /// The two PO-derived keys read the work order the task belongs to, which lives in the same
 /// context, so the ordering still happens in the database.
 /// </summary>
    private IQueryable<WorkflowTask> SortTasks(
        IQueryable<WorkflowTask> rows,
        WorkflowTaskListQuery query)
    {
        var descending = WorkflowTaskListQueryRules.ResolveDescending(query.Dir);
        var ordered = WorkflowTaskListQueryRules.ResolveSort(query.Sort) switch
        {
            WorkflowTaskListSortKey.Updated => descending
                ? rows.OrderByDescending(t => t.UpdatedAtUtc)
                : rows.OrderBy(t => t.UpdatedAtUtc),
            WorkflowTaskListSortKey.PoNumber => descending
                ? rows.OrderByDescending(t => t.PoNumber)
                : rows.OrderBy(t => t.PoNumber),
            WorkflowTaskListSortKey.PoReceived => descending
                ? rows.OrderByDescending(t => _caseStudy.WorkOrders
                    .Where(w => w.PoNumber == t.PoNumber)
                    .Select(w => (DateOnly?)w.ReceivedFromEnfathAt)
                    .FirstOrDefault())
                : rows.OrderBy(t => _caseStudy.WorkOrders
                    .Where(w => w.PoNumber == t.PoNumber)
                    .Select(w => (DateOnly?)w.ReceivedFromEnfathAt)
                    .FirstOrDefault()),
            WorkflowTaskListSortKey.PoCreated => descending
                ? rows.OrderByDescending(t => _caseStudy.WorkOrders
                    .Where(w => w.PoNumber == t.PoNumber)
                    .Select(w => (DateTime?)w.CreatedAtUtc)
                    .FirstOrDefault())
                : rows.OrderBy(t => _caseStudy.WorkOrders
                    .Where(w => w.PoNumber == t.PoNumber)
                    .Select(w => (DateTime?)w.CreatedAtUtc)
                    .FirstOrDefault()),
            WorkflowTaskListSortKey.Deed => descending
                ? rows.OrderByDescending(t => _caseStudy.WorkOrderProperties
                    .Where(p => p.Id == t.PropertyId)
                    .Select(p => p.DeedNumber)
                    .FirstOrDefault())
                : rows.OrderBy(t => _caseStudy.WorkOrderProperties
                    .Where(p => p.Id == t.PropertyId)
                    .Select(p => p.DeedNumber)
                    .FirstOrDefault()),
            WorkflowTaskListSortKey.City => descending
                ? rows.OrderByDescending(t => _caseStudy.WorkOrderProperties
                    .Where(p => p.Id == t.PropertyId)
                    .Select(p => p.City)
                    .FirstOrDefault())
                : rows.OrderBy(t => _caseStudy.WorkOrderProperties
                    .Where(p => p.Id == t.PropertyId)
                    .Select(p => p.City)
                    .FirstOrDefault()),
            _ => descending
                ? rows.OrderByDescending(t => t.CreatedAtUtc)
                : rows.OrderBy(t => t.CreatedAtUtc),
        };

        return ordered
            .ThenBy(t => t.PoNumber)
            .ThenBy(t => t.PropertyOrdinal)
            .ThenBy(t => t.Id);
    }

 /// <summary>
 /// Pages, then reads the row plus the PO-record columns of its property in one round trip. The
 /// property lives in the same case_study schema, so the join stays in SQL and the queue no longer
 /// needs the PO-intake fetch to render deed / city / district / type / classification.
 /// </summary>
    private async Task<List<WorkflowTaskDto>> MaterializeAsync(
        IQueryable<WorkflowTask> rows,
        int? skip,
        int take,
        CancellationToken cancellationToken)
    {
        if (skip is > 0)
            rows = rows.Skip(skip.Value);
        if (take > 0)
            rows = rows.Take(take);

        var projected = await rows
            .Select(t => new
            {
                Task = t,
                Property = _caseStudy.WorkOrderProperties
                    .Where(p => p.Id == t.PropertyId)
                    .Select(p => new
                    {
                        p.DeedNumber,
                        p.City,
                        p.District,
                        p.PropertyType,
                        p.Classification,
                    })
                    .FirstOrDefault(),
                ParentDistributionJson = t.ParentTaskId == null
                    ? null
                    : _caseStudy.WorkflowTasks
                        .Where(p => p.Id == t.ParentTaskId)
                        .Select(p => p.DistributionJson)
                        .FirstOrDefault(),
            })
            .ToListAsync(cancellationToken);

        return projected
            .Select(row =>
            {
                var dto = WorkflowTaskMapper.ToDto(row.Task);
                dto.Distribution = WorkflowTaskDistributionRules.CoalesceDistribution(
                    dto.Distribution,
                    WorkflowTaskMapper.DeserializeDistribution(row.ParentDistributionJson));
                if (row.Property is null) return dto;
                dto.DeedNumber = row.Property.DeedNumber;
                dto.City = row.Property.City;
                dto.District = row.Property.District;
                dto.PropertyType = row.Property.PropertyType;
                dto.Classification = row.Property.Classification;
                return dto;
            })
            .ToList();
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
 /// property-appraisal DTOs with completed + specialist-accepted plus sibling
 /// engineering-survey completed. Populated so EO/appraiser unlock and the
 /// parties rail work without seeing the sibling task rows (party visibility
 /// hides them). Queries are scoped to parent+property pairs present in the
 /// page (no full-table scan).
 /// </summary>
    internal async Task EnrichFailureBlockedAsync(
        IReadOnlyList<WorkflowTaskDto> dtos,
        CancellationToken cancellationToken)
    {
        if (_failureLookup is null) return;
        var withProperty = dtos.Where(d => !string.IsNullOrWhiteSpace(d.PropertyId)).ToList();
        if (withProperty.Count == 0) return;

        var blocking = (await _failureLookup.ListBlockingPropertyKeysAsync(cancellationToken))
            .ToHashSet(StringComparer.Ordinal);
        foreach (var dto in withProperty)
        {
            dto.PropertyFailureBlocked = blocking.Contains(
                $"{dto.PoNumber.Trim()}|{dto.PropertyId!.Trim()}");
        }
    }

    /// <summary>
    /// Family key for sibling inspection facts. Party rows use their parent id;
    /// the case-study task is that parent, so its own id is the key.
    /// </summary>
    private static string? FamilyParentId(WorkflowTaskDto dto) =>
        dto.Kind == WorkflowTaskKindValues.CaseStudyProperty ? dto.Id : dto.ParentTaskId;

    internal async Task EnrichSiblingPartyFlagsAsync(
        IReadOnlyList<WorkflowTaskDto> dtos,
        CancellationToken cancellationToken)
    {
        // Case-study parents need the same mirror: the specialist's parties rail
        // reads that row, and a completed inspection child can be off the loaded page.
        var targets = dtos
            .Where(d =>
                !string.IsNullOrWhiteSpace(d.PropertyId)
                && !string.IsNullOrWhiteSpace(FamilyParentId(d))
                && (d.Kind == WorkflowTaskKindValues.EngineeringSurvey
                    || d.Kind == WorkflowTaskKindValues.PropertyAppraisal
                    || d.Kind == WorkflowTaskKindValues.CaseStudyProperty))
            .ToList();
        if (targets.Count == 0) return;

        var parentIds = new HashSet<Guid>();
        var propertyIds = new HashSet<Guid>();
        foreach (var target in targets)
        {
            if (Guid.TryParse(FamilyParentId(target), out var parentId))
                parentIds.Add(parentId);
            if (Guid.TryParse(target.PropertyId, out var propertyId))
                propertyIds.Add(propertyId);
        }

        if (parentIds.Count == 0 || propertyIds.Count == 0) return;

        // Every non-cancelled inspection: the appraiser reads the inspector's package from its
        // draft on (batch 2C), so its task id must be known before the inspection completes. The
        // completed / accepted flags keep their meaning — they are computed from the completed rows only.
        var allInspectionRows = await _caseStudy.WorkflowTasks.AsNoTracking()
            .Where(t =>
                t.Kind == WorkflowTaskKind.FieldInspection
                && t.Status != WorkflowTaskStatus.Cancelled
                && t.ParentTaskId != null
                && parentIds.Contains(t.ParentTaskId.Value)
                && t.PropertyId != null
                && propertyIds.Contains(t.PropertyId.Value))
            .Select(t => new
            {
                t.Id,
                t.Status,
                t.CreatedAtUtc,
                ParentId = t.ParentTaskId!.Value,
                PropertyId = t.PropertyId!.Value,
            })
            .ToListAsync(cancellationToken);

        var inspectionRows = allInspectionRows
            .Where(r => r.Status == WorkflowTaskStatus.Completed)
            .ToList();

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

        // Completed-only choice (survey office, specialist parent): accepted first, else any completed.
        var preferredIdByKey = inspectionRows
            .GroupBy(k => (Parent: k.ParentId.ToString(), Prop: k.PropertyId.ToString()))
            .ToDictionary(
                g => g.Key,
                g =>
                {
                    var preferred = g.FirstOrDefault(r => acceptedInspectionIds.Contains(r.Id))
                        ?? g.First();
                    return preferred.Id.ToString();
                });

        // Appraiser choice: accepted, then completed, then the latest non-cancelled (draft / reopened /
        // submitted-not-yet-completed) inspection.
        var appraiserPreferredIdByKey = allInspectionRows
            .GroupBy(k => (Parent: k.ParentId.ToString(), Prop: k.PropertyId.ToString()))
            .ToDictionary(
                g => g.Key,
                g =>
                {
                    var preferred = g.FirstOrDefault(r => acceptedInspectionIds.Contains(r.Id))
                        ?? g.Where(r => r.Status == WorkflowTaskStatus.Completed)
                            .OrderByDescending(r => r.CreatedAtUtc)
                            .FirstOrDefault()
                        ?? g.OrderByDescending(r => r.CreatedAtUtc).First();
                    return preferred.Id.ToString();
                });

        // Survey rows are hidden from the appraiser, and the specialist rail reads
        // the case-study parent. Mirror assignment and completion onto both.
        var familyParentIds = targets
            .Select(t => Guid.TryParse(FamilyParentId(t), out var id) ? id : Guid.Empty)
            .Where(id => id != Guid.Empty)
            .ToHashSet();

        var surveyAssigned = new HashSet<(string Parent, string Prop)>();
        var surveyCompleted = new HashSet<(string Parent, string Prop)>();
        if (familyParentIds.Count > 0)
        {
            var surveyRows = await _caseStudy.WorkflowTasks.AsNoTracking()
                .Where(t =>
                    t.Kind == WorkflowTaskKind.EngineeringSurvey
                    && t.Status != WorkflowTaskStatus.Cancelled
                    && t.ParentTaskId != null
                    && familyParentIds.Contains(t.ParentTaskId.Value)
                    && t.PropertyId != null
                    && propertyIds.Contains(t.PropertyId.Value))
                .Select(t => new
                {
                    ParentId = t.ParentTaskId!.Value,
                    PropertyId = t.PropertyId!.Value,
                    t.Status,
                })
                .ToListAsync(cancellationToken);

            foreach (var row in surveyRows)
            {
                var key = (Parent: row.ParentId.ToString(), Prop: row.PropertyId.ToString());
                surveyAssigned.Add(key);
                if (row.Status == WorkflowTaskStatus.Completed)
                    surveyCompleted.Add(key);
            }
        }

        // The appraiser's submission opens when the specialist issues the parent's case-study
        // report: ONE query over the parent ids already built above (appraisal rows and the parents).
        var issuedParentIds = (await _caseStudy.CaseStudyReports.AsNoTracking()
                .Where(r => parentIds.Contains(r.TaskId)
                    && !r.IsPartyContribution
                    && r.Status == CaseStudyReportStatuses.Issued)
                .Select(r => r.TaskId)
                .ToListAsync(cancellationToken))
            .Select(id => id.ToString())
            .ToHashSet(StringComparer.Ordinal);

        // The appraiser's package status (draft / submitted / reopened) per family property: the latest
        // non-cancelled appraisal task's submission — two queries, no payload read.
        var appraisalPackageByKey = new Dictionary<(string Parent, string Prop), string>();
        if (targets.Any(t => t.Kind is WorkflowTaskKindValues.PropertyAppraisal
                or WorkflowTaskKindValues.CaseStudyProperty))
        {
            var appraisalRows = await _caseStudy.WorkflowTasks.AsNoTracking()
                .Where(t =>
                    t.Kind == WorkflowTaskKind.PropertyAppraisal
                    && t.Status != WorkflowTaskStatus.Cancelled
                    && t.ParentTaskId != null
                    && parentIds.Contains(t.ParentTaskId.Value)
                    && t.PropertyId != null
                    && propertyIds.Contains(t.PropertyId.Value))
                .Select(t => new
                {
                    t.Id,
                    t.CreatedAtUtc,
                    ParentId = t.ParentTaskId!.Value,
                    PropertyId = t.PropertyId!.Value,
                })
                .ToListAsync(cancellationToken);
            var latestAppraisalByKey = appraisalRows
                .GroupBy(r => (Parent: r.ParentId.ToString(), Prop: r.PropertyId.ToString()))
                .ToDictionary(g => g.Key, g => g.OrderByDescending(r => r.CreatedAtUtc).First().Id);
            var appraisalIds = latestAppraisalByKey.Values.ToList();
            if (appraisalIds.Count > 0)
            {
                var statusByTask = await _caseStudy.PartyTaskSubmissions.AsNoTracking()
                    .Where(s => appraisalIds.Contains(s.WorkflowTaskId))
                    .Select(s => new { s.WorkflowTaskId, s.Status })
                    .ToDictionaryAsync(s => s.WorkflowTaskId, s => s.Status, cancellationToken);
                foreach (var (appraisalKey, appraisalId) in latestAppraisalByKey)
                {
                    if (statusByTask.TryGetValue(appraisalId, out var packageStatus))
                        appraisalPackageByKey[appraisalKey] = packageStatus;
                }
            }
        }

        foreach (var target in targets)
        {
            var key = (FamilyParentId(target)!, target.PropertyId!);
            if (target.Kind is WorkflowTaskKindValues.PropertyAppraisal
                or WorkflowTaskKindValues.CaseStudyProperty)
            {
                target.StudyReportIssued = issuedParentIds.Contains(key.Item1);
                if (appraisalPackageByKey.TryGetValue(key, out var appraisalPackage))
                    target.AppraisalPackageStatus = appraisalPackage;
            }
            target.FieldInspectionCompleted = completed.Contains(key);
            var preferredForTarget = target.Kind == WorkflowTaskKindValues.PropertyAppraisal
                ? appraiserPreferredIdByKey
                : preferredIdByKey;
            if (preferredForTarget.TryGetValue(key, out var inspectionTaskId))
                target.FieldInspectionTaskId = inspectionTaskId;
            if (target.Kind == WorkflowTaskKindValues.PropertyAppraisal)
                target.FieldInspectionAccepted = accepted.Contains(key);
            if (target.Kind is WorkflowTaskKindValues.PropertyAppraisal
                or WorkflowTaskKindValues.CaseStudyProperty)
            {
                target.EngineeringSurveyAssigned = surveyAssigned.Contains(key);
                target.EngineeringSurveyCompleted = surveyCompleted.Contains(key);
            }
        }
    }
}

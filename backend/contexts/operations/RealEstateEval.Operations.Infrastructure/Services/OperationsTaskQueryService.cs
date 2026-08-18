using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Infrastructure.Services;

public sealed class OperationsTaskQueryService : IOperationsTaskQuery
{
    private const int MaxListRows = 500;

    private readonly OperationsDbContext _ops;
    private readonly ICourtVisitFeeChargeService _charges;
    private readonly IUserLabelLookup _labels;

    public OperationsTaskQueryService(
        OperationsDbContext ops,
        FinancialDbContext financial,
        IdentityDbContext db,
        IUserLabelLookup? labels = null)
        : this(ops, new CourtVisitFeeChargeService(financial), labels ?? new UserLabelLookup(db))
    {
    }

    [ActivatorUtilitiesConstructor]
    public OperationsTaskQueryService(
        OperationsDbContext ops,
        ICourtVisitFeeChargeService charges,
        IUserLabelLookup labels)
    {
        _ops = ops;
        _charges = charges;
        _labels = labels;
    }

    public async Task<IReadOnlyList<OperationsTaskDto>> ListAsync(
        string? assigneeId,
        string? createdBy,
        string? status,
        string actorUserId,
        string? actorAssigneeId,
        string actorRole,
        CancellationToken cancellationToken = default)
    {
        var query = _ops.OperationsTasks.AsNoTracking();

        var assignee = assigneeId?.Trim();
        if (!string.IsNullOrEmpty(assignee))
            query = query.Where(t => t.AssigneeId == assignee);

        var creator = createdBy?.Trim();
        if (!string.IsNullOrEmpty(creator))
            query = query.Where(t => t.CreatedBy == creator);

 // An unrecognised status filter matches nothing rather than being ignored.
        if (!string.IsNullOrWhiteSpace(status))
        {
            if (!OperationsTaskStatusValues.TryParse(status, out var statusFilter))
                return [];
            query = query.Where(t => t.Status == statusFilter);
        }

        if (!OperationsTaskLifecycleRules.IsManager(actorRole))
        {
 // Executor queue is independent: only tasks assigned to the actor
 // (or rare cases they themselves created). Do not pull other
 // assignees' tasks that merely share a PO.
            var userId = actorUserId.Trim();
            var myAssignee = actorAssigneeId?.Trim() ?? "";
            query = query.Where(t =>
                (myAssignee.Length > 0 && t.AssigneeId == myAssignee)
                || (userId.Length > 0 && t.CreatedBy == userId));
        }

        var rows = await query
            .OrderByDescending(t => t.CreatedAtUtc)
            .Take(MaxListRows)
            .ToListAsync(cancellationToken);

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



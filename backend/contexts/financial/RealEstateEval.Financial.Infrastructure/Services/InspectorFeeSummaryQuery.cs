using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Financial.Application.Abstractions;
using RealEstateEval.Financial.Infrastructure.Data.Contexts;
using RealEstateEval.Financial.Domain;
using RealEstateEval.Financial.Application.Rules;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.Financial.Infrastructure.Services;

public sealed class InspectorFeeSummaryQuery : IInspectorFeeSummaryQuery
{
    private const int MaxSummaryRows = 2000;

    private readonly FinancialDbContext _financial;
    private readonly ICaseStudyLookup _lookup;
    private readonly IIdentityDirectory _identity;
    private readonly IInspectorFeeLedgerWriter _writer;
    private readonly TimeProvider _time;

    [ActivatorUtilitiesConstructor]
    public InspectorFeeSummaryQuery(
        FinancialDbContext financial,
        ICaseStudyLookup lookup,
        IIdentityDirectory identity,
        IInspectorFeeLedgerWriter writer,
        TimeProvider? time = null)
    {
        _time = time ?? TimeProvider.System;

        _financial = financial;
        _lookup = lookup;
        _identity = identity;
        _writer = writer;
    }


    public async Task<InspectorFeesSummaryDto> GetSummaryAsync(
        string? assigneeId,
        string? workflowTaskId,
        bool submittedOnly,
        string? taskKind = null,
        string? billingStatus = null,
        string? returnTo = null,
        bool hideDisputed = false,
        CancellationToken cancellationToken = default,
        string? supervisingDepartment = null)
    {
        await _writer.BackfillMissingLedgersAsync(cancellationToken);
        await SyncLedgerSnapshotsFromTasksAsync(cancellationToken);

        var query = _financial.InspectorFeeLedgers.AsNoTracking();

 // Applied to the query itself, before any row cap or projection, so a disputed line cannot
 // reach finance through the list, the totals, or the queue counts derived from them.
        if (hideDisputed)
        {
            query = query.Where(x =>
                x.BillingStatus != InspectorFeeBillingStatus.Disputed);
        }

 // A non-null supervisingDepartment means the caller is department-scoped. Fail closed when
 // the value is missing/unknown (e.g. Unassigned) so a supervisor without a department sees
 // nothing rather than every queue.
        if (supervisingDepartment is not null)
        {
            var normalizedDepartment = SupervisingDepartments.NormalizeProfileValue(supervisingDepartment);
            query = normalizedDepartment is null
                ? query.Where(_ => false)
                : query.Where(x => x.SupervisingDepartment == normalizedDepartment);
        }

        if (!string.IsNullOrWhiteSpace(workflowTaskId) &&
            Guid.TryParse(workflowTaskId.Trim(), out var taskGuid))
        {
            query = query.Where(x => x.WorkflowTaskId == taskGuid);
        }
        else if (!string.IsNullOrWhiteSpace(assigneeId))
        {
            var aid = assigneeId.Trim();
            query = query.Where(x => x.AssigneeId == aid);
        }

        if (!string.IsNullOrWhiteSpace(billingStatus))
        {
            var status = billingStatus.Trim();
            query = query.Where(x => x.BillingStatus == status);
        }

        if (!string.IsNullOrWhiteSpace(returnTo))
        {
            var target = returnTo.Trim();
            query = query.Where(x => x.ReturnTo == target);
        }

        var ledgers = await query
            .OrderByDescending(x => x.CreatedAtUtc)
            .Take(MaxSummaryRows)
            .ToListAsync(cancellationToken);
        if (ledgers.Count == 0) return InspectorFeeRowMapper.EmptySummary();

        ledgers = await FilterLedgersWithCompletedCaseStudyAsync(ledgers, cancellationToken);
        if (ledgers.Count == 0) return InspectorFeeRowMapper.EmptySummary();

        var taskIds = ledgers.Select(x => x.WorkflowTaskId).ToList();
        var taskSnapshots = await _lookup.ListWorkflowTasksByIdsAsync(taskIds, cancellationToken);
        var tasks = taskSnapshots.ToDictionary(t => t.Id, t => t.ToWorkflowTask());

 // An unrecognised filter value must match nothing rather than everything.
        if (!string.IsNullOrWhiteSpace(taskKind))
        {
            var kindMatched = WorkflowTaskKindValues.TryParse(taskKind, out var kind);
            ledgers = kindMatched
                ? ledgers
                    .Where(l => tasks.TryGetValue(l.WorkflowTaskId, out var t) && t.Kind == kind)
                    .ToList()
                : [];
            if (ledgers.Count == 0) return InspectorFeeRowMapper.EmptySummary();
            taskIds = ledgers.Select(x => x.WorkflowTaskId).ToList();
        }

        var workspaceRows = await _lookup.ListFieldInspectionWorkspacesByTaskIdsAsync(
            taskIds, cancellationToken);
        var workspaces = workspaceRows.ToDictionary(w => w.WorkflowTaskId, w => w.ToWorkspace());

        var submissionRows = await _lookup.ListPartyTaskSubmissionsByTaskIdsAsync(
            taskIds, cancellationToken);
        var submissions = submissionRows.ToDictionary(s => s.WorkflowTaskId, s => s.ToSubmission());

        var propertyLabels = await BuildPropertyLabelsAsync(ledgers, cancellationToken);

        var transitions = await _financial.InspectorFeeTransitions.AsNoTracking()
            .Where(t => taskIds.Contains(t.WorkflowTaskId))
            .OrderByDescending(t => t.CreatedAtUtc)
            .ToListAsync(cancellationToken);
        var lastReasonByTask = transitions
            .GroupBy(t => t.WorkflowTaskId)
            .ToDictionary(g => g.Key, g => g.First().Reason);

        var poNumbers = ledgers.Select(l => l.PoNumber.Trim()).Distinct().ToList();
        var poReceivedByNumber = await _lookup.GetWorkOrderReceivedAtByPoNumbersAsync(
            poNumbers, cancellationToken);

        var rows = new List<InspectorFeeRowDto>();
        foreach (var ledger in ledgers
            .OrderByDescending(x => x.CreatedAtUtc)
            .ThenByDescending(x => x.UpdatedAtUtc)
            .ThenBy(x => x.PoNumber, StringComparer.Ordinal))
        {
            if (submittedOnly && !InspectorFeeWorkStatusRules.IsWorkSubmitted(
                    ledger.WorkflowTaskId, tasks, workspaces, submissions))
                continue;

            if (!tasks.TryGetValue(ledger.WorkflowTaskId, out var task))
                continue;

            poReceivedByNumber.TryGetValue(ledger.PoNumber.Trim(), out var poReceived);
            lastReasonByTask.TryGetValue(ledger.WorkflowTaskId, out var lastReason);

            rows.Add(InspectorFeeRowMapper.ToRowDto(
                ledger,
                task,
                propertyLabels.GetValueOrDefault(ledger.WorkflowTaskId, "—"),
                InspectorFeeWorkStatusRules.IsWorkSubmitted(
                    ledger.WorkflowTaskId, tasks, workspaces, submissions),
                InspectorFeeWorkStatusRules.ResolveWorkSubmittedAtUtc(task, workspaces, submissions),
                poReceived,
                lastReason));
        }

        return InspectorFeeRowMapper.Summarize(rows);
    }

    public async Task<InspectorFeeRowDto?> GetByWorkflowTaskIdAsync(
        Guid workflowTaskId,
        CancellationToken cancellationToken = default)
    {
        await _writer.BackfillMissingLedgersAsync(cancellationToken);
        await SyncLedgerSnapshotsFromTasksAsync(cancellationToken);

        var ledger = await _financial.InspectorFeeLedgers.AsNoTracking()
            .FirstOrDefaultAsync(x => x.WorkflowTaskId == workflowTaskId, cancellationToken);
        if (ledger is null) return null;

        var visible = await FilterLedgersWithCompletedCaseStudyAsync([ledger], cancellationToken);
        if (visible.Count == 0) return null;

        var snapshot = await _lookup.GetWorkflowTaskAsync(workflowTaskId, cancellationToken);
        if (snapshot is null) return null;
        var task = snapshot.ToWorkflowTask();

        var workspaceRows = await _lookup.ListFieldInspectionWorkspacesByTaskIdsAsync(
            [workflowTaskId], cancellationToken);
        var workspaces = workspaceRows.ToDictionary(w => w.WorkflowTaskId, w => w.ToWorkspace());
        var submissionRows = await _lookup.ListPartyTaskSubmissionsByTaskIdsAsync(
            [workflowTaskId], cancellationToken);
        var submissions = submissionRows.ToDictionary(s => s.WorkflowTaskId, s => s.ToSubmission());

        var labels = await BuildPropertyLabelsAsync([ledger], cancellationToken);
        var workSubmitted = InspectorFeeWorkStatusRules.IsWorkSubmitted(
            workflowTaskId,
            new Dictionary<Guid, WorkflowTask> { [workflowTaskId] = task },
            workspaces,
            submissions);

        return InspectorFeeRowMapper.ToRowDto(
            ledger,
            task,
            labels.GetValueOrDefault(workflowTaskId, "—"),
            workSubmitted,
            InspectorFeeWorkStatusRules.ResolveWorkSubmittedAtUtc(task, workspaces, submissions),
            null,
            null);
    }

    public async Task<IReadOnlyList<InspectorFeeAuditEntryDto>> ListTransitionsAsync(
        Guid workflowTaskId,
        CancellationToken cancellationToken = default)
    {
        var transitions = await _financial.InspectorFeeTransitions.AsNoTracking()
            .Where(t => t.WorkflowTaskId == workflowTaskId)
            .OrderByDescending(t => t.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        if (transitions.Count == 0)
            return [];

        var actorIds = transitions
            .Select(t => t.ActorUserId)
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Distinct(StringComparer.Ordinal)
            .ToList();

        var actorNames = actorIds.Count == 0
            ? new Dictionary<string, string>(StringComparer.Ordinal)
            : await _identity.ResolveDisplayNamesByUserIdsAsync(actorIds, cancellationToken);

        return transitions.Select(t => new InspectorFeeAuditEntryDto
        {
            Id = t.Id.ToString(),
            FromStatus = t.FromStatus,
            FromStatusLabel = InspectorFeeBillingRules.StatusLabel(t.FromStatus),
            ToStatus = t.ToStatus,
            ToStatusLabel = InspectorFeeBillingRules.StatusLabel(t.ToStatus),
            Reason = t.Reason,
            ActorUserId = t.ActorUserId,
            ActorLabel = actorNames.GetValueOrDefault(t.ActorUserId),
            CreatedAtUtc = t.CreatedAtUtc,
        }).ToList();
    }

    private async Task SyncLedgerSnapshotsFromTasksAsync(CancellationToken cancellationToken)
    {
        var ledgers = await _financial.InspectorFeeLedgers.ToListAsync(cancellationToken);
        if (ledgers.Count == 0) return;

        var taskIds = ledgers.Select(l => l.WorkflowTaskId).Distinct().ToList();
        var taskSnapshots = await _lookup.ListWorkflowTasksByIdsAsync(taskIds, cancellationToken);
        var tasks = taskSnapshots.ToDictionary(t => t.Id, t => t.ToWorkflowTask());

        var anyChanged = false;
        var now = _time.UtcNow();
        foreach (var ledger in ledgers)
        {
            if (!tasks.TryGetValue(ledger.WorkflowTaskId, out var task))
                continue;

            var rowChanged = false;

            if (task.PropertyId is Guid propertyId && ledger.PropertyId != propertyId)
            {
                ledger.PropertyId = propertyId;
                rowChanged = true;
            }

            if (ledger.PropertyOrdinal != task.PropertyOrdinal)
            {
                ledger.PropertyOrdinal = task.PropertyOrdinal;
                rowChanged = true;
            }

            var taskAssignee = task.AssigneeId?.Trim();
            var ledgerAssignee = ledger.AssigneeId?.Trim();
            if (!string.Equals(taskAssignee, ledgerAssignee, StringComparison.Ordinal))
            {
                ledger.AssigneeId = string.IsNullOrEmpty(taskAssignee) ? null : taskAssignee;
                rowChanged = true;
            }

            if (!rowChanged) continue;

            ledger.UpdatedAtUtc = now;
            anyChanged = true;
        }

        if (anyChanged)
            await _financial.SaveChangesAsync(cancellationToken);
    }

    private async Task<List<InspectorFeeLedger>> FilterLedgersWithCompletedCaseStudyAsync(
        List<InspectorFeeLedger> ledgers,
        CancellationToken cancellationToken)
    {
        if (ledgers.Count == 0) return ledgers;

        var taskIds = ledgers.Select(l => l.WorkflowTaskId).Distinct().ToList();
        var kinds = await _lookup.GetWorkflowTaskKindsAsync(taskIds, cancellationToken);
        var engSurveyIds = kinds
            .Where(kv => kv.Value == WorkflowTaskKind.EngineeringSurvey)
            .Select(kv => kv.Key)
            .ToList();
        var engSet = engSurveyIds.ToHashSet();

 // Engineering-survey: visible after specialist acceptance (AccruedAtUtc).
 // Other party fees: still gated on completed case-study for the property.
        var nonEng = ledgers.Where(l => !engSet.Contains(l.WorkflowTaskId)).ToList();
        var engVisible = ledgers
            .Where(l => engSet.Contains(l.WorkflowTaskId) && l.AccruedAtUtc is not null)
            .ToList();

        if (nonEng.Count == 0) return engVisible;

        var readyPropertyIds = await GetCompletedCaseStudyPropertyIdsAsync(
            nonEng.Select(l => l.PropertyId),
            cancellationToken);
        var nonEngVisible = nonEng
            .Where(l => l.PropertyId is Guid pid && readyPropertyIds.Contains(pid))
            .ToList();

        return engVisible.Concat(nonEngVisible).ToList();
    }

    private async Task<HashSet<Guid>> GetCompletedCaseStudyPropertyIdsAsync(
        IEnumerable<Guid?> propertyIds,
        CancellationToken cancellationToken)
    {
        var ids = propertyIds
            .Where(id => id.HasValue)
            .Select(id => id!.Value)
            .Distinct()
            .ToList();
        if (ids.Count == 0) return [];

        var ready = await _lookup.ListCompletedCaseStudyPropertyIdsAsync(cancellationToken);
        return ready.Where(ids.Contains).ToHashSet();
    }

    private async Task<Dictionary<Guid, string>> BuildPropertyLabelsAsync(
        IReadOnlyList<InspectorFeeLedger> ledgers,
        CancellationToken cancellationToken)
    {
        var propertyIds = ledgers
            .Where(x => x.PropertyId.HasValue)
            .Select(x => x.PropertyId!.Value)
            .Distinct()
            .ToList();

        var snapshots = propertyIds.Count == 0
            ? []
            : await _lookup.ListPropertiesByIdsAsync(propertyIds, cancellationToken);
        var properties = snapshots.ToDictionary(p => p.Id);

        var result = new Dictionary<Guid, string>();
        foreach (var ledger in ledgers)
        {
            var slot = ledger.PropertyOrdinal > 0
                ? ledger.PropertyOrdinal.ToString()
                : "—";

            if (ledger.PropertyId.HasValue &&
                properties.TryGetValue(ledger.PropertyId.Value, out var property))
            {
                slot = string.IsNullOrWhiteSpace(property.RequestNumber)
                    ? slot
                    : property.RequestNumber.Trim();
                var district = property.District.Trim();
                result[ledger.WorkflowTaskId] = string.IsNullOrEmpty(district)
                    ? slot
                    : $"{slot} — {district}";
            }
            else
            {
                result[ledger.WorkflowTaskId] = slot;
            }
        }

        return result;
    }
}

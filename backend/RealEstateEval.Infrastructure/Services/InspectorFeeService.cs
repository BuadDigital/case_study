using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Infrastructure.Services;

public class InspectorFeeService : IInspectorFeeService
{
    private readonly ApplicationDbContext _db;

    public InspectorFeeService(ApplicationDbContext db) => _db = db;

    public async Task EnsureLedgersForTasksAsync(
        IEnumerable<WorkflowTask> tasks,
        CancellationToken cancellationToken = default)
    {
        var feeTasks = tasks
            .Where(t => t.Kind is "field-inspection" or "engineering-survey")
            .ToList();
        if (feeTasks.Count == 0) return;

        var taskIds = feeTasks.Select(t => t.Id).ToList();
        var existing = await _db.InspectorFeeLedgers
            .Where(x => taskIds.Contains(x.WorkflowTaskId))
            .Select(x => x.WorkflowTaskId)
            .ToListAsync(cancellationToken);
        var existingSet = existing.ToHashSet();

        var now = DateTime.UtcNow;
        foreach (var task in feeTasks)
        {
            if (existingSet.Contains(task.Id)) continue;

            var partyType = await ResolvePartyTypeAsync(task, cancellationToken);
            var agreedFee = task.Kind == "engineering-survey"
                ? EngineeringSurveyFeeRules.DefaultAgreedFee(partyType)
                : InspectorFeeRules.DefaultAgreedFee(partyType);

            _db.InspectorFeeLedgers.Add(new InspectorFeeLedger
            {
                WorkflowTaskId = task.Id,
                PoNumber = task.PoNumber.Trim(),
                PropertyId = task.PropertyId,
                PropertyOrdinal = task.PropertyOrdinal,
                AssigneeId = task.AssigneeId,
                InspectorType = partyType,
                AgreedFeeSar = agreedFee,
                SupervisorDiscountSar = 0m,
                DiscountReason = null,
                BillingStatus = InspectorFeeBillingStatus.PreBilling,
                CreatedAtUtc = now,
                UpdatedAtUtc = now,
            });
        }

        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task<InspectorFeesSummaryDto> GetSummaryAsync(
        string? assigneeId,
        string? workflowTaskId,
        bool submittedOnly,
        string? taskKind = null,
        CancellationToken cancellationToken = default)
    {
        await BackfillMissingLedgersAsync(cancellationToken);

        var query = _db.InspectorFeeLedgers.AsNoTracking();

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

        var ledgers = await query.ToListAsync(cancellationToken);
        if (ledgers.Count == 0)
        {
            return EmptySummary();
        }

        var taskIds = ledgers.Select(x => x.WorkflowTaskId).ToList();
        var tasks = await _db.WorkflowTasks.AsNoTracking()
            .Where(t => taskIds.Contains(t.Id))
            .ToDictionaryAsync(t => t.Id, cancellationToken);

        if (!string.IsNullOrWhiteSpace(taskKind))
        {
            var kind = taskKind.Trim();
            ledgers = ledgers
                .Where(l => tasks.TryGetValue(l.WorkflowTaskId, out var t) && t.Kind == kind)
                .ToList();
            if (ledgers.Count == 0) return EmptySummary();
            taskIds = ledgers.Select(x => x.WorkflowTaskId).ToList();
        }

        var workspaces = await _db.FieldInspectionWorkspaces.AsNoTracking()
            .Where(w => taskIds.Contains(w.WorkflowTaskId))
            .ToDictionaryAsync(w => w.WorkflowTaskId, cancellationToken);

        var submissions = await _db.PartyTaskSubmissions.AsNoTracking()
            .Where(s => taskIds.Contains(s.WorkflowTaskId))
            .ToDictionaryAsync(s => s.WorkflowTaskId, cancellationToken);

        var propertyLabels = await BuildPropertyLabelsAsync(ledgers, cancellationToken);

        var rows = new List<InspectorFeeRowDto>();
        foreach (var ledger in ledgers.OrderBy(x => x.PoNumber, StringComparer.Ordinal))
        {
            if (submittedOnly && !IsVisible(ledger, tasks, workspaces, submissions))
                continue;

            rows.Add(ToRowDto(ledger, propertyLabels.GetValueOrDefault(ledger.WorkflowTaskId, "—")));
        }

        return Summarize(rows);
    }

    public async Task<InspectorFeeRowDto?> GetByWorkflowTaskIdAsync(
        Guid workflowTaskId,
        CancellationToken cancellationToken = default)
    {
        await BackfillMissingLedgersAsync(cancellationToken);

        var ledger = await _db.InspectorFeeLedgers.AsNoTracking()
            .FirstOrDefaultAsync(x => x.WorkflowTaskId == workflowTaskId, cancellationToken);
        if (ledger is null) return null;

        var labels = await BuildPropertyLabelsAsync([ledger], cancellationToken);
        return ToRowDto(ledger, labels.GetValueOrDefault(ledger.WorkflowTaskId, "—"));
    }

    public async Task<InspectorFeeRowDto?> PatchAsync(
        Guid workflowTaskId,
        PatchInspectorFeeRequest request,
        CancellationToken cancellationToken = default)
    {
        var ledger = await _db.InspectorFeeLedgers
            .FirstOrDefaultAsync(x => x.WorkflowTaskId == workflowTaskId, cancellationToken);
        if (ledger is null) return null;

        if (request.AgreedFeeSar.HasValue)
            ledger.AgreedFeeSar = Math.Max(0m, request.AgreedFeeSar.Value);

        if (request.SupervisorDiscountSar.HasValue)
            ledger.SupervisorDiscountSar = Math.Max(0m, request.SupervisorDiscountSar.Value);

        if (request.DiscountReason is not null)
            ledger.DiscountReason = string.IsNullOrWhiteSpace(request.DiscountReason)
                ? null
                : request.DiscountReason.Trim();

        if (request.BillingStatus is not null)
        {
            var status = request.BillingStatus.Trim();
            if (status is InspectorFeeBillingStatus.PreBilling or InspectorFeeBillingStatus.Invoiced)
                ledger.BillingStatus = status;
        }

        if (ledger.SupervisorDiscountSar <= 0)
            ledger.DiscountReason = null;

        ledger.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);

        var labels = await BuildPropertyLabelsAsync([ledger], cancellationToken);
        return ToRowDto(ledger, labels.GetValueOrDefault(ledger.WorkflowTaskId, "—"));
    }

    public async Task DeleteForWorkflowTaskIdsAsync(
        IEnumerable<Guid> workflowTaskIds,
        CancellationToken cancellationToken = default)
    {
        var ids = workflowTaskIds.ToList();
        if (ids.Count == 0) return;

        await _db.InspectorFeeLedgers
            .Where(x => ids.Contains(x.WorkflowTaskId))
            .ExecuteDeleteAsync(cancellationToken);
    }

    private async Task BackfillMissingLedgersAsync(CancellationToken cancellationToken)
    {
        var feeTasks = await _db.WorkflowTasks.AsNoTracking()
            .Where(t => t.Kind == "field-inspection" || t.Kind == "engineering-survey")
            .ToListAsync(cancellationToken);
        if (feeTasks.Count == 0) return;

        var taskIds = feeTasks.Select(t => t.Id).ToList();
        var existing = await _db.InspectorFeeLedgers
            .Where(x => taskIds.Contains(x.WorkflowTaskId))
            .Select(x => x.WorkflowTaskId)
            .ToListAsync(cancellationToken);
        var missing = feeTasks
            .Where(t => !existing.Contains(t.Id))
            .ToList();
        if (missing.Count == 0) return;

        await EnsureLedgersForTasksAsync(missing, cancellationToken);
    }

    private static bool IsVisible(
        InspectorFeeLedger ledger,
        IReadOnlyDictionary<Guid, WorkflowTask> tasks,
        IReadOnlyDictionary<Guid, FieldInspectionWorkspace> workspaces,
        IReadOnlyDictionary<Guid, PartyTaskSubmission> submissions)
    {
        if (!tasks.TryGetValue(ledger.WorkflowTaskId, out var task))
            return false;

        if (task.Status == WorkflowTaskStatus.Completed)
            return true;

        if (task.Kind == "field-inspection" &&
            workspaces.TryGetValue(ledger.WorkflowTaskId, out var workspace) &&
            workspace.Status == PartyTaskSubmissionStatus.Submitted)
        {
            return true;
        }

        if (task.Kind == "engineering-survey" &&
            submissions.TryGetValue(ledger.WorkflowTaskId, out var submission) &&
            submission.Status == PartyTaskSubmissionStatus.Submitted)
        {
            return true;
        }

        return false;
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

        var properties = propertyIds.Count == 0
            ? []
            : await _db.WorkOrderProperties.AsNoTracking()
                .Where(p => propertyIds.Contains(p.Id))
                .ToDictionaryAsync(p => p.Id, cancellationToken);

        var result = new Dictionary<Guid, string>();
        foreach (var ledger in ledgers)
        {
            var slot = ledger.PropertyOrdinal > 0
                ? ledger.PropertyOrdinal.ToString()
                : "—";

            if (ledger.PropertyId.HasValue &&
                properties.TryGetValue(ledger.PropertyId.Value, out var property))
            {
                slot = string.IsNullOrWhiteSpace(property.TaskNumber)
                    ? slot
                    : property.TaskNumber.Trim();
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

    private static InspectorFeeRowDto ToRowDto(InspectorFeeLedger ledger, string propertyLabel)
    {
        var discount = Math.Max(0m, ledger.SupervisorDiscountSar);
        return new InspectorFeeRowDto
        {
            WorkflowTaskId = ledger.WorkflowTaskId.ToString(),
            PropertyLabel = propertyLabel,
            PoNumber = ledger.PoNumber,
            InspectorType = ledger.InspectorType,
            AgreedFeeSar = ledger.AgreedFeeSar,
            SupervisorDiscountSar = discount,
            DiscountReason = discount > 0
                ? (string.IsNullOrWhiteSpace(ledger.DiscountReason) ? "—" : ledger.DiscountReason)
                : null,
            NetFeeSar = InspectorFeeRules.NetFee(ledger.AgreedFeeSar, discount),
            BillingStatus = ledger.BillingStatus,
        };
    }

    private static InspectorFeesSummaryDto Summarize(IReadOnlyList<InspectorFeeRowDto> rows)
    {
        var netPreBilling = rows
            .Where(r => r.BillingStatus == InspectorFeeBillingStatus.PreBilling)
            .Sum(r => r.NetFeeSar);
        var totalDiscounts = rows.Sum(r => r.SupervisorDiscountSar);
        var invoiced = rows
            .Where(r => r.BillingStatus == InspectorFeeBillingStatus.Invoiced)
            .Sum(r => r.NetFeeSar);

        return new InspectorFeesSummaryDto
        {
            NetPreBillingSar = netPreBilling,
            TotalDiscountsSar = totalDiscounts,
            InvoicedSar = invoiced,
            Rows = rows,
        };
    }

    private async Task<string> ResolvePartyTypeAsync(
        WorkflowTask task,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(task.AssigneeId))
            return task.Kind == "engineering-survey" ? "موظف" : "موظف";

        var aid = task.AssigneeId.Trim();
        var profile = await _db.UserProfiles.AsNoTracking()
            .Include(p => p.HrEmployee)
            .FirstOrDefaultAsync(p => p.DistributionAssigneeId == aid, cancellationToken);

        if (profile is not null)
        {
            if (profile.ContractType == ContractType.Freelance)
                return "متعاون";
            if (profile.HrEmployee?.EmploymentType?.Contains("متعاون", StringComparison.Ordinal) == true)
                return "متعاون";
            return "موظف";
        }

        return task.Kind == "engineering-survey"
            ? EngineeringSurveyFeeRules.ResolveOfficeType(aid)
            : InspectorFeeRules.ResolveInspectorType(aid);
    }

    private static InspectorFeesSummaryDto EmptySummary() => new()
    {
        NetPreBillingSar = 0m,
        TotalDiscountsSar = 0m,
        InvoicedSar = 0m,
        Rows = [],
    };
}

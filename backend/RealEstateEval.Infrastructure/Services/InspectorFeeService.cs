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
                ExcludedFromBatch = false,
                ExclusionReason = null,
                InvoiceNumber = null,
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
        string? billingStatus = null,
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

        if (!string.IsNullOrWhiteSpace(billingStatus))
        {
            var status = billingStatus.Trim();
            query = query.Where(x => x.BillingStatus == status);
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

        if (!InspectorFeeBillingRules.IsEditableStatus(ledger.BillingStatus))
            return null;

        if (request.AgreedFeeSar.HasValue)
        {
            if (!string.Equals(ledger.InspectorType, "موظف", StringComparison.Ordinal))
                return null;
            ledger.AgreedFeeSar = Math.Max(0m, request.AgreedFeeSar.Value);
        }

        if (request.SupervisorDiscountSar.HasValue)
            ledger.SupervisorDiscountSar = Math.Max(0m, request.SupervisorDiscountSar.Value);

        if (request.DiscountReason is not null)
        {
            ledger.DiscountReason = string.IsNullOrWhiteSpace(request.DiscountReason)
                ? null
                : request.DiscountReason.Trim();
        }

        if (request.ExcludedFromBatch.HasValue)
        {
            ledger.ExcludedFromBatch = request.ExcludedFromBatch.Value;
            if (!ledger.ExcludedFromBatch)
                ledger.ExclusionReason = null;
        }

        if (request.ExclusionReason is not null)
            ledger.ExclusionReason = request.ExclusionReason.Trim();

        if (ledger.ExcludedFromBatch && string.IsNullOrWhiteSpace(ledger.ExclusionReason))
            return null;

        if (ledger.SupervisorDiscountSar <= 0)
            ledger.DiscountReason = null;

        if (!InspectorFeeBillingRules.ValidateDiscount(
                ledger.SupervisorDiscountSar,
                ledger.DiscountReason,
                out _))
        {
            return null;
        }

        ledger.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);

        var labels = await BuildPropertyLabelsAsync([ledger], cancellationToken);
        return ToRowDto(ledger, labels.GetValueOrDefault(ledger.WorkflowTaskId, "—"));
    }

    public async Task<(InspectorFeeRowDto? Row, string? Error)> TransitionAsync(
        Guid workflowTaskId,
        InspectorFeeTransitionRequest request,
        string actorUserId,
        CancellationToken cancellationToken = default)
    {
        var ledger = await _db.InspectorFeeLedgers
            .FirstOrDefaultAsync(x => x.WorkflowTaskId == workflowTaskId, cancellationToken);
        if (ledger is null)
            return (null, "سجل الأتعاب غير موجود.");

        var error = await ApplyTransitionAsync(ledger, request, actorUserId, cancellationToken);
        if (error is not null)
            return (null, error);

        await _db.SaveChangesAsync(cancellationToken);

        var labels = await BuildPropertyLabelsAsync([ledger], cancellationToken);
        return (ToRowDto(ledger, labels.GetValueOrDefault(ledger.WorkflowTaskId, "—")), null);
    }

    public async Task<BatchInspectorFeeTransitionResult> BatchTransitionAsync(
        BatchInspectorFeeTransitionRequest request,
        string actorUserId,
        CancellationToken cancellationToken = default)
    {
        var succeeded = new List<InspectorFeeRowDto>();
        var failed = new List<InspectorFeeTransitionErrorDto>();

        foreach (var rawId in request.WorkflowTaskIds)
        {
            if (!Guid.TryParse(rawId.Trim(), out var taskId))
            {
                failed.Add(new InspectorFeeTransitionErrorDto
                {
                    WorkflowTaskId = rawId,
                    Error = "معرّف مهمة غير صالح.",
                });
                continue;
            }

            var ledger = await _db.InspectorFeeLedgers
                .FirstOrDefaultAsync(x => x.WorkflowTaskId == taskId, cancellationToken);
            if (ledger is null)
            {
                failed.Add(new InspectorFeeTransitionErrorDto
                {
                    WorkflowTaskId = rawId,
                    Error = "سجل الأتعاب غير موجود.",
                });
                continue;
            }

            var error = await ApplyTransitionAsync(
                ledger,
                new InspectorFeeTransitionRequest
                {
                    Action = request.Action,
                    Reason = request.Reason,
                    InvoiceNumber = request.InvoiceNumber,
                },
                actorUserId,
                cancellationToken);

            if (error is not null)
            {
                failed.Add(new InspectorFeeTransitionErrorDto
                {
                    WorkflowTaskId = rawId,
                    Error = error,
                });
                continue;
            }

            var labels = await BuildPropertyLabelsAsync([ledger], cancellationToken);
            succeeded.Add(ToRowDto(ledger, labels.GetValueOrDefault(ledger.WorkflowTaskId, "—")));
        }

        if (succeeded.Count > 0)
            await _db.SaveChangesAsync(cancellationToken);

        return new BatchInspectorFeeTransitionResult
        {
            Succeeded = succeeded,
            Failed = failed,
        };
    }

    public async Task DeleteForWorkflowTaskIdsAsync(
        IEnumerable<Guid> workflowTaskIds,
        CancellationToken cancellationToken = default)
    {
        var ids = workflowTaskIds.ToList();
        if (ids.Count == 0) return;

        await _db.InspectorFeeTransitions
            .Where(x => ids.Contains(x.WorkflowTaskId))
            .ExecuteDeleteAsync(cancellationToken);

        await _db.InspectorFeeLedgers
            .Where(x => ids.Contains(x.WorkflowTaskId))
            .ExecuteDeleteAsync(cancellationToken);
    }

    private async Task<string?> ApplyTransitionAsync(
        InspectorFeeLedger ledger,
        InspectorFeeTransitionRequest request,
        string actorUserId,
        CancellationToken cancellationToken)
    {
        var action = request.Action.Trim().ToLowerInvariant();
        var fromStatus = ledger.BillingStatus;

        if (!InspectorFeeBillingRules.TryResolveTransition(
                fromStatus,
                action,
                out var nextStatus,
                out var transitionError))
        {
            return transitionError;
        }

        if (action == InspectorFeeActions.SubmitToFinance)
        {
            if (ledger.ExcludedFromBatch)
                return "لا يمكن إرسال عقار مستبعد من الفوترة.";

            if (!InspectorFeeBillingRules.ValidateDiscount(
                    ledger.SupervisorDiscountSar,
                    ledger.DiscountReason,
                    out var discountError))
            {
                return discountError;
            }

            if (!await IsLedgerWorkSubmittedAsync(ledger.WorkflowTaskId, cancellationToken))
                return "لا يمكن إرسال الأتعاب قبل إتمام عمل الطرف.";
        }

        if (action == InspectorFeeActions.Invoice)
        {
            if (string.IsNullOrWhiteSpace(request.InvoiceNumber))
                return "رقم الفاتورة مطلوب.";
            ledger.InvoiceNumber = request.InvoiceNumber.Trim();
        }

        if (action == InspectorFeeActions.Return)
        {
            if (string.IsNullOrWhiteSpace(request.Reason))
                return "سبب الإرجاع مطلوب.";
            ledger.InvoiceNumber = null;
        }

        if (action == InspectorFeeActions.RecordPayment && !string.IsNullOrWhiteSpace(request.Reason))
        {
            // optional payment note stored in transition reason only
        }

        ledger.BillingStatus = nextStatus;
        ledger.UpdatedAtUtc = DateTime.UtcNow;

        _db.InspectorFeeTransitions.Add(new InspectorFeeTransition
        {
            Id = Guid.NewGuid(),
            WorkflowTaskId = ledger.WorkflowTaskId,
            FromStatus = fromStatus,
            ToStatus = nextStatus,
            Reason = string.IsNullOrWhiteSpace(request.Reason) ? null : request.Reason.Trim(),
            ActorUserId = actorUserId,
            CreatedAtUtc = DateTime.UtcNow,
        });

        return null;
    }

    private async Task<bool> IsLedgerWorkSubmittedAsync(
        Guid workflowTaskId,
        CancellationToken cancellationToken)
    {
        var task = await _db.WorkflowTasks.AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == workflowTaskId, cancellationToken);
        if (task is null) return false;
        if (task.Status == WorkflowTaskStatus.Completed) return true;

        if (task.Kind == "field-inspection")
        {
            var workspace = await _db.FieldInspectionWorkspaces.AsNoTracking()
                .FirstOrDefaultAsync(w => w.WorkflowTaskId == workflowTaskId, cancellationToken);
            return workspace?.Status == PartyTaskSubmissionStatus.Submitted;
        }

        if (task.Kind == "engineering-survey")
        {
            var submission = await _db.PartyTaskSubmissions.AsNoTracking()
                .FirstOrDefaultAsync(s => s.WorkflowTaskId == workflowTaskId, cancellationToken);
            return submission?.Status == PartyTaskSubmissionStatus.Submitted;
        }

        return false;
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
            PropertyId = ledger.PropertyId?.ToString(),
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
            BillingStatusLabel = InspectorFeeBillingRules.StatusLabel(ledger.BillingStatus),
            ExcludedFromBatch = ledger.ExcludedFromBatch,
            ExclusionReason = ledger.ExclusionReason,
            InvoiceNumber = ledger.InvoiceNumber,
            IsEditable = InspectorFeeBillingRules.IsEditableStatus(ledger.BillingStatus),
        };
    }

    private static InspectorFeesSummaryDto Summarize(IReadOnlyList<InspectorFeeRowDto> rows)
    {
        decimal SumNet(Func<InspectorFeeRowDto, bool> predicate) =>
            rows.Where(predicate).Sum(r => r.NetFeeSar);

        return new InspectorFeesSummaryDto
        {
            NetPreBillingSar = SumNet(r =>
                r.BillingStatus is InspectorFeeBillingStatus.PreBilling
                    or InspectorFeeBillingStatus.Returned),
            ReadyForBillingSar = SumNet(r =>
                r.BillingStatus == InspectorFeeBillingStatus.ReadyForBilling),
            TotalDiscountsSar = rows.Sum(r => r.SupervisorDiscountSar),
            InvoicedSar = SumNet(r => r.BillingStatus == InspectorFeeBillingStatus.Invoiced),
            PaidSar = SumNet(r => r.BillingStatus == InspectorFeeBillingStatus.Paid),
            Rows = rows,
        };
    }

    private async Task<string> ResolvePartyTypeAsync(
        WorkflowTask task,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(task.AssigneeId))
            return "موظف";

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
        ReadyForBillingSar = 0m,
        TotalDiscountsSar = 0m,
        InvoicedSar = 0m,
        PaidSar = 0m,
        Rows = [],
    };
}

using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Notifications;

namespace RealEstateEval.Infrastructure.Services;

public class InspectorFeeService : IInspectorFeeService
{
    private readonly ApplicationDbContext _db;
    private readonly INotificationService _notifications;
    private readonly NotificationRecipientResolver _recipients;
    private readonly IPartyFeePricingService _pricing;

    public InspectorFeeService(
        ApplicationDbContext db,
        INotificationService notifications,
        NotificationRecipientResolver recipients,
        IPartyFeePricingService pricing)
    {
        _db = db;
        _notifications = notifications;
        _recipients = recipients;
        _pricing = pricing;
    }

    public async Task EnsureLedgersForTasksAsync(
        IEnumerable<WorkflowTask> tasks,
        CancellationToken cancellationToken = default)
    {
        var feeTasks = tasks
            .Where(t => t.Kind is "field-inspection" or "engineering-survey" or "government-review")
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
            var areaM2 = await ResolvePropertyAreaM2Async(task, cancellationToken);
            var agreedFee = await _pricing.ResolveDefaultFeeAsync(
                task.Kind,
                partyType,
                areaM2,
                cancellationToken) ?? 0m;

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
                BillingStatus = InspectorFeeBillingStatus.Draft,
                ExcludedFromBatch = false,
                ExclusionReason = null,
                ReturnTo = null,
                DisbursementBatchId = null,
                DisbursementVoucher = null,
                CreatedAtUtc = now,
                UpdatedAtUtc = now,
            });
        }

        await _db.SaveChangesAsync(cancellationToken);
        await StampDeferredEngineeringSurveyFeesAsync(cancellationToken);
    }

    public async Task EnsureLedgersForPropertyAsync(
        Guid propertyId,
        CancellationToken cancellationToken = default)
    {
        var feeTasks = await _db.WorkflowTasks.AsNoTracking()
            .Where(t =>
                t.PropertyId == propertyId
                && (t.Kind == "field-inspection"
                    || t.Kind == "engineering-survey"
                    || t.Kind == "government-review"))
            .ToListAsync(cancellationToken);
        if (feeTasks.Count == 0) return;

        await EnsureLedgersForTasksAsync(feeTasks, cancellationToken);
    }

    public async Task<InspectorFeesSummaryDto> GetSummaryAsync(
        string? assigneeId,
        string? workflowTaskId,
        bool submittedOnly,
        string? taskKind = null,
        string? billingStatus = null,
        string? returnTo = null,
        CancellationToken cancellationToken = default)
    {
        await BackfillMissingLedgersAsync(cancellationToken);
        await StampDeferredEngineeringSurveyFeesAsync(cancellationToken);
        await SyncLedgerSnapshotsFromTasksAsync(cancellationToken);

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

        if (!string.IsNullOrWhiteSpace(returnTo))
        {
            var target = returnTo.Trim();
            query = query.Where(x => x.ReturnTo == target);
        }

        var ledgers = await query.ToListAsync(cancellationToken);
        if (ledgers.Count == 0) return EmptySummary();

        ledgers = await FilterLedgersWithCompletedCaseStudyAsync(ledgers, cancellationToken);
        if (ledgers.Count == 0) return EmptySummary();

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

        var transitions = await _db.InspectorFeeTransitions.AsNoTracking()
            .Where(t => taskIds.Contains(t.WorkflowTaskId))
            .OrderByDescending(t => t.CreatedAtUtc)
            .ToListAsync(cancellationToken);
        var lastReasonByTask = transitions
            .GroupBy(t => t.WorkflowTaskId)
            .ToDictionary(g => g.Key, g => g.First().Reason);

        var poNumbers = ledgers.Select(l => l.PoNumber.Trim()).Distinct().ToList();
        var poReceivedByNumber = await _db.WorkOrders.AsNoTracking()
            .Where(w => poNumbers.Contains(w.PoNumber))
            .ToDictionaryAsync(
                w => w.PoNumber.Trim(),
                w => (DateTime?)w.ReceivedFromEnfathAt.ToDateTime(TimeOnly.MinValue),
                StringComparer.Ordinal,
                cancellationToken);

        var rows = new List<InspectorFeeRowDto>();
        foreach (var ledger in ledgers.OrderByDescending(x => x.CreatedAtUtc).ThenByDescending(x => x.UpdatedAtUtc).ThenBy(x => x.PoNumber, StringComparer.Ordinal))
        {
            if (submittedOnly && !IsWorkSubmitted(ledger.WorkflowTaskId, tasks, workspaces, submissions))
                continue;

            if (!tasks.TryGetValue(ledger.WorkflowTaskId, out var task))
                continue;

            poReceivedByNumber.TryGetValue(ledger.PoNumber.Trim(), out var poReceived);
            lastReasonByTask.TryGetValue(ledger.WorkflowTaskId, out var lastReason);

            rows.Add(ToRowDto(
                ledger,
                task,
                propertyLabels.GetValueOrDefault(ledger.WorkflowTaskId, "—"),
                IsWorkSubmitted(ledger.WorkflowTaskId, tasks, workspaces, submissions),
                ResolveWorkSubmittedAtUtc(task, workspaces, submissions),
                poReceived,
                lastReason));
        }

        return Summarize(rows);
    }

    public async Task<InspectorFeeRowDto?> GetByWorkflowTaskIdAsync(
        Guid workflowTaskId,
        CancellationToken cancellationToken = default)
    {
        await BackfillMissingLedgersAsync(cancellationToken);
        await StampDeferredEngineeringSurveyFeesAsync(cancellationToken);
        await SyncLedgerSnapshotsFromTasksAsync(cancellationToken);

        var ledger = await _db.InspectorFeeLedgers.AsNoTracking()
            .FirstOrDefaultAsync(x => x.WorkflowTaskId == workflowTaskId, cancellationToken);
        if (ledger is null) return null;

        var visible = await FilterLedgersWithCompletedCaseStudyAsync([ledger], cancellationToken);
        if (visible.Count == 0) return null;

        var task = await _db.WorkflowTasks.AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == workflowTaskId, cancellationToken);
        if (task is null) return null;

        var workspaces = await _db.FieldInspectionWorkspaces.AsNoTracking()
            .Where(w => w.WorkflowTaskId == workflowTaskId)
            .ToDictionaryAsync(w => w.WorkflowTaskId, cancellationToken);
        var submissions = await _db.PartyTaskSubmissions.AsNoTracking()
            .Where(s => s.WorkflowTaskId == workflowTaskId)
            .ToDictionaryAsync(s => s.WorkflowTaskId, cancellationToken);

        var labels = await BuildPropertyLabelsAsync([ledger], cancellationToken);
        var workSubmitted = IsWorkSubmitted(
            workflowTaskId,
            new Dictionary<Guid, WorkflowTask> { [workflowTaskId] = task },
            workspaces,
            submissions);

        return ToRowDto(
            ledger,
            task,
            labels.GetValueOrDefault(workflowTaskId, "—"),
            workSubmitted,
            ResolveWorkSubmittedAtUtc(task, workspaces, submissions),
            null,
            null);
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
            if (!InspectorFeeRules.IsEmployee(ledger.InspectorType))
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

        return await GetByWorkflowTaskIdAsync(workflowTaskId, cancellationToken);
    }

    public async Task<(InspectorFeeRowDto? Row, string? Error)> TransitionAsync(
        Guid workflowTaskId,
        InspectorFeeTransitionRequest request,
        string actorUserId,
        string? actorAssigneeId,
        bool isOperationsManager,
        bool isFinancialOfficer,
        CancellationToken cancellationToken = default)
    {
        var ledger = await _db.InspectorFeeLedgers
            .FirstOrDefaultAsync(x => x.WorkflowTaskId == workflowTaskId, cancellationToken);
        if (ledger is null)
            return (null, "سجل الأتعاب غير موجود.");

        var error = await ApplyTransitionAsync(
            ledger,
            request,
            actorUserId,
            actorAssigneeId,
            isOperationsManager,
            isFinancialOfficer,
            cancellationToken);
        if (error is not null)
            return (null, error);

        await _db.SaveChangesAsync(cancellationToken);
        var row = await GetByWorkflowTaskIdAsync(workflowTaskId, cancellationToken);
        return (row, null);
    }

    public async Task<BatchInspectorFeeTransitionResult> BatchTransitionAsync(
        BatchInspectorFeeTransitionRequest request,
        string actorUserId,
        string? actorAssigneeId,
        bool isOperationsManager,
        bool isFinancialOfficer,
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
                    DisbursementVoucher = request.DisbursementVoucher,
                },
                actorUserId,
                actorAssigneeId,
                isOperationsManager,
                isFinancialOfficer,
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

            var row = await GetByWorkflowTaskIdAsync(taskId, cancellationToken);
            if (row is not null) succeeded.Add(row);
        }

        if (succeeded.Count > 0)
            await _db.SaveChangesAsync(cancellationToken);

        if (string.Equals(request.Action.Trim(), InspectorFeeActions.Disburse, StringComparison.OrdinalIgnoreCase)
            && succeeded.Count > 0)
        {
            await NotifyPartiesFeesDisbursedAsync(succeeded, cancellationToken);
        }

        return new BatchInspectorFeeTransitionResult
        {
            Succeeded = succeeded,
            Failed = failed,
            DisbursementBatchId = request.DisbursementBatchId,
        };
    }

    public async Task<CreateDisbursementBatchResult> CreateDisbursementBatchAsync(
        CreateDisbursementBatchRequest request,
        string actorUserId,
        string? actorAssigneeId,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(actorAssigneeId))
        {
            return new CreateDisbursementBatchResult
            {
                Failed =
                [
                    new InspectorFeeTransitionErrorDto
                    {
                        WorkflowTaskId = "",
                        Error = "لا يمكن إنشاء أمر صرف بدون هوية الطرف.",
                    },
                ],
            };
        }

        var batchId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        var succeeded = new List<InspectorFeeRowDto>();
        var failed = new List<InspectorFeeTransitionErrorDto>();
        decimal total = 0m;

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
                    Action = InspectorFeeActions.CreateDisbursementRequest,
                },
                actorUserId,
                actorAssigneeId,
                isOperationsManager: false,
                isFinancialOfficer: false,
                cancellationToken,
                disbursementBatchId: batchId);

            if (error is not null)
            {
                failed.Add(new InspectorFeeTransitionErrorDto
                {
                    WorkflowTaskId = rawId,
                    Error = error,
                });
                continue;
            }

            total += InspectorFeeRules.NetFee(ledger.AgreedFeeSar, ledger.SupervisorDiscountSar);
            var row = await GetByWorkflowTaskIdAsync(taskId, cancellationToken);
            if (row is not null) succeeded.Add(row);
        }

        if (succeeded.Count == 0)
        {
            return new CreateDisbursementBatchResult { Failed = failed };
        }

        _db.DisbursementBatches.Add(new DisbursementBatch
        {
            Id = batchId,
            AssigneeId = actorAssigneeId.Trim(),
            CreatedByUserId = actorUserId,
            TotalNetSar = total,
            CreatedAtUtc = now,
        });

        await _db.SaveChangesAsync(cancellationToken);

        await NotifyFinanceDisbursementBatchCreatedAsync(succeeded.Count, cancellationToken);

        return new CreateDisbursementBatchResult
        {
            DisbursementBatchId = batchId.ToString(),
            Rows = succeeded,
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
        string? actorAssigneeId,
        bool isOperationsManager,
        bool isFinancialOfficer,
        CancellationToken cancellationToken,
        Guid? disbursementBatchId = null)
    {
        var action = request.Action.Trim().ToLowerInvariant();
        var fromStatus = ledger.BillingStatus;

        if (!CanPerformAction(action, ledger, actorAssigneeId, isOperationsManager, isFinancialOfficer))
            return "غير مصرّح بتنفيذ هذا الإجراء.";

        if (!InspectorFeeBillingRules.TryResolveTransition(
                fromStatus,
                action,
                out var nextStatus,
                out var nextReturnTo,
                out var transitionError))
        {
            return transitionError;
        }

        if (action == InspectorFeeActions.SubmitToSupervisor)
        {
            if (ledger.ExcludedFromBatch)
                return "لا يمكن رفع عقار مستبعد.";

            if (!InspectorFeeRules.HasBillableAgreedFee(ledger.AgreedFeeSar))
                return "يجب إدخال مبلغ الأتعاب المتفق عليه قبل الرفع.";

            if (!InspectorFeeBillingRules.ValidateDiscount(
                    ledger.SupervisorDiscountSar,
                    ledger.DiscountReason,
                    out var discountError))
            {
                return discountError;
            }

            if (!await IsLedgerWorkSubmittedAsync(ledger.WorkflowTaskId, cancellationToken))
                return "لا يمكن رفع الأتعاب قبل إتمام عمل الطرف.";

            if (fromStatus == InspectorFeeBillingStatus.Returned
                && ledger.ReturnTo != InspectorFeeReturnTo.Office)
            {
                return "هذه المعاملة ليست مُعادة للمكتب.";
            }

            if (fromStatus == InspectorFeeBillingStatus.Inquiry
                && ledger.ReturnTo != InspectorFeeReturnTo.Office)
            {
                return "هذا الاستفسار لا يخص المكتب.";
            }
        }

        if (action == InspectorFeeActions.ApproveToFinance)
        {
            if (ledger.ExcludedFromBatch)
                return "لا يمكن اعتماد عقار مستبعد.";

            if (!InspectorFeeRules.HasBillableAgreedFee(ledger.AgreedFeeSar))
                return "يجب إدخال مبلغ الأتعاب المتفق عليه قبل الاعتماد.";

            if (!InspectorFeeBillingRules.ValidateDiscount(
                    ledger.SupervisorDiscountSar,
                    ledger.DiscountReason,
                    out var discountError))
            {
                return discountError;
            }

            if (!await IsLedgerWorkSubmittedAsync(ledger.WorkflowTaskId, cancellationToken))
                return "لا يمكن اعتماد الأتعاب قبل إتمام عمل الطرف.";
        }

        if (action == InspectorFeeActions.ResendToFinance)
        {
            if (ledger.ReturnTo != InspectorFeeReturnTo.Supervisor)
                return "لا يمكن إعادة الإرسال إلا للمعاملات المُعادة للمشرف.";
        }

        if (action == InspectorFeeActions.ReturnToOffice)
        {
            if (ledger.ReturnTo != InspectorFeeReturnTo.Supervisor)
                return "لا يمكن إرجاع المعاملة للمكتب إلا من قائمة المُعاد للمشرف.";
        }

        if (action is InspectorFeeActions.ReturnToSupervisor or InspectorFeeActions.InquiryToOffice)
        {
            if (string.IsNullOrWhiteSpace(request.Reason))
                return action == InspectorFeeActions.InquiryToOffice
                    ? "سبب الاستفسار مطلوب."
                    : "سبب الإرجاع مطلوب.";

            if (action == InspectorFeeActions.ReturnToSupervisor && ledger.DisbursementBatchId.HasValue)
                ledger.DisbursementBatchId = null;
        }

        if (action == InspectorFeeActions.CreateDisbursementRequest)
        {
            if (ledger.ExcludedFromBatch)
                return "لا يمكن تضمين عقار مستبعد في أمر الصرف.";

            if (!string.Equals(ledger.AssigneeId?.Trim(), actorAssigneeId?.Trim(), StringComparison.Ordinal))
                return "لا يمكن تضمين أتعاب طرف آخر في أمر الصرف.";

            if (!disbursementBatchId.HasValue)
                return "معرّف أمر الصرف مطلوب.";

            ledger.DisbursementBatchId = disbursementBatchId;
        }

        if (action == InspectorFeeActions.Disburse)
        {
            var voucher = string.IsNullOrWhiteSpace(request.DisbursementVoucher)
                ? $"SND-{DateTime.UtcNow:yyyyMMddHHmmss}"
                : request.DisbursementVoucher.Trim();
            ledger.DisbursementVoucher = voucher;
        }

        ledger.BillingStatus = nextStatus;
        ledger.ReturnTo = nextReturnTo;
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

    private static bool CanPerformAction(
        string action,
        InspectorFeeLedger ledger,
        string? actorAssigneeId,
        bool isOperationsManager,
        bool isFinancialOfficer)
    {
        return action switch
        {
            InspectorFeeActions.SubmitToSupervisor or InspectorFeeActions.CreateDisbursementRequest =>
                !string.IsNullOrWhiteSpace(actorAssigneeId)
                && string.Equals(ledger.AssigneeId?.Trim(), actorAssigneeId.Trim(), StringComparison.Ordinal),

            InspectorFeeActions.ApproveToFinance
                or InspectorFeeActions.ResendToFinance
                or InspectorFeeActions.ReturnToOffice => isOperationsManager,

            InspectorFeeActions.Disburse
                or InspectorFeeActions.ReturnToSupervisor
                or InspectorFeeActions.InquiryToOffice => isFinancialOfficer,

            _ => false,
        };
    }

    private async Task<bool> IsLedgerWorkSubmittedAsync(
        Guid workflowTaskId,
        CancellationToken cancellationToken)
    {
        var task = await _db.WorkflowTasks.AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == workflowTaskId, cancellationToken);
        if (task is null) return false;

        var workspaces = await _db.FieldInspectionWorkspaces.AsNoTracking()
            .Where(w => w.WorkflowTaskId == workflowTaskId)
            .ToDictionaryAsync(w => w.WorkflowTaskId, cancellationToken);
        var submissions = await _db.PartyTaskSubmissions.AsNoTracking()
            .Where(s => s.WorkflowTaskId == workflowTaskId)
            .ToDictionaryAsync(s => s.WorkflowTaskId, cancellationToken);

        return IsWorkSubmitted(
            workflowTaskId,
            new Dictionary<Guid, WorkflowTask> { [workflowTaskId] = task },
            workspaces,
            submissions);
    }

    private async Task SyncLedgerSnapshotsFromTasksAsync(CancellationToken cancellationToken)
    {
        var ledgers = await _db.InspectorFeeLedgers.ToListAsync(cancellationToken);
        if (ledgers.Count == 0) return;

        var taskIds = ledgers.Select(l => l.WorkflowTaskId).Distinct().ToList();
        var tasks = await _db.WorkflowTasks.AsNoTracking()
            .Where(t => taskIds.Contains(t.Id))
            .ToDictionaryAsync(t => t.Id, cancellationToken);

        var anyChanged = false;
        var now = DateTime.UtcNow;
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
            await _db.SaveChangesAsync(cancellationToken);
    }

    private async Task BackfillMissingLedgersAsync(CancellationToken cancellationToken)
    {
        var feeTasks = await _db.WorkflowTasks.AsNoTracking()
            .Where(t =>
                t.Kind == "field-inspection"
                || t.Kind == "engineering-survey"
                || t.Kind == "government-review")
            .ToListAsync(cancellationToken);
        if (feeTasks.Count == 0) return;

        var readyPropertyIds = await GetCompletedCaseStudyPropertyIdsAsync(
            feeTasks.Select(t => t.PropertyId),
            cancellationToken);
        feeTasks = feeTasks
            .Where(t => t.PropertyId is Guid pid && readyPropertyIds.Contains(pid))
            .ToList();
        if (feeTasks.Count == 0) return;

        var taskIds = feeTasks.Select(t => t.Id).ToList();
        var existing = await _db.InspectorFeeLedgers
            .Where(x => taskIds.Contains(x.WorkflowTaskId))
            .Select(x => x.WorkflowTaskId)
            .ToListAsync(cancellationToken);
        var missing = feeTasks
            .Where(t => !existing.Contains(t.Id))
            .ToList();
        if (missing.Count == 0)
        {
            await StampDeferredEngineeringSurveyFeesAsync(cancellationToken);
            return;
        }

        await EnsureLedgersForTasksAsync(missing, cancellationToken);
    }

    /// <summary>
    /// Stamps engineering-survey ledgers that were created without area once area becomes available.
    /// Only updates draft ledgers still at AgreedFeeSar = 0.
    /// </summary>
    private async Task StampDeferredEngineeringSurveyFeesAsync(CancellationToken cancellationToken)
    {
        var pending = await _db.InspectorFeeLedgers
            .Where(x =>
                x.AgreedFeeSar <= 0m
                && x.BillingStatus == InspectorFeeBillingStatus.Draft)
            .ToListAsync(cancellationToken);
        if (pending.Count == 0) return;

        var taskIds = pending.Select(x => x.WorkflowTaskId).ToList();
        var surveyTasks = await _db.WorkflowTasks.AsNoTracking()
            .Where(t =>
                taskIds.Contains(t.Id)
                && t.Kind == "engineering-survey")
            .ToListAsync(cancellationToken);
        if (surveyTasks.Count == 0) return;

        var byTaskId = surveyTasks.ToDictionary(t => t.Id);
        var any = false;
        foreach (var ledger in pending)
        {
            if (!byTaskId.TryGetValue(ledger.WorkflowTaskId, out var task))
                continue;

            var areaM2 = await ResolvePropertyAreaM2Async(task, cancellationToken);
            if (areaM2 is not > 0m) continue;

            var fee = await _pricing.ResolveDefaultFeeAsync(
                task.Kind,
                ledger.InspectorType,
                areaM2,
                cancellationToken);
            if (fee is not > 0m) continue;

            ledger.AgreedFeeSar = fee.Value;
            ledger.UpdatedAtUtc = DateTime.UtcNow;
            any = true;
        }

        if (any)
            await _db.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// Decision 3: task property → sole property in PO → max area among PO properties.
    /// </summary>
    private async Task<decimal?> ResolvePropertyAreaM2Async(
        WorkflowTask task,
        CancellationToken cancellationToken)
    {
        if (task.PropertyId is Guid linkedId)
        {
            var linked = await _db.WorkOrderProperties.AsNoTracking()
                .Where(p => p.Id == linkedId)
                .Select(p => p.Area)
                .FirstOrDefaultAsync(cancellationToken);
            if (EngineeringSurveyFeeRules.TryParseAreaM2(linked, out var linkedArea))
                return linkedArea;
        }

        var po = task.PoNumber.Trim();
        if (string.IsNullOrEmpty(po)) return null;

        var workOrderId = await _db.WorkOrders.AsNoTracking()
            .Where(w => w.PoNumber == po)
            .Select(w => (Guid?)w.Id)
            .FirstOrDefaultAsync(cancellationToken);
        if (workOrderId is null) return null;

        var areas = await _db.WorkOrderProperties.AsNoTracking()
            .Where(p => p.WorkOrderId == workOrderId.Value)
            .Select(p => p.Area)
            .ToListAsync(cancellationToken);
        if (areas.Count == 0) return null;

        var parsed = areas
            .Select(a => EngineeringSurveyFeeRules.TryParseAreaM2(a, out var m2) ? m2 : (decimal?)null)
            .Where(m => m is > 0m)
            .Select(m => m!.Value)
            .ToList();
        if (parsed.Count == 0) return null;
        if (parsed.Count == 1) return parsed[0];
        return parsed.Max();
    }

    private async Task<List<InspectorFeeLedger>> FilterLedgersWithCompletedCaseStudyAsync(
        List<InspectorFeeLedger> ledgers,
        CancellationToken cancellationToken)
    {
        if (ledgers.Count == 0) return ledgers;

        var readyPropertyIds = await GetCompletedCaseStudyPropertyIdsAsync(
            ledgers.Select(l => l.PropertyId),
            cancellationToken);
        return ledgers
            .Where(l => l.PropertyId is Guid pid && readyPropertyIds.Contains(pid))
            .ToList();
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

        var ready = await _db.WorkflowTasks.AsNoTracking()
            .Where(t =>
                t.Kind == "case-study-property"
                && t.PropertyId != null
                && ids.Contains(t.PropertyId.Value)
                && t.Status == WorkflowTaskStatus.Completed)
            .Select(t => t.PropertyId!.Value)
            .Distinct()
            .ToListAsync(cancellationToken);
        return ready.ToHashSet();
    }

    private static bool IsWorkSubmitted(
        Guid workflowTaskId,
        IReadOnlyDictionary<Guid, WorkflowTask> tasks,
        IReadOnlyDictionary<Guid, FieldInspectionWorkspace> workspaces,
        IReadOnlyDictionary<Guid, PartyTaskSubmission> submissions)
    {
        if (!tasks.TryGetValue(workflowTaskId, out var task))
            return false;

        return ResolveWorkStatus(task, workspaces, submissions) == "done";
    }

    private static string ResolveWorkStatus(
        WorkflowTask task,
        IReadOnlyDictionary<Guid, FieldInspectionWorkspace> workspaces,
        IReadOnlyDictionary<Guid, PartyTaskSubmission> submissions)
    {
        if (task.Status == WorkflowTaskStatus.Cancelled)
            return "cancelled";

        if (task.Status == WorkflowTaskStatus.Completed)
            return "done";

        if (task.Kind == "field-inspection" &&
            workspaces.TryGetValue(task.Id, out var workspace) &&
            workspace.Status == PartyTaskSubmissionStatus.Submitted)
        {
            return "done";
        }

        if (task.Kind is "engineering-survey" or "government-review" &&
            submissions.TryGetValue(task.Id, out var submission) &&
            submission.Status == PartyTaskSubmissionStatus.Submitted)
        {
            return "done";
        }

        return "in_progress";
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

    private static DateTime? ResolveWorkSubmittedAtUtc(
        WorkflowTask task,
        IReadOnlyDictionary<Guid, FieldInspectionWorkspace> workspaces,
        IReadOnlyDictionary<Guid, PartyTaskSubmission> submissions)
    {
        if (task.Status == WorkflowTaskStatus.Completed)
            return task.UpdatedAtUtc;

        if (task.Kind == "field-inspection" &&
            workspaces.TryGetValue(task.Id, out var workspace) &&
            workspace.Status == PartyTaskSubmissionStatus.Submitted)
        {
            return workspace.SubmittedAtUtc ?? workspace.UpdatedAtUtc;
        }

        if (task.Kind == "engineering-survey" &&
            submissions.TryGetValue(task.Id, out var submission) &&
            submission.Status == PartyTaskSubmissionStatus.Submitted)
        {
            return submission.SubmittedAtUtc ?? submission.UpdatedAtUtc;
        }

        return null;
    }

    private static InspectorFeeRowDto ToRowDto(
        InspectorFeeLedger ledger,
        WorkflowTask task,
        string propertyLabel,
        bool workSubmitted,
        DateTime? workSubmittedAtUtc,
        DateTime? poReceivedAtUtc,
        string? lastTransitionReason)
    {
        var discount = Math.Max(0m, ledger.SupervisorDiscountSar);
        var workStatus = workSubmitted ? "done" : (
            task.Status == WorkflowTaskStatus.Cancelled ? "cancelled" : "in_progress");

        return new InspectorFeeRowDto
        {
            WorkflowTaskId = ledger.WorkflowTaskId.ToString(),
            PropertyId = ledger.PropertyId?.ToString(),
            PropertyLabel = propertyLabel,
            PoNumber = ledger.PoNumber,
            AssigneeId = ledger.AssigneeId,
            TaskKind = task.Kind,
            InspectorType = ledger.InspectorType,
            AgreedFeeSar = ledger.AgreedFeeSar,
            SupervisorDiscountSar = discount,
            DiscountReason = discount > 0
                ? (string.IsNullOrWhiteSpace(ledger.DiscountReason) ? "—" : ledger.DiscountReason)
                : null,
            NetFeeSar = InspectorFeeRules.NetFee(ledger.AgreedFeeSar, discount),
            BillingStatus = ledger.BillingStatus,
            BillingStatusLabel = InspectorFeeBillingRules.StatusLabel(ledger.BillingStatus),
            WorkStatus = workStatus,
            WorkStatusLabel = InspectorFeeBillingRules.WorkStatusLabel(workStatus),
            ExcludedFromBatch = ledger.ExcludedFromBatch,
            ExclusionReason = ledger.ExclusionReason,
            ReturnTo = ledger.ReturnTo,
            DisbursementBatchId = ledger.DisbursementBatchId?.ToString(),
            DisbursementVoucher = ledger.DisbursementVoucher,
            LastTransitionReason = lastTransitionReason,
            UpdatedAtUtc = ledger.UpdatedAtUtc,
            WorkSubmittedAtUtc = workSubmittedAtUtc,
            PoReceivedAtUtc = poReceivedAtUtc,
            IsEditable = InspectorFeeBillingRules.IsEditableStatus(ledger.BillingStatus),
            CanSubmitToSupervisor = workStatus == "done"
                && !ledger.ExcludedFromBatch
                && ledger.BillingStatus is InspectorFeeBillingStatus.Draft
                    or InspectorFeeBillingStatus.Returned
                    or InspectorFeeBillingStatus.Inquiry
                && (ledger.BillingStatus != InspectorFeeBillingStatus.Returned
                    || ledger.ReturnTo == InspectorFeeReturnTo.Office)
                && (ledger.BillingStatus != InspectorFeeBillingStatus.Inquiry
                    || ledger.ReturnTo == InspectorFeeReturnTo.Office),
            CanApproveToFinance = workStatus == "done"
                && !ledger.ExcludedFromBatch
                && ledger.BillingStatus == InspectorFeeBillingStatus.SupReview,
            CanCreateDisbursementRequest = workStatus == "done"
                && !ledger.ExcludedFromBatch
                && ledger.BillingStatus == InspectorFeeBillingStatus.AtFinance,
        };
    }

    private static InspectorFeesSummaryDto Summarize(IReadOnlyList<InspectorFeeRowDto> rows)
    {
        decimal SumNet(Func<InspectorFeeRowDto, bool> predicate) =>
            rows.Where(predicate).Sum(r => r.NetFeeSar);

        return new InspectorFeesSummaryDto
        {
            NetDraftSar = SumNet(r => r.BillingStatus == InspectorFeeBillingStatus.Draft),
            SupReviewSar = SumNet(r => r.BillingStatus == InspectorFeeBillingStatus.SupReview),
            AtFinanceSar = SumNet(r => r.BillingStatus == InspectorFeeBillingStatus.AtFinance),
            DisbReqSar = SumNet(r => r.BillingStatus == InspectorFeeBillingStatus.DisbReq),
            DisbursedSar = SumNet(r => r.BillingStatus == InspectorFeeBillingStatus.Disbursed),
            TotalDiscountsSar = rows.Sum(r => r.SupervisorDiscountSar),
            Rows = rows,
        };
    }

    private async Task<string> ResolvePartyTypeAsync(
        WorkflowTask task,
        CancellationToken cancellationToken)
    {
        // Product rules: engineering office is always an external entity;
        // government cooperator classification is always «متعاون فرد».
        if (string.Equals(task.Kind, "engineering-survey", StringComparison.OrdinalIgnoreCase))
            return EngineeringSurveyFeeRules.OfficePartyType;

        if (string.Equals(task.Kind, "government-review", StringComparison.OrdinalIgnoreCase))
            return GovernmentReviewFeeRules.PartyType;

        if (string.IsNullOrWhiteSpace(task.AssigneeId))
            return InspectorFeeRules.TypeEmployee;

        var aid = task.AssigneeId.Trim();
        var profile = await _db.UserProfiles.AsNoTracking()
            .Include(p => p.HrEmployee)
            .Include(p => p.ProcProvider)
            .FirstOrDefaultAsync(p => p.DistributionAssigneeId == aid, cancellationToken);

        if (profile is not null)
        {
            if (profile.ContractType == ContractType.ServiceProvider
                || profile.ProcProvider?.ProviderKind == ProcProviderKind.Organization)
            {
                return InspectorFeeRules.TypeCooperatorOrganization;
            }

            if (profile.ContractType == ContractType.Freelance
                || profile.ProcProvider?.ProviderKind == ProcProviderKind.Individual
                || profile.HrEmployee?.EmploymentType?.Contains("متعاون", StringComparison.Ordinal) == true)
            {
                return InspectorFeeRules.TypeCooperatorIndividual;
            }

            return InspectorFeeRules.TypeEmployee;
        }

        return InspectorFeeRules.ResolveInspectorType(aid);
    }

    private static InspectorFeesSummaryDto EmptySummary() => new()
    {
        NetDraftSar = 0m,
        SupReviewSar = 0m,
        AtFinanceSar = 0m,
        DisbReqSar = 0m,
        DisbursedSar = 0m,
        TotalDiscountsSar = 0m,
        Rows = [],
    };

    private async Task NotifyFinanceDisbursementBatchCreatedAsync(
        int propertyCount,
        CancellationToken cancellationToken)
    {
        var recipientIds = await _recipients.ResolveUserIdsWithPrototypeRoleAsync(
            "financial-officer",
            cancellationToken);

        if (recipientIds.Count == 0) return;

        await _notifications.CreateForUsersAsync(
            recipientIds,
            new CreateUserNotificationRequest
            {
                Title = "أمر صرف جديد",
                Body = $"بانتظار صرف {propertyCount} عقار.",
                Tone = "info",
                Href = "/financial",
                Category = "financial",
                SourceEvent = $"disbursement-batch:{DateTime.UtcNow:yyyyMMddHHmmss}",
            },
            cancellationToken);
    }

    private async Task NotifyPartiesFeesDisbursedAsync(
        IReadOnlyList<InspectorFeeRowDto> rows,
        CancellationToken cancellationToken)
    {
        foreach (var row in rows)
        {
            if (string.IsNullOrWhiteSpace(row.AssigneeId)) continue;

            var userId = await _recipients.ResolveUserIdForDistributionAssigneeAsync(
                row.AssigneeId,
                cancellationToken);
            if (userId is null) continue;

            await _notifications.CreateForUserAsync(
                userId,
                new CreateUserNotificationRequest
                {
                    Title = "تم صرف الأتعاب",
                    Body = $"صُرفت أتعاب العقار {row.PropertyLabel}.",
                    Tone = "success",
                    Href = "/party-fees",
                    Category = "financial",
                    EntityType = "task",
                    EntityId = row.WorkflowTaskId,
                    SourceEvent = $"fee-disbursed:{row.WorkflowTaskId}",
                },
                cancellationToken);
        }
    }

    public async Task<IReadOnlyList<InspectorFeeAuditEntryDto>> ListTransitionsAsync(
        Guid workflowTaskId,
        CancellationToken cancellationToken = default)
    {
        var transitions = await _db.InspectorFeeTransitions.AsNoTracking()
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
            : await _db.Users.AsNoTracking()
                .Where(u => actorIds.Contains(u.Id))
                .ToDictionaryAsync(
                    u => u.Id,
                    u => string.IsNullOrWhiteSpace(u.DisplayName) ? u.UserName ?? u.Id : u.DisplayName,
                    StringComparer.Ordinal,
                    cancellationToken);

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
}

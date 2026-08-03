using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Notifications;

namespace RealEstateEval.Infrastructure.Services;

/// <summary>
/// Facade for inspector-fee use cases. Heavy write/query/transition work lives in collaborators.
/// </summary>
public class InspectorFeeService : IInspectorFeeService
{
    private readonly ApplicationDbContext _db;
    private readonly INotificationService _notifications;
    private readonly NotificationRecipientResolver _recipients;
    private readonly IPartyFeePricingService _pricing;
    private readonly IInspectorFeeLedgerResolver _resolver;
    private readonly IInspectorFeeLedgerWriter _writer;
    private readonly IInspectorFeeSummaryQuery _summary;
    private readonly IInspectorFeeTransitionApplier _transitions;

    public InspectorFeeService(
        ApplicationDbContext db,
        INotificationService notifications,
        NotificationRecipientResolver recipients,
        IPartyFeePricingService pricing,
        IInspectorFeeLedgerResolver resolver,
        IInspectorFeeLedgerWriter writer,
        IInspectorFeeSummaryQuery summary,
        IInspectorFeeTransitionApplier transitions)
    {
        _db = db;
        _notifications = notifications;
        _recipients = recipients;
        _pricing = pricing;
        _resolver = resolver;
        _writer = writer;
        _summary = summary;
        _transitions = transitions;
    }

    public Task EnsureLedgersForTasksAsync(
        IEnumerable<WorkflowTask> tasks,
        CancellationToken cancellationToken = default) =>
        _writer.EnsureLedgersForTasksAsync(tasks, cancellationToken);

    public async Task EnsureLedgersForPropertyAsync(
        Guid propertyId,
        CancellationToken cancellationToken = default)
    {
        var feeTasks = await _db.WorkflowTasks.AsNoTracking()
            .Where(t =>
                t.PropertyId == propertyId
                && (t.Kind == WorkflowTaskKind.FieldInspection
                    || t.Kind == WorkflowTaskKind.GovernmentReview))
            .ToListAsync(cancellationToken);
        if (feeTasks.Count == 0) return;

        await _writer.EnsureLedgersForTasksAsync(feeTasks, cancellationToken);
    }

    public async Task<(InspectorFeeRowDto? Row, string? Error)> AccrueEngineeringSurveyFeeAsync(
        Guid workflowTaskId,
        string actorUserId,
        CancellationToken cancellationToken = default)
    {
        var task = await _db.WorkflowTasks.AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == workflowTaskId, cancellationToken);
        if (task is null)
            return (null, "المهمة غير موجودة.");

        if (task.Kind != WorkflowTaskKind.EngineeringSurvey)
            return (null, "الاستحقاق خاص بمهام الرفع المساحي فقط.");

        var submission = await _db.PartyTaskSubmissions.AsNoTracking()
            .FirstOrDefaultAsync(s => s.WorkflowTaskId == workflowTaskId, cancellationToken);
        if (submission is null || submission.Status != PartyTaskSubmissionStatus.Submitted)
            return (null, "لا يمكن الاستحقاق قبل إرسال المخرجات وقبولها.");

        if (task.Status != WorkflowTaskStatus.Completed)
            return (null, "مهمة الرفع المساحي غير مكتملة.");

        var deeds = await _resolver.ResolveDeedTargetsAsync(task, cancellationToken);
        var existingForTask = await _db.InspectorFeeLedgers
            .Where(x => x.WorkflowTaskId == workflowTaskId)
            .ToListAsync(cancellationToken);

        // Idempotent: every target deed already accrued — do not create a second fee on re-accept.
        if (deeds.Count > 0
            && deeds.All(d => existingForTask.Any(l =>
                l.DeedId == d.DeedId && l.AccruedAtUtc is not null && l.AgreedFeeSar > 0m)))
        {
            return (await GetByWorkflowTaskIdAsync(workflowTaskId, cancellationToken), null);
        }

        var partyType = existingForTask.FirstOrDefault()?.InspectorType
            ?? await _resolver.ResolvePartyTypeAsync(task, cancellationToken);
        var now = DateTime.UtcNow;
        InspectorFeeLedger? lastLedger = null;
        var ordinal = 0;
        foreach (var deed in deeds)
        {
            ordinal++;
            var areaM2 = await _resolver.ResolvePropertyAreaM2Async(
                task, cancellationToken, deed.PropertyId);
            var resolvedFee = await _pricing.ResolveDefaultFeeAsync(
                task.Kind,
                partyType,
                areaM2,
                task.AssigneeId,
                cancellationToken);

            if (!resolvedFee.IsResolved)
                return (null, PricingErrors.FeeUnresolved);

            var agreedFee = resolvedFee.FeeSar!.Value;
            var identity = await _resolver.ResolveLedgerIdentityAsync(
                task, cancellationToken, deed.DeedId);
            var ledger = existingForTask.FirstOrDefault(l => l.DeedId == identity.DeedId)
                ?? await _db.InspectorFeeLedgers.FirstOrDefaultAsync(
                    x => x.TransactionId == identity.TransactionId
                        && x.DeedId == identity.DeedId
                        && x.UserId == identity.UserId,
                    cancellationToken);

            if (ledger is not null && ledger.AccruedAtUtc is not null && ledger.AgreedFeeSar > 0m)
            {
                lastLedger = ledger;
                continue;
            }

            if (ledger is null)
            {
                ledger = new InspectorFeeLedger
                {
                    Id = Guid.NewGuid(),
                    TransactionId = identity.TransactionId,
                    DeedId = identity.DeedId,
                    UserId = identity.UserId,
                    WorkflowTaskId = task.Id,
                    PoNumber = task.PoNumber.Trim(),
                    PropertyId = deed.PropertyId,
                    PropertyOrdinal = deed.PropertyId == task.PropertyId
                        ? task.PropertyOrdinal
                        : ordinal,
                    AssigneeId = task.AssigneeId,
                    InspectorType = partyType,
                    SupervisingDepartment = SupervisingDepartments.ForTaskKind(task.Kind),
                    AgreedFeeSar = agreedFee,
                    PricingTableId = resolvedFee.PricingTableId,
                    SupervisorDiscountSar = 0m,
                    DiscountReason = null,
                    BillingStatus = InspectorFeeBillingStatus.AtFinance,
                    ExcludedFromBatch = false,
                    ExclusionReason = null,
                    ReturnTo = null,
                    DisbursementBatchId = null,
                    DisbursementVoucher = null,
                    AccruedAtUtc = now,
                    CreatedAtUtc = now,
                    UpdatedAtUtc = now,
                };
                _db.InspectorFeeLedgers.Add(ledger);
                existingForTask.Add(ledger);
            }
            else
            {
                ledger.TransactionId = identity.TransactionId;
                ledger.DeedId = identity.DeedId;
                ledger.UserId = identity.UserId;
                ledger.AgreedFeeSar = agreedFee;
                ledger.PricingTableId = resolvedFee.PricingTableId;
                ledger.InspectorType = partyType;
                ledger.SupervisingDepartment = SupervisingDepartments.ForTaskKind(task.Kind);
                ledger.AssigneeId = task.AssigneeId;
                ledger.PropertyId = deed.PropertyId;
                ledger.PropertyOrdinal = deed.PropertyId == task.PropertyId
                    ? task.PropertyOrdinal
                    : ordinal;
                ledger.PoNumber = task.PoNumber.Trim();
                if (ledger.SupervisorDiscountSar <= 0m)
                {
                    ledger.SupervisorDiscountSar = 0m;
                    ledger.DiscountReason = null;
                    ledger.BillingStatus = InspectorFeeBillingStatus.AtFinance;
                }
                else
                {
                    ledger.BillingStatus = InspectorFeeBillingStatus.OfficeReview;
                }

                ledger.AccruedAtUtc = now;
                ledger.UpdatedAtUtc = now;
            }

            _db.InspectorFeeTransitions.Add(new InspectorFeeTransition
            {
                Id = Guid.NewGuid(),
                WorkflowTaskId = ledger.WorkflowTaskId,
                FromStatus = "—",
                ToStatus = ledger.BillingStatus,
                Reason = "استحقاق عند قبول الأخصائي لمخرجات الرفع المساحي",
                ActorUserId = actorUserId,
                CreatedAtUtc = now,
            });
            lastLedger = ledger;
        }

        if (lastLedger is null)
            return (null, PricingErrors.FeeUnresolved);

        await _db.SaveChangesAsync(cancellationToken);
        return (await GetByWorkflowTaskIdAsync(workflowTaskId, cancellationToken), null);
    }

    public Task<InspectorFeesSummaryDto> GetSummaryAsync(
        string? assigneeId,
        string? workflowTaskId,
        bool submittedOnly,
        string? taskKind = null,
        string? billingStatus = null,
        string? returnTo = null,
        bool hideDisputed = false,
        CancellationToken cancellationToken = default,
        string? supervisingDepartment = null) =>
        _summary.GetSummaryAsync(
            assigneeId,
            workflowTaskId,
            submittedOnly,
            taskKind,
            billingStatus,
            returnTo,
            hideDisputed,
            cancellationToken,
            supervisingDepartment);

    public Task<InspectorFeeRowDto?> GetByWorkflowTaskIdAsync(
        Guid workflowTaskId,
        CancellationToken cancellationToken = default) =>
        _summary.GetByWorkflowTaskIdAsync(workflowTaskId, cancellationToken);

    public async Task<InspectorFeeRowDto?> PatchAsync(
        Guid workflowTaskId,
        PatchInspectorFeeRequest request,
        CancellationToken cancellationToken = default,
        string? actorDepartment = null,
        bool canManageAllDepartments = false)
    {
        var ledger = await _db.InspectorFeeLedgers
            .FirstOrDefaultAsync(x => x.WorkflowTaskId == workflowTaskId, cancellationToken);
        if (ledger is null) return null;
        if (!SupervisingDepartments.CanManage(
                ledger.SupervisingDepartment,
                actorDepartment,
                canManageAllDepartments))
        {
            return null;
        }

        if (!InspectorFeeBillingRules.IsEditableStatus(ledger.BillingStatus))
            return null;

        if (request.AgreedFeeSar.HasValue)
        {
            if (!InspectorFeeRules.IsEmployee(ledger.InspectorType))
                return null;
            // Flat-priced incentives keep their table stamp; hand override is only for the legacy
            // zero-draft rows that never resolved from a flat schedule.
            if (ledger.PricingTableId is not null)
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

        var fromStatus = ledger.BillingStatus;
        var taskKind = await _db.WorkflowTasks.AsNoTracking()
            .Where(t => t.Id == workflowTaskId)
            .Select(t => t.Kind)
            .FirstOrDefaultAsync(cancellationToken);
        var isEmployee = InspectorFeeRules.IsEmployee(ledger.InspectorType);
        var discountApplied = request.SupervisorDiscountSar.HasValue
            && ledger.SupervisorDiscountSar > 0m;

        // Employees never enter the office-approval / dispute loop. A supervisor discount sends the
        // line straight to finance and the assignee is told.
        if (isEmployee
            && discountApplied
            && ledger.BillingStatus is InspectorFeeBillingStatus.Draft
                or InspectorFeeBillingStatus.SupReview
                or InspectorFeeBillingStatus.AtFinance
                or InspectorFeeBillingStatus.Returned
                or InspectorFeeBillingStatus.Inquiry
                or InspectorFeeBillingStatus.OfficeReview
                or InspectorFeeBillingStatus.Disputed)
        {
            ledger.BillingStatus = InspectorFeeBillingStatus.AtFinance;
        }
        else if (!isEmployee
            && taskKind == WorkflowTaskKind.EngineeringSurvey
            && ledger.AccruedAtUtc is not null
            && ledger.BillingStatus is InspectorFeeBillingStatus.Draft
                or InspectorFeeBillingStatus.AtFinance
                or InspectorFeeBillingStatus.OfficeReview
                or InspectorFeeBillingStatus.Disputed
                or InspectorFeeBillingStatus.SupReview)
        {
            // Engineering-office billing: discounted cooperator lines need explicit office approval.
            if (ledger.SupervisorDiscountSar > 0m)
                ledger.BillingStatus = InspectorFeeBillingStatus.OfficeReview;
            else if (ledger.BillingStatus is InspectorFeeBillingStatus.OfficeReview
                or InspectorFeeBillingStatus.Disputed
                or InspectorFeeBillingStatus.Draft)
                ledger.BillingStatus = InspectorFeeBillingStatus.AtFinance;
        }

        ledger.UpdatedAtUtc = DateTime.UtcNow;
        if (fromStatus != ledger.BillingStatus)
        {
            _db.InspectorFeeTransitions.Add(new InspectorFeeTransition
            {
                Id = Guid.NewGuid(),
                WorkflowTaskId = ledger.WorkflowTaskId,
                FromStatus = fromStatus,
                ToStatus = ledger.BillingStatus,
                Reason = ledger.DiscountReason,
                ActorUserId = "system",
                CreatedAtUtc = DateTime.UtcNow,
            });
        }

        await _db.SaveChangesAsync(cancellationToken);

        if (isEmployee && discountApplied)
            await NotifyEmployeeDiscountAppliedAsync(ledger, cancellationToken);

        return await GetByWorkflowTaskIdAsync(workflowTaskId, cancellationToken);
    }

    public async Task<(InspectorFeeRowDto? Row, string? Error)> TransitionAsync(
        Guid workflowTaskId,
        InspectorFeeTransitionRequest request,
        string actorUserId,
        string? actorAssigneeId,
        bool isOperationsManager,
        bool isFinancialOfficer,
        CancellationToken cancellationToken = default,
        string? actorDepartment = null,
        bool canManageAllDepartments = false)
    {
        var ledger = await _db.InspectorFeeLedgers
            .FirstOrDefaultAsync(x => x.WorkflowTaskId == workflowTaskId, cancellationToken);
        if (ledger is null)
            return (null, "سجل الأتعاب غير موجود.");

        var error = await _transitions.ApplyAsync(
            ledger,
            request,
            actorUserId,
            actorAssigneeId,
            isOperationsManager,
            isFinancialOfficer,
            cancellationToken,
            actorDepartment: actorDepartment,
            canManageAllDepartments: canManageAllDepartments);
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
        CancellationToken cancellationToken = default,
        string? actorDepartment = null,
        bool canManageAllDepartments = false)
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

            var error = await _transitions.ApplyAsync(
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
                cancellationToken,
                actorDepartment: actorDepartment,
                canManageAllDepartments: canManageAllDepartments);

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

    public Task<CreateDisbursementBatchResult> CreateDisbursementBatchAsync(
        CreateDisbursementBatchRequest request,
        string actorUserId,
        string? actorAssigneeId,
        CancellationToken cancellationToken = default)
    {
        // ج٩ / ق٦: new disbursement batches are retired — use party billing statements.
        return Task.FromResult(new CreateDisbursementBatchResult
        {
            Failed =
            [
                new InspectorFeeTransitionErrorDto
                {
                    WorkflowTaskId = "",
                    Error = "إنشاء طلب صرف متوقف — البنود الجاهزة تُفوتر عبر كشف الأطراف.",
                },
            ],
        });
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

    public Task<IReadOnlyList<InspectorFeeAuditEntryDto>> ListTransitionsAsync(
        Guid workflowTaskId,
        CancellationToken cancellationToken = default) =>
        _summary.ListTransitionsAsync(workflowTaskId, cancellationToken);

    private async Task NotifyEmployeeDiscountAppliedAsync(
        InspectorFeeLedger ledger,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(ledger.AssigneeId)) return;

        var usersByAssignee = await _recipients.ResolveUserIdsForDistributionAssigneesAsync(
            [ledger.AssigneeId.Trim()],
            cancellationToken);
        if (!usersByAssignee.TryGetValue(ledger.AssigneeId.Trim(), out var userId)
            || string.IsNullOrWhiteSpace(userId))
        {
            return;
        }

        var net = InspectorFeeRules.NetFee(ledger.AgreedFeeSar, ledger.SupervisorDiscountSar);
        await _notifications.CreateForUsersAsync(
            [userId],
            new CreateUserNotificationRequest
            {
                Title = "خصم على أتعابك",
                Body =
                    $"طُبّق خصم {ledger.SupervisorDiscountSar:N0} ر.س على أمر العمل {ledger.PoNumber}."
                    + $" الصافي {net:N0} ر.س — البند جاهز للفوترة.",
                Tone = "warning",
                Href = "/party-fees",
                Category = "financial",
                SourceEvent = $"fee-discount-notified:{ledger.WorkflowTaskId:N}",
            },
            cancellationToken);
    }

    private async Task NotifyPartiesFeesDisbursedAsync(
        IReadOnlyList<InspectorFeeRowDto> rows,
        CancellationToken cancellationToken)
    {
        var assigneeIds = rows
            .Select(row => row.AssigneeId?.Trim())
            .Where(assigneeId => !string.IsNullOrWhiteSpace(assigneeId))
            .Cast<string>()
            .Distinct(StringComparer.Ordinal)
            .ToList();
        var usersByAssignee = await _recipients.ResolveUserIdsForDistributionAssigneesAsync(
            assigneeIds,
            cancellationToken);
        var notifications =
            new List<(string UserId, CreateUserNotificationRequest Request)>();

        foreach (var row in rows)
        {
            if (string.IsNullOrWhiteSpace(row.AssigneeId)) continue;
            if (!usersByAssignee.TryGetValue(row.AssigneeId.Trim(), out var userId)) continue;

            notifications.Add((userId, new CreateUserNotificationRequest
            {
                Title = "تم صرف الأتعاب",
                Body = $"صُرفت أتعاب العقار {row.PropertyLabel}.",
                Tone = "success",
                Href = "/party-fees",
                Category = "financial",
                EntityType = "task",
                EntityId = row.WorkflowTaskId,
                SourceEvent = $"fee-disbursed:{row.WorkflowTaskId}",
            }));
        }

        await _notifications.CreateManyAsync(notifications, cancellationToken);
    }
}

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
    private const int MaxSummaryRows = 2000;
    private const string FeeBillingTransitionAction = "FEE_BILLING_TRANSITION";
    private const string FeeLedgerEntityType = "inspector_fee_ledger";

    private readonly ApplicationDbContext _db;
    private readonly INotificationService _notifications;
    private readonly NotificationRecipientResolver _recipients;
    private readonly IPartyFeePricingService _pricing;
    private readonly IAuditLogWriter _audit;

    public InspectorFeeService(
        ApplicationDbContext db,
        INotificationService notifications,
        NotificationRecipientResolver recipients,
        IPartyFeePricingService pricing)
        : this(db, notifications, recipients, pricing, new AuditLogWriter())
    {
    }

    public InspectorFeeService(
        ApplicationDbContext db,
        INotificationService notifications,
        NotificationRecipientResolver recipients,
        IPartyFeePricingService pricing,
        IAuditLogWriter audit)
    {
        _db = db;
        _notifications = notifications;
        _recipients = recipients;
        _pricing = pricing;
        _audit = audit;
    }

    public async Task EnsureLedgersForTasksAsync(
        IEnumerable<WorkflowTask> tasks,
        CancellationToken cancellationToken = default)
    {
        // Engineering-survey fees accrue only on specialist acceptance — not here.
        var feeTasks = tasks
            .Where(t => t.Kind is WorkflowTaskKind.FieldInspection
                or WorkflowTaskKind.GovernmentReview)
            .ToList();
        if (feeTasks.Count == 0) return;

        var taskIds = feeTasks.Select(t => t.Id).ToList();
        var existing = await _db.InspectorFeeLedgers
            .Where(x => taskIds.Contains(x.WorkflowTaskId))
            .Select(x => x.WorkflowTaskId)
            .ToListAsync(cancellationToken);
        var existingSet = existing.ToHashSet();

        var now = DateTime.UtcNow;
        var pendingTriples = new HashSet<(Guid TransactionId, Guid DeedId, string UserId)>();
        foreach (var task in feeTasks)
        {
            if (existingSet.Contains(task.Id)) continue;

            var partyType = await ResolvePartyTypeAsync(task, cancellationToken);
            var isEmployee = InspectorFeeRules.IsEmployee(partyType);

            // Employee incentives require an active compensation flag and a resolved flat table.
            // Opening a zero draft for every employee was the hand-entry path ج٦ replaces.
            if (isEmployee)
            {
                var hasCompensation = await AssigneeHasCompensationAsync(
                    task.AssigneeId,
                    cancellationToken);
                if (!hasCompensation) continue;
            }

            var areaM2 = await ResolvePropertyAreaM2Async(task, cancellationToken);
            var agreedFee = await _pricing.ResolveDefaultFeeAsync(
                task.Kind,
                partyType,
                areaM2,
                task.AssigneeId,
                cancellationToken);

            // Unresolved means no rate yet — inventing zero here is exactly what we are removing.
            if (!agreedFee.IsResolved) continue;

            var po = task.PoNumber.Trim();
            var identity = await ResolveLedgerIdentityAsync(task, cancellationToken);
            // ج٨: same (transaction, deed, user) must not open a second line — even via another task.
            var tripleKey = (identity.TransactionId, identity.DeedId, identity.UserId);
            if (!pendingTriples.Add(tripleKey)) continue;
            var tripleExists = await _db.InspectorFeeLedgers.AnyAsync(
                x => x.TransactionId == identity.TransactionId
                    && x.DeedId == identity.DeedId
                    && x.UserId == identity.UserId,
                cancellationToken);
            if (tripleExists) continue;

            var billingStatus = InspectorFeeBillingStatus.Draft;
            string? preSuspension = null;
            string? suspensionReason = null;
            if (isEmployee && !string.IsNullOrWhiteSpace(task.AssigneeId))
            {
                var withhold = await _db.IncentiveSuspensions.AsNoTracking()
                    .Where(x =>
                        x.AssigneeId == task.AssigneeId.Trim()
                        && x.TransactionKey == po
                        && x.LiftedAtUtc == null)
                    .Select(x => x.Reason)
                    .FirstOrDefaultAsync(cancellationToken);
                if (withhold is not null)
                {
                    billingStatus = InspectorFeeBillingStatus.Suspended;
                    preSuspension = InspectorFeeBillingStatus.Draft;
                    suspensionReason = withhold;
                }
            }

            _db.InspectorFeeLedgers.Add(new InspectorFeeLedger
            {
                Id = Guid.NewGuid(),
                TransactionId = identity.TransactionId,
                DeedId = identity.DeedId,
                UserId = identity.UserId,
                WorkflowTaskId = task.Id,
                PoNumber = po,
                PropertyId = task.PropertyId,
                PropertyOrdinal = task.PropertyOrdinal,
                AssigneeId = task.AssigneeId,
                InspectorType = partyType,
                SupervisingDepartment = SupervisingDepartments.ForTaskKind(task.Kind),
                AgreedFeeSar = agreedFee.FeeSar!.Value,
                PricingTableId = agreedFee.PricingTableId,
                SupervisorDiscountSar = 0m,
                DiscountReason = null,
                BillingStatus = billingStatus,
                PreSuspensionStatus = preSuspension,
                SuspensionReason = suspensionReason,
                ExcludedFromBatch = false,
                ExclusionReason = null,
                ReturnTo = null,
                DisbursementBatchId = null,
                DisbursementVoucher = null,
                AccruedAtUtc = now,
                CreatedAtUtc = now,
                UpdatedAtUtc = now,
            });
        }

        await _db.SaveChangesAsync(cancellationToken);
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

        var identity = await ResolveLedgerIdentityAsync(task, cancellationToken);
        var ledger = await _db.InspectorFeeLedgers.FirstOrDefaultAsync(x => x.WorkflowTaskId == workflowTaskId, cancellationToken);
        ledger ??= await _db.InspectorFeeLedgers.FirstOrDefaultAsync(x => x.TransactionId == identity.TransactionId&& x.DeedId == identity.DeedId&& x.UserId == identity.UserId,cancellationToken);

        // Idempotent: already accrued — do not create a second fee on re-accept after correction.
        if (ledger is not null && ledger.AccruedAtUtc is not null && ledger.AgreedFeeSar > 0m)
            return (await GetByWorkflowTaskIdAsync(ledger.WorkflowTaskId, cancellationToken), null);

        var partyType = ledger?.InspectorType?? await ResolvePartyTypeAsync(task, cancellationToken);
        var areaM2 = await ResolvePropertyAreaM2Async(task, cancellationToken);
        var resolvedFee = await _pricing.ResolveDefaultFeeAsync(task.Kind,partyType,areaM2,ledger?.AssigneeId ?? task.AssigneeId,cancellationToken);

        if (!resolvedFee.IsResolved)
            return (null, PricingErrors.FeeUnresolved);

        var agreedFee = resolvedFee.FeeSar!.Value;

        var now = DateTime.UtcNow;
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
                PropertyId = task.PropertyId,
                PropertyOrdinal = task.PropertyOrdinal,
                AssigneeId = task.AssigneeId,
                InspectorType = partyType,
                SupervisingDepartment = SupervisingDepartments.ForTaskKind(task.Kind),
                AgreedFeeSar = agreedFee,
                PricingTableId = resolvedFee.PricingTableId,
                SupervisorDiscountSar = 0m,
                DiscountReason = null,
                // Table price → ready for billing without office approval.
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
            ledger.PropertyId = task.PropertyId;
            ledger.PropertyOrdinal = task.PropertyOrdinal;
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

        await _db.SaveChangesAsync(cancellationToken);
        return (await GetByWorkflowTaskIdAsync(workflowTaskId, cancellationToken), null);
    }

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

        await EnsureLedgersForTasksAsync(feeTasks, cancellationToken);
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
        await BackfillMissingLedgersAsync(cancellationToken);
        await SyncLedgerSnapshotsFromTasksAsync(cancellationToken);

        var query = _db.InspectorFeeLedgers.AsNoTracking();

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
        var tasks = await _db.WorkflowTasks.AsNoTracking()
            .Where(t => taskIds.Contains(t.Id))
            .ToDictionaryAsync(t => t.Id, cancellationToken);

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
            if (submittedOnly && !InspectorFeeWorkStatusRules.IsWorkSubmitted(ledger.WorkflowTaskId, tasks, workspaces, submissions))
                continue;

            if (!tasks.TryGetValue(ledger.WorkflowTaskId, out var task))
                continue;

            poReceivedByNumber.TryGetValue(ledger.PoNumber.Trim(), out var poReceived);
            lastReasonByTask.TryGetValue(ledger.WorkflowTaskId, out var lastReason);

            rows.Add(InspectorFeeRowMapper.ToRowDto(
                ledger,
                task,
                propertyLabels.GetValueOrDefault(ledger.WorkflowTaskId, "—"),
                InspectorFeeWorkStatusRules.IsWorkSubmitted(ledger.WorkflowTaskId, tasks, workspaces, submissions),
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
        await BackfillMissingLedgersAsync(cancellationToken);
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

        var error = await ApplyTransitionAsync(
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

    private async Task<string?> ApplyTransitionAsync(
        InspectorFeeLedger ledger,
        InspectorFeeTransitionRequest request,
        string actorUserId,
        string? actorAssigneeId,
        bool isOperationsManager,
        bool isFinancialOfficer,
        CancellationToken cancellationToken,
        string? actorDepartment = null,
        bool canManageAllDepartments = false)
    {
        var action = request.Action.Trim().ToLowerInvariant();
        var fromStatus = ledger.BillingStatus;

        if (InspectorFeeRules.IsEmployee(ledger.InspectorType)
            && action is InspectorFeeActions.OfficeApproveDiscount
                or InspectorFeeActions.OfficeDispute
                or InspectorFeeActions.ResolveDispute)
        {
            return "مسار الموظف لا يدعم خلاف التسعير — الخصم يُبلَّغ ويصبح جاهزاً مباشرة.";
        }

        if (!InspectorFeeTransitionAuthorization.CanPerformAction(action, ledger, actorAssigneeId, isOperationsManager, isFinancialOfficer))
            return "غير مصرّح بتنفيذ هذا الإجراء.";
        if (RequiresDepartmentSupervisor(action)
            && !SupervisingDepartments.CanManage(
                ledger.SupervisingDepartment,
                actorDepartment,
                canManageAllDepartments))
        {
            return "هذا البند يتبع قسماً آخر — الإجراء متاح لمشرف قسم المعاملة فقط.";
        }

        // ج٩ / ق٦: DisbursementBatch creation is retired for every task kind.
        if (action == InspectorFeeActions.CreateDisbursementRequest)
        {
            return "إنشاء طلب صرف متوقف — البنود الجاهزة تُفوتر عبر كشف الأطراف.";
        }

        if (action == InspectorFeeActions.SubmitToSupervisor)
        {
            var taskKind = await _db.WorkflowTasks.AsNoTracking()
                .Where(t => t.Id == ledger.WorkflowTaskId)
                .Select(t => t.Kind)
                .FirstOrDefaultAsync(cancellationToken);
            if (taskKind == WorkflowTaskKind.EngineeringSurvey)
            {
                return "مسار المكتب الهندسي لا يدعم رفع الأتعاب للمشرف — استخدم موافقة الحسم أو الاعتراض من الكشف المبدئي.";
            }
        }

        if (!InspectorFeeBillingRules.TryResolveTransition(
                fromStatus,
                action,
                out var nextStatus,
                out var nextReturnTo,
                out var transitionError,
                ledger.PreSuspensionStatus))
        {
            return transitionError;
        }

        if (action == InspectorFeeActions.Suspend)
        {
            if (string.IsNullOrWhiteSpace(request.Reason))
                return "سبب الإيقاف مطلوب.";

            ledger.PreSuspensionStatus = fromStatus;
            ledger.SuspensionReason = request.Reason.Trim();
        }

        if (action == InspectorFeeActions.LiftSuspension)
        {
            ledger.PreSuspensionStatus = null;
            ledger.SuspensionReason = null;
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

        if (action is InspectorFeeActions.OfficeApproveDiscount
            or InspectorFeeActions.OfficeDispute)
        {
            if (ledger.ExcludedFromBatch)
                return "لا يمكن معالجة عقار مستبعد.";

            if (ledger.SupervisorDiscountSar <= 0m)
                return "لا يوجد حسم يحتاج موافقة المكتب.";

            if (action == InspectorFeeActions.OfficeDispute
                && string.IsNullOrWhiteSpace(request.Reason))
            {
                return "سبب الاعتراض مطلوب.";
            }
        }

        if (action == InspectorFeeActions.ResolveDispute)
        {
            if (ledger.ExcludedFromBatch)
                return "لا يمكن حسم خلاف لعقار مستبعد.";

            if (!InspectorFeeRules.HasBillableAgreedFee(ledger.AgreedFeeSar))
                return "يجب إدخال مبلغ الأتعاب المتفق عليه قبل الحسم.";

            if (!InspectorFeeBillingRules.ValidateDiscount(
                    ledger.SupervisorDiscountSar,
                    ledger.DiscountReason,
                    out var resolveDiscountError))
            {
                return resolveDiscountError;
            }
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

        if (action == InspectorFeeActions.Disburse)
        {
            var voucher = string.IsNullOrWhiteSpace(request.DisbursementVoucher)
                ? $"SND-{DateTime.UtcNow:yyyyMMddHHmmss}"
                : request.DisbursementVoucher.Trim();
            ledger.DisbursementVoucher = voucher;
        }

        var before = SnapshotLedger(ledger, fromStatus);

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

        _db.AuditLogs.Add(_audit.Create(
            string.IsNullOrWhiteSpace(actorUserId) ? "system" : actorUserId,
            FeeBillingTransitionAction,
            FeeLedgerEntityType,
            ledger.Id.ToString(),
            before,
            SnapshotLedger(ledger, nextStatus)));

        return null;
    }

    private static object SnapshotLedger(InspectorFeeLedger ledger, string billingStatus) => new
    {
        workflowTaskId = ledger.WorkflowTaskId,
        billingStatus,
        returnTo = ledger.ReturnTo,
        agreedFeeSar = ledger.AgreedFeeSar,
        supervisorDiscountSar = ledger.SupervisorDiscountSar,
        netFeeSar = InspectorFeeRules.NetFee(ledger.AgreedFeeSar, ledger.SupervisorDiscountSar),
        statementId = ledger.EngineeringBillingStatementId,
        disbursementBatchId = ledger.DisbursementBatchId,
    };

    private static bool RequiresDepartmentSupervisor(string action) =>
        action is InspectorFeeActions.ApproveToFinance
            or InspectorFeeActions.ResendToFinance
            or InspectorFeeActions.ReturnToOffice
            or InspectorFeeActions.ResolveDispute
            or InspectorFeeActions.Suspend
            or InspectorFeeActions.LiftSuspension;

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

        return InspectorFeeWorkStatusRules.IsWorkSubmitted(
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
        // Engineering-survey ledgers are created only via AccrueEngineeringSurveyFeeAsync.
        var feeTasks = await _db.WorkflowTasks.AsNoTracking()
            .Where(t =>
                t.Kind == WorkflowTaskKind.FieldInspection
                || t.Kind == WorkflowTaskKind.GovernmentReview)
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
        if (missing.Count == 0) return;

        await EnsureLedgersForTasksAsync(missing, cancellationToken);
    }

    /// <summary>
    /// Decision 3: task property → sole property in PO → max area among PO properties.
    /// </summary>
    /// <summary>
    /// ج٨ identity: one line per (transaction, deed, user). Until PO tasks are split per deed,
    /// a missing property uses the workflow task id as the deed stand-in.
    /// </summary>
    private async Task<(Guid TransactionId, Guid DeedId, string UserId)> ResolveLedgerIdentityAsync(
        WorkflowTask task,
        CancellationToken cancellationToken)
    {
        var po = task.PoNumber.Trim();
        var workOrderId = string.IsNullOrEmpty(po)
            ? null
            : await _db.WorkOrders.AsNoTracking()
                .Where(w => w.PoNumber == po)
                .Select(w => (Guid?)w.Id)
                .FirstOrDefaultAsync(cancellationToken);

        // Orphan PO strings still need a stable transaction key for the unique index.
        var transactionId = workOrderId ?? StableGuidFromKey($"tx:{po}");
        var deedId = task.PropertyId ?? task.Id;
        var userId = task.AssigneeId?.Trim() ?? "";
        return (transactionId, deedId, userId);
    }

    private static Guid StableGuidFromKey(string key)
    {
        var hash = System.Security.Cryptography.SHA256.HashData(
            System.Text.Encoding.UTF8.GetBytes(key));
        Span<byte> bytes = stackalloc byte[16];
        hash.AsSpan(0, 16).CopyTo(bytes);
        return new Guid(bytes);
    }

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

        var taskIds = ledgers.Select(l => l.WorkflowTaskId).Distinct().ToList();
        var engSurveyIds = await _db.WorkflowTasks.AsNoTracking()
            .Where(t => taskIds.Contains(t.Id) && t.Kind == WorkflowTaskKind.EngineeringSurvey)
            .Select(t => t.Id)
            .ToListAsync(cancellationToken);
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

        var ready = await _db.WorkflowTasks.AsNoTracking()
            .Where(t =>
                t.Kind == WorkflowTaskKind.CaseStudyProperty
                && t.PropertyId != null
                && ids.Contains(t.PropertyId.Value)
                && t.Status == WorkflowTaskStatus.Completed)
            .Select(t => t.PropertyId!.Value)
            .Distinct()
            .ToListAsync(cancellationToken);
        return ready.ToHashSet();
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

    private async Task<bool> AssigneeHasCompensationAsync(
        string? assigneeId,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(assigneeId)) return false;
        var aid = assigneeId.Trim();
        return await _db.UserProfiles.AsNoTracking()
            .AnyAsync(
                p => p.DistributionAssigneeId == aid && p.HasCompensation,
                cancellationToken);
    }

    private async Task<string> ResolvePartyTypeAsync(
        WorkflowTask task,
        CancellationToken cancellationToken)
    {
        // Product rules: engineering office is always an external entity;
        // government reviewers follow employee vs cooperator from the staff profile (ج٧).
        if (task.Kind == WorkflowTaskKind.EngineeringSurvey)
            return EngineeringSurveyFeeRules.OfficePartyType;

        if (string.IsNullOrWhiteSpace(task.AssigneeId))
            return InspectorFeeRules.TypeEmployee;

        var aid = task.AssigneeId.Trim();
        var profile = await _db.UserProfiles.AsNoTracking()
            .Include(p => p.HrEmployee)
            .Include(p => p.ProcProvider)
            .FirstOrDefaultAsync(p => p.DistributionAssigneeId == aid, cancellationToken);

        if (task.Kind == WorkflowTaskKind.GovernmentReview)
        {
            return GovernmentReviewFeeRules.ResolveReviewerType(
                profile?.ContractType,
                profile?.ProcProvider?.ProviderKind,
                profile?.HrEmployee?.EmploymentType,
                aid);
        }

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

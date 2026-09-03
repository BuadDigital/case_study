using Microsoft.Extensions.DependencyInjection;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Financial.Domain;
using RealEstateEval.Financial.Application.Abstractions;
using RealEstateEval.Financial.Application.Rules;

namespace RealEstateEval.Financial.Application.Services;

/// <summary>
/// Facade for inspector-fee use cases. Heavy write/query/transition work lives in collaborators;
/// persistence is <see cref="IInspectorFeeLedgerStore"/>, so this class never opens EF.
/// </summary>
public class InspectorFeeService : IInspectorFeeService
{
    private readonly ICaseStudyLookup _lookup;
    private readonly ICaseStudyCommands _commands;
    private readonly IInspectorFeeLedgerStore _ledgers;
    private readonly INotificationService _notifications;
    private readonly INotificationRecipientResolver _recipients;
    private readonly IPartyFeePricingService _pricing;
    private readonly IInspectorFeeLedgerResolver _resolver;
    private readonly IInspectorFeeLedgerWriter _writer;
    private readonly IInspectorFeeSummaryQuery _summary;
    private readonly IInspectorFeeTransitionApplier _transitions;
    private readonly TimeProvider _time;

    [ActivatorUtilitiesConstructor]
    public InspectorFeeService(
        ICaseStudyLookup lookup,
        ICaseStudyCommands commands,
        IInspectorFeeLedgerStore ledgers,
        INotificationService notifications,
        INotificationRecipientResolver recipients,
        IPartyFeePricingService pricing,
        IInspectorFeeLedgerResolver resolver,
        IInspectorFeeLedgerWriter writer,
        IInspectorFeeSummaryQuery summary,
        IInspectorFeeTransitionApplier transitions,
        TimeProvider? time = null)
    {
        _time = time ?? TimeProvider.System;

        _lookup = lookup;
        _commands = commands;
        _ledgers = ledgers;
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
        var feeTasks = (await _lookup.ListWorkflowTasksByPropertyAsync(
                propertyId,
                [WorkflowTaskKind.FieldInspection, WorkflowTaskKind.GovernmentReview],
                cancellationToken))
            .Select(s => s.ToWorkflowTask())
            .ToList();
        if (feeTasks.Count == 0) return;

        await _writer.EnsureLedgersForTasksAsync(feeTasks, cancellationToken);
    }

    public async Task<(InspectorFeeRowDto? Row, string? Error)> AccrueEngineeringSurveyFeeAsync(
        Guid workflowTaskId,
        string actorUserId,
        CancellationToken cancellationToken = default)
    {
        var snapshot = await _lookup.GetWorkflowTaskAsync(workflowTaskId, cancellationToken);
        if (snapshot is null)
            return (null, InspectorFeeAccrualRules.TaskNotFoundError);
        var task = snapshot.ToWorkflowTask();

        var submissions = await _lookup.ListPartyTaskSubmissionsByTaskIdsAsync(
            [workflowTaskId], cancellationToken);
        var submission = submissions.FirstOrDefault()?.ToSubmission();
        var accrualError = InspectorFeeAccrualRules.ValidateEngineeringSurveyAccrual(task, submission);
        if (accrualError is not null)
            return (null, accrualError);

        var deeds = await _resolver.ResolveDeedTargetsAsync(task, cancellationToken);
        var existingForTask =
            (await _ledgers.ListByWorkflowTaskAsync(workflowTaskId, cancellationToken)).ToList();

 // Idempotent: every target deed already accrued — do not create a second fee on re-accept.
        if (InspectorFeeAccrualRules.AllDeedsAccrued(deeds, existingForTask))
        {
            return (await GetByWorkflowTaskIdAsync(workflowTaskId, cancellationToken), null);
        }

        var partyType = existingForTask.FirstOrDefault()?.InspectorType
            ?? await _resolver.ResolvePartyTypeAsync(task, cancellationToken);
        var now = _time.UtcNow();
        InspectorFeeLedger? lastLedger = null;
        var ordinal = 0;
        foreach (var deed in deeds)
        {
            ordinal++;
            var areaM2 = await _resolver.ResolvePropertyAreaM2Async(
                task, cancellationToken, deed.PropertyId);
 // Offices enter total area on the survey form; PO Area is often still empty.
 // Prefer that submitted area for tier pricing, and backfill the property row when empty.
            if (areaM2 is not > 0m)
            {
                areaM2 = InspectorFeeAccrualRules.TryParseSurveyOnSiteAreaM2(submission!.PayloadJson);
                if (areaM2 is > 0m && deed.PropertyId is Guid propertyId)
                    await BackfillPropertyAreaIfEmptyAsync(
                        propertyId, areaM2.Value, cancellationToken);
            }

            if (areaM2 is not > 0m)
                return (null, PricingErrors.PropertyAreaMissing);

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
                ?? await _ledgers.FindByIdentityAsync(
                    identity.TransactionId,
                    identity.DeedId,
                    identity.UserId,
                    cancellationToken);

            if (ledger is not null && InspectorFeeAccrualRules.IsAccrued(ledger))
            {
                lastLedger = ledger;
                continue;
            }

            if (ledger is null)
            {
                ledger = InspectorFeeAccrualRules.NewAccruedLedger(
                    task,
                    identity,
                    deed,
                    ordinal,
                    partyType,
                    agreedFee,
                    resolvedFee.PricingTableId,
                    now);
                _ledgers.AddLedger(ledger);
                existingForTask.Add(ledger);
            }
            else
            {
                InspectorFeeAccrualRules.RefreshAccruedLedger(
                    ledger,
                    task,
                    identity,
                    deed,
                    ordinal,
                    partyType,
                    agreedFee,
                    resolvedFee.PricingTableId,
                    now);
            }

            _ledgers.AddTransition(
                InspectorFeeAccrualRules.AccrualTransition(ledger, actorUserId, now));
            lastLedger = ledger;
        }

        if (lastLedger is null)
            return (null, PricingErrors.FeeUnresolved);

        await _ledgers.SaveChangesAsync(cancellationToken);
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
        var ledger = await _ledgers.FindByWorkflowTaskAsync(workflowTaskId, cancellationToken);
        if (ledger is null) return null;
        if (!SupervisingDepartments.CanManage(
                ledger.SupervisingDepartment,
                actorDepartment,
                canManageAllDepartments))
        {
            return null;
        }

        var fromStatus = ledger.BillingStatus;
        if (!InspectorFeeAccrualRules.TryApplyPatch(ledger, request)) return null;

        var kinds = await _lookup.GetWorkflowTaskKindsAsync(
            [workflowTaskId], cancellationToken);
        var taskKind = kinds.GetValueOrDefault(workflowTaskId);
        var isEmployee = InspectorFeeRules.IsEmployee(ledger.InspectorType);
        var discountApplied = InspectorFeeAccrualRules.DiscountApplied(ledger, request);

        InspectorFeeAccrualRules.ApplyStatusAfterPatch(
            ledger,
            taskKind,
            isEmployee,
            discountApplied);

        ledger.UpdatedAtUtc = _time.UtcNow();
        if (fromStatus != ledger.BillingStatus)
        {
            _ledgers.AddTransition(
                InspectorFeeAccrualRules.PatchTransition(ledger, fromStatus, _time.UtcNow()));
        }

        await _ledgers.SaveChangesAsync(cancellationToken);

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
        var candidates = await _ledgers.ListByWorkflowTaskNewestFirstAsync(
            workflowTaskId, cancellationToken);
        if (candidates.Count == 0)
            return (null, InspectorFeeAccrualRules.LedgerNotFoundError);

        var action = InspectorFeeAccrualRules.NormalizeAction(request.Action);
        var ledger = InspectorFeeAccrualRules.PickLedgerForTransition(
            candidates,
            action,
            actorAssigneeId)
            ?? candidates[0];

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

        await _ledgers.SaveChangesAsync(cancellationToken);
// Return the row for the ledger we just transitioned (not an arbitrary FirstOrDefault).
        var row = await GetByWorkflowTaskIdAsync(workflowTaskId, cancellationToken);
        return (row, null);
    }

    public async Task<BatchInspectorFeeTransitionResponseDto> BatchTransitionAsync(
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
                failed.Add(InspectorFeeAccrualRules.TransitionError(
                    rawId,
                    InspectorFeeAccrualRules.InvalidTaskIdError));
                continue;
            }

            var ledger = await _ledgers.FindByWorkflowTaskAsync(taskId, cancellationToken);
            if (ledger is null)
            {
                failed.Add(InspectorFeeAccrualRules.TransitionError(
                    rawId,
                    InspectorFeeAccrualRules.LedgerNotFoundError));
                continue;
            }

            var error = await _transitions.ApplyAsync(
                ledger,
                InspectorFeeAccrualRules.BatchLineRequest(request),
                actorUserId,
                actorAssigneeId,
                isOperationsManager,
                isFinancialOfficer,
                cancellationToken,
                actorDepartment: actorDepartment,
                canManageAllDepartments: canManageAllDepartments);

            if (error is not null)
            {
                failed.Add(InspectorFeeAccrualRules.TransitionError(rawId, error));
                continue;
            }

            var row = await GetByWorkflowTaskIdAsync(taskId, cancellationToken);
            if (row is not null) succeeded.Add(row);
        }

        if (succeeded.Count > 0)
            await _ledgers.SaveChangesAsync(cancellationToken);

        if (InspectorFeeAccrualRules.IsDisburseAction(request.Action) && succeeded.Count > 0)
        {
            await NotifyPartiesFeesDisbursedAsync(succeeded, cancellationToken);
        }

        return new BatchInspectorFeeTransitionResponseDto
        {
            Succeeded = succeeded,
            Failed = failed,
            DisbursementBatchId = request.DisbursementBatchId,
        };
    }

    public Task<CreateDisbursementBatchResponseDto> CreateDisbursementBatchAsync(
        CreateDisbursementBatchRequest request,
        string actorUserId,
        string? actorAssigneeId,
        CancellationToken cancellationToken = default)
    {
 //new disbursement batches are retired — use party billing statements.
        return Task.FromResult(InspectorFeeAccrualRules.RetiredDisbursementBatchResponse());
    }

    public async Task DeleteForWorkflowTaskIdsAsync(
        IEnumerable<Guid> workflowTaskIds,
        CancellationToken cancellationToken = default)
    {
        await _ledgers.DeleteForWorkflowTasksAsync(workflowTaskIds.ToList(), cancellationToken);
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

        await _notifications.CreateForUsersAsync(
            [userId],
            InspectorFeeAccrualRules.EmployeeDiscountNotification(ledger),
            cancellationToken);
    }

    private async Task NotifyPartiesFeesDisbursedAsync(
        IReadOnlyList<InspectorFeeRowDto> rows,
        CancellationToken cancellationToken)
    {
        var usersByAssignee = await _recipients.ResolveUserIdsForDistributionAssigneesAsync(
            InspectorFeeAccrualRules.DistinctAssigneeIds(rows),
            cancellationToken);
        var notifications =
            new List<(string UserId, CreateUserNotificationRequest Request)>();

        foreach (var row in rows)
        {
            if (string.IsNullOrWhiteSpace(row.AssigneeId)) continue;
            if (!usersByAssignee.TryGetValue(row.AssigneeId.Trim(), out var userId)) continue;

            notifications.Add((userId, InspectorFeeAccrualRules.FeeDisbursedNotification(row)));
        }

        await _notifications.CreateManyAsync(notifications, cancellationToken);
    }

    private async Task BackfillPropertyAreaIfEmptyAsync(
        Guid propertyId,
        decimal areaM2,
        CancellationToken cancellationToken)
    {
        await _commands.BackfillPropertyAreaIfEmptyAsync(propertyId, areaM2, cancellationToken);
    }
}

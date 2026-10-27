using RealEstateEval.Application;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Financial.Domain;
using RealEstateEval.Financial.Application.Rules;

namespace RealEstateEval.Financial.Application.Services;

/// <summary>
/// Engineering-office fee discounts (ruling of 2026-10-26): the specialist's proposal, the
/// supervisor's decision on it, and cancelling one party's whole fee on a transaction.
/// </summary>
public partial class InspectorFeeService
{
    /// <summary>
    /// A proposal on a task whose fee already accrued: the lines finance has not billed yet go
    /// back to the supervisor, clearing any earlier discount — the proposal replaces it.
    /// </summary>
    /// <remarks>
    /// <para><b>When it runs:</b> the specialist re-accepts a survey (e.g. after returning it for
    /// correction and the office resubmitting) and proposes a discount this time.</para>
    /// <para><b>How it works:</b> refuse when a proposal is already pending → pick the lines still
    /// open (<see cref="DiscountProposalRules.LinesOpenToProposal"/>) → validate against their fee →
    /// park each line in <c>sup-review</c> with an audit row → add the flag → save → notify.</para>
    /// <para><b>Edge cases:</b></para>
    /// <list type="bullet">
    /// <item>All lines already in a statement or paid → refused with an explanation; money that left
    /// the supervisor's reach cannot be re-opened by a proposal.</item>
    /// <item>A line cancelled in full or excluded is not "open" — found during live testing, where a
    /// late proposal reopened a cancelled line.</item>
    /// <item>A second proposal while one is pending is refused instead of stacking.</item>
    /// </list>
    /// </remarks>
    private async Task<(InspectorFeeRowDto? Row, string? Error)> ProposeOnAccruedLinesAsync(
        Guid workflowTaskId,
        IReadOnlyList<InspectorFeeLedger> ledgers,
        EngineeringSurveyDiscountProposalInput proposal,
        string actorUserId,
        CancellationToken cancellationToken)
    {
        // One open proposal per task: a second acceptance cannot stack another one on top.
        if ((await _ledgers.ListPendingProposalsAsync([workflowTaskId], cancellationToken)).Count > 0)
            return (null, DiscountProposalRules.PendingProposalBlocksError);

        // Only lines finance has not billed yet (and not already cancelled or excluded) can be
        // pulled back to the supervisor.
        var open = DiscountProposalRules.LinesOpenToProposal(ledgers);
        if (open.Count == 0)
            return (null, "لا يمكن اقتراح حسم — أتعاب هذه المهمة دخلت كشف فوترة أو صُرفت.");

        var proposalError = DiscountProposalRules.ValidateProposal(
            proposal.ProposedDiscountSar,
            proposal.DiscountReason,
            open.Sum(l => l.AgreedFeeSar));
        if (proposalError is not null)
            return (null, proposalError);

        var now = _time.UtcNow();
        foreach (var ledger in open)
        {
            var fromStatus = ledger.BillingStatus;
            DiscountProposalRules.SendToSupervisor(ledger, now);
            _ledgers.AddTransition(DiscountProposalRules.DecisionTransition(
                ledger, fromStatus, DiscountFlagStatuses.Pending, null, actorUserId, now));
        }

        var flag = DiscountProposalRules.NewFlag(
            open[0],
            proposal.ProposedDiscountSar!.Value,
            proposal.DiscountReason!,
            actorUserId,
            proposal.ProposedByName,
            now);
        _ledgers.AddDiscountFlag(flag);
        await _ledgers.SaveChangesAsync(cancellationToken);
        await NotifyDiscountProposedAsync(flag, cancellationToken);
        return (await GetByWorkflowTaskIdAsync(workflowTaskId, cancellationToken), null);
    }

    /// <summary>
    /// The supervisor's decision on the specialist's proposal: approve (proposed amount), amend
    /// (the amount agreed with the office) or waive (no discount). Every waiting line of the task
    /// then goes to finance, the proposal is closed, and the office is told the outcome.
    /// </summary>
    /// <remarks>
    /// <para><b>How it works:</b></para>
    /// <list type="number">
    /// <item>Loads the task's pending flag (newest, should there ever be more than one).</item>
    /// <item>Loads the task's lines still in <c>sup-review</c> and checks the actor may manage the
    /// department of every one of them.</item>
    /// <item><see cref="DiscountProposalRules.ResolveDecision"/> turns the decision into an amount and
    /// a final flag status.</item>
    /// <item><see cref="DiscountProposalRules.ApplyDecidedDiscount"/> spreads the amount over the
    /// lines, sends them to finance, and excludes a line left at zero net.</item>
    /// <item>One audit row per line, the flag is closed, save, and the office hears the outcome.</item>
    /// </list>
    /// <para><b>Edge cases:</b></para>
    /// <list type="bullet">
    /// <item>No pending flag, or no line still waiting (e.g. the line was suspended meanwhile) →
    /// «no pending proposal»; nothing changes.</item>
    /// <item>Engineering-survey fees belong to the valuation department, so a case-study section
    /// supervisor is refused; the valuation supervisor or an all-departments manager decides.</item>
    /// <item>Amend to zero / above the fee and unknown decisions are refused by the rule.</item>
    /// </list>
    /// </remarks>
    public async Task<(InspectorFeeRowDto? Row, string? Error)> ResolveDiscountProposalAsync(
        Guid workflowTaskId,
        ResolveDiscountProposalRequest request,
        string actorUserId,
        CancellationToken cancellationToken = default,
        string? actorDepartment = null,
        bool canManageAllDepartments = false)
    {
        var flag = (await _ledgers.ListPendingProposalsAsync([workflowTaskId], cancellationToken))
            .OrderByDescending(f => f.CreatedAtUtc)
            .FirstOrDefault();
        if (flag is null)
            return (null, DiscountProposalRules.NoPendingProposalError);

        // The decision belongs to the supervisor of the transaction's department (or an
        // all-departments manager) — checked on every line it will move.
        var ledgers = await _ledgers.ListByWorkflowTaskAsync(workflowTaskId, cancellationToken);
        var awaiting = DiscountProposalRules.AwaitingLines(ledgers);
        if (awaiting.Count == 0)
            return (null, DiscountProposalRules.NoPendingProposalError);
        if (awaiting.Any(l => !SupervisingDepartments.CanManage(
                l.SupervisingDepartment,
                actorDepartment,
                canManageAllDepartments)))
        {
            return (null, "هذا البند يتبع قسماً آخر — القرار لمشرف قسم المعاملة فقط.");
        }

        var (discount, status, error) = DiscountProposalRules.ResolveDecision(
            flag,
            request,
            awaiting.Sum(l => l.AgreedFeeSar));
        if (error is not null)
            return (null, error);

        // Write the decided amount over the task's lines (multi-deed tasks fill line by line), keep
        // the specialist's reason on them, and record one audit row per line.
        var now = _time.UtcNow();
        var fromStatuses = awaiting.ToDictionary(l => l.Id, l => l.BillingStatus);
        DiscountProposalRules.ApplyDecidedDiscount(awaiting, discount, flag.Reason, now);
        foreach (var ledger in awaiting)
        {
            _ledgers.AddTransition(DiscountProposalRules.DecisionTransition(
                ledger, fromStatuses[ledger.Id], status, request.Note, actorUserId, now));
        }

        DiscountProposalRules.CloseFlag(flag, status, discount, request.Note, actorUserId, now);

        await _ledgers.SaveChangesAsync(cancellationToken);
        await NotifyAssigneeAsync(
            flag.TargetAssigneeId,
            DiscountProposalRules.DecidedToOfficeNotification(
                flag,
                awaiting.Sum(l => InspectorFeeRules.NetFee(l.AgreedFeeSar, l.SupervisorDiscountSar))),
            cancellationToken);
        return (await GetByWorkflowTaskIdAsync(workflowTaskId, cancellationToken), null);
    }

    /// <summary>
    /// Cancels one party's whole fee on a transaction (typically an operationally complete one):
    /// every editable line is discounted in full, kept out of statements and sent to finance at zero
    /// net. Lines already in a statement, paid or suspended are left for finance and reported back.
    /// </summary>
    /// <remarks>
    /// <para><b>How it works:</b> validate PO, party and reason → load the party's lines on the PO
    /// (all tasks, all deeds) → department check on every line → split open / skipped → close any
    /// pending proposal on the open lines → discount each open line in full with an audit row → save
    /// → notify the party.</para>
    /// <para><b>Edge cases:</b></para>
    /// <list type="bullet">
    /// <item>Before this, cancelling a party on a multi-deed transaction meant discounting each line
    /// by hand; this does it in one step with one reason.</item>
    /// <item>A pending proposal on a cancelled line is closed as <c>amended</c> to the full fee, so it
    /// does not stay pending (and block new proposals) on a line that is already decided.</item>
    /// <item>Lines in a statement, paid or suspended are never touched (the statement total would
    /// drift); they come back in <c>Skipped</c> with their status so the supervisor knows why.</item>
    /// <item>Nothing open at all → refused with an explanation rather than a silent no-op.</item>
    /// <item>The zero-net lines are excluded from statements, so the office never gets a 0 SAR line.</item>
    /// </list>
    /// </remarks>
    public async Task<(WaivePartyFeesResultDto? Result, string? Error)> WaivePartyFeesAsync(
        string poNumber,
        WaivePartyFeesRequest request,
        string actorUserId,
        CancellationToken cancellationToken = default,
        string? actorDepartment = null,
        bool canManageAllDepartments = false)
    {
        if (string.IsNullOrWhiteSpace(poNumber) || string.IsNullOrWhiteSpace(request.AssigneeId))
            return (null, "حدّد المعاملة والطرف.");
        if (string.IsNullOrWhiteSpace(request.Reason) || request.Reason.Trim().Length < 3)
            return (null, "سبب إلغاء الأتعاب إلزامي.");

        var ledgers = await _ledgers.ListByPoAndAssigneeAsync(
            poNumber, request.AssigneeId, cancellationToken);
        if (ledgers.Count == 0)
            return (null, "لا توجد أتعاب لهذا الطرف على المعاملة.");
        if (ledgers.Any(l => !SupervisingDepartments.CanManage(
                l.SupervisingDepartment,
                actorDepartment,
                canManageAllDepartments)))
        {
            return (null, "أتعاب هذا الطرف تتبع قسماً آخر — الإلغاء لمشرف قسم المعاملة فقط.");
        }

        // Split the party's lines on the PO into the ones this may touch and the ones it must not.
        var (open, skipped) = DiscountProposalRules.SplitForWaive(ledgers);
        if (open.Count == 0)
        {
            return (null, "لا يوجد بند يمكن إلغاؤه — كل أتعاب هذا الطرف دخلت كشف فوترة أو صُرفت"
                + " أو موقوفة.");
        }

        var now = _time.UtcNow();
        var reason = request.Reason.Trim();
 // A pending proposal on these lines is overtaken by the full cancellation.
        var pending = await _ledgers.ListPendingProposalsAsync(
            open.Select(l => l.WorkflowTaskId).Distinct().ToList(),
            cancellationToken);
        foreach (var flag in pending)
        {
            var taskFee = open
                .Where(l => l.WorkflowTaskId == flag.WorkflowTaskId)
                .Sum(l => l.AgreedFeeSar);
            DiscountProposalRules.CloseFlag(
                flag, DiscountFlagStatuses.Amended, taskFee, reason, actorUserId, now);
        }

        foreach (var ledger in open)
        {
            var fromStatus = ledger.BillingStatus;
            DiscountProposalRules.WaiveLine(ledger, reason, now);
            _ledgers.AddTransition(DiscountProposalRules.WaiveTransition(
                ledger, fromStatus, reason, actorUserId, now));
        }

        await _ledgers.SaveChangesAsync(cancellationToken);
        await NotifyAssigneeAsync(
            request.AssigneeId,
            DiscountProposalRules.PartyFeesWaivedNotification(poNumber, open.Count, reason),
            cancellationToken);

        return (new WaivePartyFeesResultDto { WaivedCount = open.Count, Skipped = skipped }, null);
    }

    /// <summary>
    /// A new proposal: the office hears that a discount is under review with the supervisor, and the
    /// section supervisors are prompted to decide.
    /// </summary>
    /// <remarks>
    /// <b>Known limit:</b> the prompt goes to every section supervisor, not only the supervisor of the
    /// line's department (the recipient resolver has no department filter; billing-statement notices
    /// work the same way). Only a supervisor who can manage the department can act on it.
    /// </remarks>
    private async Task NotifyDiscountProposedAsync(
        DiscountFlag flag,
        CancellationToken cancellationToken)
    {
        var taskId = flag.WorkflowTaskId ?? Guid.Empty;
        await NotifyAssigneeAsync(
            flag.TargetAssigneeId,
            DiscountProposalRules.ProposedToOfficeNotification(
                flag.TransactionKey, taskId, flag.ProposedDiscountSar),
            cancellationToken);

        var supervisors = await _recipients.ResolveUserIdsWithPrototypeRoleAsync(
            "section-supervisor",
            cancellationToken);
        if (supervisors.Count > 0)
        {
            await _notifications.CreateForUsersAsync(
                supervisors,
                DiscountProposalRules.ProposedToSupervisorNotification(
                    flag.TransactionKey, taskId, flag.ProposedDiscountSar, flag.Reason),
                cancellationToken);
        }
    }

    /// <summary>Sends one notification to the user behind a distribution assignee, when there is one.</summary>
    /// <remarks>
    /// <b>Edge cases:</b> a party with no linked user is skipped quietly (the money change still
    /// stands). When several users share one assignee id, the resolver picks one — the same rule
    /// every other party notification follows.
    /// </remarks>
    private async Task NotifyAssigneeAsync(
        string? assigneeId,
        CreateUserNotificationRequest notification,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(assigneeId)) return;
        var usersByAssignee = await _recipients.ResolveUserIdsForDistributionAssigneesAsync(
            [assigneeId.Trim()],
            cancellationToken);
        if (!usersByAssignee.TryGetValue(assigneeId.Trim(), out var userId)
            || string.IsNullOrWhiteSpace(userId))
        {
            return;
        }

        await _notifications.CreateForUsersAsync([userId], notification, cancellationToken);
    }
}

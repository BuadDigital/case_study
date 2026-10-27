using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Financial.Domain;

namespace RealEstateEval.Financial.Application.Rules;

/// <summary>
/// The specialist's discount proposal on an engineering-survey fee and the supervisor's decision
/// on it. The proposal is made per task (one acceptance); a multi-deed task spreads the decided
/// amount over its deed lines in ordinal order, filling each line before the next.
/// </summary>
/// <remarks>
/// <para><b>How the flow works (ruling of 2026-10-26).</b></para>
/// <list type="number">
/// <item>The specialist accepts the office's outputs. Without a proposal the fee is priced and goes
/// straight to finance. With one, the same fee lines wait in <c>sup-review</c> at full amount and a
/// pending <see cref="DiscountFlag"/> records the proposed amount and reason.</item>
/// <item>The office is told the discount is under review; the supervisors are prompted.</item>
/// <item>The department supervisor talks to the office outside the system, then approves, amends
/// or waives. The decided amount is written on the lines, they go to finance, the flag closes.</item>
/// </list>
/// <para>Everything here is pure: no EF, no I/O. <c>InspectorFeeService</c> loads the rows, calls
/// these rules, saves, and sends the notifications.</para>
/// </remarks>
public static class DiscountProposalRules
{
    public const string NoPendingProposalError = "لا يوجد حسم مقترح بانتظار القرار.";
    public const string PendingProposalBlocksError = "على هذا البند حسم مقترح بانتظار قرار المشرف — قرّر فيه أولاً.";
    public const string UnknownDecisionError = "قرار غير معروف — اعتماد أو تعديل أو سماح.";

    /// <summary>A proposal exists only when the specialist sent a positive amount.</summary>
    /// <remarks>
    /// <b>Edge case:</b> a client may send <c>0</c> or a negative amount (e.g. the dialog reset to
    /// zero). That is treated as "no proposal", so the acceptance behaves like a plain accept and
    /// the fee goes to finance — it never parks a line with the supervisor for a zero discount.
    /// </remarks>
    public static bool HasProposal(decimal? proposedDiscountSar) => proposedDiscountSar is > 0m;

    /// <summary>
    /// Validates the proposal against the fee it would cut. The reason is required, and the
    /// amount may not exceed the task's total fee.
    /// </summary>
    /// <remarks>
    /// <para><b>How it works:</b> no proposal → <c>null</c> (nothing to check). Otherwise it reuses
    /// <see cref="InspectorFeeBillingRules.ValidateDiscount(decimal, string?, decimal?, out string?)"/>
    /// — the same rule a direct supervisor discount follows — and returns its Arabic error.</para>
    /// <para><b>Edge cases:</b></para>
    /// <list type="bullet">
    /// <item>The specialist does not see the priced fee when proposing (the line does not exist yet),
    /// so the cap can only be checked here, after pricing. The service validates <i>before</i>
    /// <c>SaveChanges</c>, so a refused proposal leaves nothing accrued — the acceptance can simply
    /// be retried with a smaller amount.</item>
    /// <item><paramref name="totalFeeSar"/> is the sum over the task's deed lines, so a multi-deed
    /// survey can be discounted up to its whole fee, not just one deed's.</item>
    /// </list>
    /// </remarks>
    public static string? ValidateProposal(
        decimal? proposedDiscountSar,
        string? reason,
        decimal totalFeeSar)
    {
        if (!HasProposal(proposedDiscountSar)) return null;
        return InspectorFeeBillingRules.ValidateDiscount(
            proposedDiscountSar!.Value,
            reason,
            totalFeeSar,
            out var error)
            ? null
            : error;
    }

    /// <summary>
    /// The pending proposal row for a task. It is keyed by the task (one acceptance), and carries
    /// the PO, the party and the proposer's name so the supervisor sees who asked and why.
    /// </summary>
    /// <remarks>
    /// <para><b>How it works:</b> any ledger of the task can be passed — PO, task id and assignee are
    /// the same on all its deed lines. The proposer's display name is stamped now so the supervisor
    /// list does not need an identity lookup per row.</para>
    /// <para><b>Edge case:</b> a second pending row for the same task is impossible — the callers
    /// refuse it first, and the filtered unique index <c>UX_DiscountFlags_PendingTask</c> (one
    /// <c>pending</c> row per task) backs that up at the database.</para>
    /// </remarks>
    public static DiscountFlag NewFlag(
        InspectorFeeLedger ledger,
        decimal proposedDiscountSar,
        string reason,
        string actorUserId,
        string? actorName,
        DateTime nowUtc) => new()
        {
            Id = Guid.NewGuid(),
            TransactionKey = ledger.PoNumber.Trim(),
            WorkflowTaskId = ledger.WorkflowTaskId,
            TargetAssigneeId = ledger.AssigneeId?.Trim() ?? "",
            FlaggedByUserId = actorUserId,
            FlaggedByName = string.IsNullOrWhiteSpace(actorName) ? null : actorName.Trim(),
            Reason = reason.Trim(),
            ProposedDiscountSar = proposedDiscountSar,
            Status = DiscountFlagStatuses.Pending,
            CreatedAtUtc = nowUtc,
            UpdatedAtUtc = nowUtc,
        };

    /// <summary>
    /// The discount a decision applies and the status it leaves on the proposal, or an error.
    /// Approve keeps the proposed amount, amend takes the supervisor's amount, waive pays in full.
    /// </summary>
    /// <remarks>
    /// <para><b>How it works:</b> the decision string is trimmed and lower-cased, then mapped:</para>
    /// <list type="bullet">
    /// <item><c>approve</c> → the proposed amount, status <c>approved</c>.</item>
    /// <item><c>amend</c> → the supervisor's <see cref="ResolveDiscountProposalRequest.AmountSar"/>,
    /// status <c>amended</c>.</item>
    /// <item><c>waive</c> → zero, status <c>waived</c> (the full fee is paid).</item>
    /// </list>
    /// <para><b>Edge cases:</b></para>
    /// <list type="bullet">
    /// <item>Amend with no amount or zero is refused with a hint to choose «سماح» — otherwise an
    /// "amended to zero" would be indistinguishable from a waive in the audit trail.</item>
    /// <item>Amend above the task's fee is refused (same cap as the proposal).</item>
    /// <item>An unknown decision returns <see cref="UnknownDecisionError"/> instead of guessing.</item>
    /// </list>
    /// </remarks>
    public static (decimal Discount, string Status, string? Error) ResolveDecision(
        DiscountFlag flag,
        ResolveDiscountProposalRequest request,
        decimal totalFeeSar)
    {
        var decision = (request.Decision ?? "").Trim().ToLowerInvariant();
        switch (decision)
        {
            case DiscountProposalDecisions.Approve:
                return (flag.ProposedDiscountSar, DiscountFlagStatuses.Approved, null);
            case DiscountProposalDecisions.Waive:
                return (0m, DiscountFlagStatuses.Waived, null);
            case DiscountProposalDecisions.Amend:
                if (request.AmountSar is not > 0m)
                    return (0m, "", "أدخل مبلغ الحسم المعدّل — أو اختر السماح للتنازل عن الحسم.");
                if (request.AmountSar.Value > totalFeeSar)
                    return (0m, "", "الحسم لا يتجاوز الأتعاب المتفق عليها.");
                return (request.AmountSar.Value, DiscountFlagStatuses.Amended, null);
            default:
                return (0m, "", UnknownDecisionError);
        }
    }

    /// <summary>
    /// Writes a total discount over a task's deed lines, filling each in ordinal order, and sends
    /// every line to finance. A zero total clears the discount (waive).
    /// </summary>
    /// <remarks>
    /// <para><b>How it works:</b> lines are ordered by property ordinal (then creation time, for a
    /// stable order). Each line takes <c>min(remaining, its agreed fee)</c> and the rest carries to
    /// the next line. The specialist's reason is copied onto every line that got a share; a line with
    /// no share has its reason cleared. Every line moves to <c>at-finance</c>.</para>
    /// <para><b>Edge cases:</b></para>
    /// <list type="bullet">
    /// <item>Multi-deed survey (one task, several deed ledgers): the proposal is one amount for the
    /// task, so it must be split. Filling line by line keeps every line's net non-negative, which a
    /// proportional split with rounding would not guarantee.</item>
    /// <item>A line discounted to zero would otherwise enter the month-end statement as a 0 SAR line
    /// — <see cref="KeepZeroNetOutOfStatements"/> excludes it.</item>
    /// </list>
    /// </remarks>
    public static void ApplyDecidedDiscount(
        IReadOnlyList<InspectorFeeLedger> ledgers,
        decimal totalDiscountSar,
        string? reason,
        DateTime nowUtc)
    {
        var remaining = Math.Max(0m, totalDiscountSar);
        foreach (var ledger in ledgers.OrderBy(l => l.PropertyOrdinal).ThenBy(l => l.CreatedAtUtc))
        {
            var share = Math.Min(remaining, Math.Max(0m, ledger.AgreedFeeSar));
            remaining -= share;
            ledger.SupervisorDiscountSar = share;
            ledger.DiscountReason = share > 0m && !string.IsNullOrWhiteSpace(reason)
                ? reason.Trim()
                : null;
            ledger.BillingStatus = InspectorFeeBillingStatus.AtFinance;
            ledger.UpdatedAtUtc = nowUtc;
            KeepZeroNetOutOfStatements(ledger, ledger.DiscountReason);
        }
    }

    /// <summary>
    /// A line discounted down to nothing has nothing to pay: it stays visible at finance but is
    /// excluded from billing statements, so no office receives a zero-riyal line.
    /// </summary>
    /// <remarks>
    /// <para><b>How it works:</b> if the agreed fee is positive and the net is zero, the line is
    /// flagged <c>ExcludedFromBatch</c> with the given reason (or «حسم كامل الأتعاب»). The statement
    /// builder and the ready-lines list already skip excluded lines, so no new rule was needed there.</para>
    /// <para><b>Edge cases:</b> an unpriced line (agreed fee 0) is left alone — it is not "fully
    /// discounted", it is just not priced. A partially discounted line is left alone too.</para>
    /// </remarks>
    public static void KeepZeroNetOutOfStatements(InspectorFeeLedger ledger, string? reason)
    {
        if (ledger.AgreedFeeSar <= 0m
            || InspectorFeeRules.NetFee(ledger.AgreedFeeSar, ledger.SupervisorDiscountSar) > 0m)
        {
            return;
        }

        ledger.ExcludedFromBatch = true;
        ledger.ExclusionReason = string.IsNullOrWhiteSpace(reason)
            ? "حسم كامل الأتعاب"
            : reason.Trim();
    }

    /// <summary>Lines still waiting on the decision — the ones the decision may move.</summary>
    /// <remarks>
    /// <b>Edge case:</b> a deed line of the task that was already at finance before the proposal
    /// (partial re-accrual) is not in <c>sup-review</c>, so the decision never touches it and its fee
    /// is not counted in the cap.
    /// </remarks>
    public static List<InspectorFeeLedger> AwaitingLines(IEnumerable<InspectorFeeLedger> ledgers) =>
        ledgers.Where(l => l.BillingStatus == InspectorFeeBillingStatus.SupReview).ToList();

    /// <summary>
    /// Accrued lines finance has not billed yet — a late proposal can still reach them. A line kept
    /// out of statements (cancelled in full, or excluded by the supervisor) is already decided.
    /// </summary>
    /// <remarks>
    /// <para><b>How it works:</b> used when the specialist re-accepts a task whose fee already
    /// accrued and sends a proposal this time. Only <c>draft</c>, <c>at-finance</c> and
    /// <c>deferred</c> lines qualify — a line in a statement, paid or suspended is out of reach.</para>
    /// <para><b>Edge case fixed during live testing:</b> a line the supervisor had cancelled in full
    /// (waive-party) is still <c>at-finance</c>, so a late proposal reopened it: the discount went back
    /// to zero but the exclusion flag stayed, and the decided amount would never be billed. Excluded
    /// lines are now skipped here, so the proposal is refused instead.</para>
    /// </remarks>
    public static List<InspectorFeeLedger> LinesOpenToProposal(IEnumerable<InspectorFeeLedger> ledgers) =>
        ledgers
            .Where(l => !l.ExcludedFromBatch
                && l.BillingStatus is InspectorFeeBillingStatus.Draft
                    or InspectorFeeBillingStatus.AtFinance
                    or InspectorFeeBillingStatus.Deferred)
            .ToList();

    /// <summary>A new proposal replaces any earlier discount and parks the line with the supervisor.</summary>
    /// <remarks>
    /// <b>Why the discount is cleared:</b> the line must wait at full amount, so finance totals and
    /// the office see the undecided fee; the decision then writes the one decided amount. Keeping an
    /// old discount would apply two discounts once the new one is decided.
    /// </remarks>
    public static void SendToSupervisor(InspectorFeeLedger ledger, DateTime nowUtc)
    {
        ledger.SupervisorDiscountSar = 0m;
        ledger.DiscountReason = null;
        ledger.BillingStatus = InspectorFeeBillingStatus.SupReview;
        ledger.UpdatedAtUtc = nowUtc;
    }

    /// <summary>Stamps the decision on the proposal: final status, applied amount, who and when.</summary>
    /// <remarks>
    /// Closing the flag (status no longer <c>pending</c>) is what frees the task: the filtered
    /// unique index allows a new proposal, and the fee row stops showing the proposal.
    /// </remarks>
    public static void CloseFlag(
        DiscountFlag flag,
        string status,
        decimal resolvedDiscountSar,
        string? note,
        string actorUserId,
        DateTime nowUtc)
    {
        flag.Status = status;
        flag.ResolvedDiscountSar = resolvedDiscountSar;
        flag.ResolvedByUserId = actorUserId;
        flag.ResolvedAtUtc = nowUtc;
        flag.ResolutionNote = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
        flag.UpdatedAtUtc = nowUtc;
    }

    // ---- cancel a party's whole fee on a transaction ----

    /// <summary>
    /// Lines a whole-transaction cancellation may touch, and the ones it must leave alone because
    /// they are already in a statement, paid, or withheld.
    /// </summary>
    /// <remarks>
    /// <para><b>How it works:</b> the split follows
    /// <see cref="InspectorFeeBillingRules.IsEditableStatus"/>. The skipped lines are returned with
    /// their status label so the supervisor sees why they were not cancelled.</para>
    /// <para><b>Edge case:</b> cancelling a line that is already in an issued statement would make
    /// the statement total drift from its lines. Only finance can pull a line out of a statement
    /// (by cancelling the statement), so those lines are reported, never changed.</para>
    /// </remarks>
    public static (List<InspectorFeeLedger> Open, List<WaivePartyFeesSkippedLineDto> Skipped) SplitForWaive(
        IReadOnlyList<InspectorFeeLedger> ledgers)
    {
        var open = ledgers
            .Where(l => InspectorFeeBillingRules.IsEditableStatus(l.BillingStatus))
            .ToList();
        var skipped = ledgers
            .Where(l => !InspectorFeeBillingRules.IsEditableStatus(l.BillingStatus))
            .Select(l => new WaivePartyFeesSkippedLineDto
            {
                WorkflowTaskId = l.WorkflowTaskId.ToString(),
                PropertyId = l.PropertyId?.ToString() ?? "",
                BillingStatus = l.BillingStatus,
                BillingStatusLabel = InspectorFeeBillingRules.StatusLabel(l.BillingStatus),
            })
            .ToList();
        return (open, skipped);
    }

    /// <summary>The full fee is discounted, so the line reaches finance at zero net.</summary>
    /// <remarks>
    /// The line is sent to <c>at-finance</c> (so it leaves every supervisor queue) and excluded from
    /// statements by <see cref="KeepZeroNetOutOfStatements"/>. The reason doubles as the discount
    /// reason and the exclusion reason, so finance sees one consistent explanation.
    /// </remarks>
    public static void WaiveLine(InspectorFeeLedger ledger, string reason, DateTime nowUtc)
    {
        ledger.SupervisorDiscountSar = Math.Max(0m, ledger.AgreedFeeSar);
        ledger.DiscountReason = reason.Trim();
        ledger.BillingStatus = InspectorFeeBillingStatus.AtFinance;
        ledger.UpdatedAtUtc = nowUtc;
        KeepZeroNetOutOfStatements(ledger, reason);
    }

    /// <summary>The audit row of a whole-transaction cancellation, with the supervisor's reason.</summary>
    public static InspectorFeeTransition WaiveTransition(
        InspectorFeeLedger ledger,
        string fromStatus,
        string reason,
        string actorUserId,
        DateTime nowUtc) => new()
        {
            Id = Guid.NewGuid(),
            WorkflowTaskId = ledger.WorkflowTaskId,
            FromStatus = fromStatus,
            ToStatus = ledger.BillingStatus,
            Reason = $"إلغاء أتعاب الطرف على المعاملة — {reason.Trim()}",
            ActorUserId = actorUserId,
            CreatedAtUtc = nowUtc,
        };

    /// <summary>The audit wording of a proposal state, used as the transition reason.</summary>
    /// <remarks>Any status that is not a decision (i.e. <c>pending</c>) reads «حسم مقترح».</remarks>
    public static string DecisionLabel(string status) => status switch
    {
        DiscountFlagStatuses.Approved => "اعتُمد الحسم",
        DiscountFlagStatuses.Amended => "عُدّل الحسم",
        DiscountFlagStatuses.Waived => "سُمح بالحسم",
        _ => "حسم مقترح",
    };

    /// <summary>
    /// The audit row a proposal writes on each of its lines — when it parks a line with the
    /// supervisor and again when the supervisor decides (with the decision and optional note).
    /// </summary>
    /// <remarks>
    /// <c>ToStatus</c> is read from the ledger, so call this <i>after</i> the line was moved and pass
    /// the status it came from as <paramref name="fromStatus"/>.
    /// </remarks>
    public static InspectorFeeTransition DecisionTransition(
        InspectorFeeLedger ledger,
        string fromStatus,
        string flagStatus,
        string? note,
        string actorUserId,
        DateTime nowUtc) => new()
        {
            Id = Guid.NewGuid(),
            WorkflowTaskId = ledger.WorkflowTaskId,
            FromStatus = fromStatus,
            ToStatus = ledger.BillingStatus,
            Reason = string.IsNullOrWhiteSpace(note)
                ? DecisionLabel(flagStatus)
                : $"{DecisionLabel(flagStatus)} — {note.Trim()}",
            ActorUserId = actorUserId,
            CreatedAtUtc = nowUtc,
        };

    // ---- notifications ----

    /// <summary>
    /// The office is told, not asked: a discount is possible and under review, and the supervisor
    /// will contact it before deciding.
    /// </summary>
    /// <remarks>
    /// <c>SourceEvent</c> is keyed by the task, so a retried acceptance does not notify twice.
    /// </remarks>
    public static CreateUserNotificationRequest ProposedToOfficeNotification(
        string poNumber,
        Guid workflowTaskId,
        decimal proposedDiscountSar) => new()
        {
            Title = "حسم محتمل على أتعابك",
            Body =
                $"اقتُرح حسم {proposedDiscountSar:N0} ر.س من أتعاب أمر العمل {poNumber}"
                + " — قيد المراجعة مع المشرف، وسيتواصل معك قبل القرار.",
            Tone = "warning",
            Href = "/party-fees",
            Category = "financial",
            EntityType = "task",
            EntityId = workflowTaskId.ToString(),
            SourceEvent = $"fee-discount-proposed:{workflowTaskId:N}",
        };

    /// <summary>The supervisor's prompt to decide, with the amount and the specialist's reason.</summary>
    public static CreateUserNotificationRequest ProposedToSupervisorNotification(
        string poNumber,
        Guid workflowTaskId,
        decimal proposedDiscountSar,
        string reason) => new()
        {
            Title = "حسم مقترح بانتظار قرارك",
            Body =
                $"اقترح الأخصائي حسم {proposedDiscountSar:N0} ر.س من أتعاب المكتب الهندسي"
                + $" في أمر العمل {poNumber} — السبب: {reason.Trim()}.",
            Tone = "warning",
            Href = "/party-fees",
            Category = "financial",
            EntityType = "task",
            EntityId = workflowTaskId.ToString(),
            SourceEvent = $"fee-discount-proposed-sup:{workflowTaskId:N}",
        };

    /// <summary>The outcome for the office: the decided discount and net, or the full fee when waived.</summary>
    /// <remarks>
    /// Keyed by the flag id (not the task), so a later proposal on the same task and its decision
    /// produce their own notification instead of being de-duplicated away.
    /// </remarks>
    public static CreateUserNotificationRequest DecidedToOfficeNotification(
        DiscountFlag flag,
        decimal netFeeSar) => new()
        {
            Title = flag.Status == DiscountFlagStatuses.Waived
                ? "لا حسم على أتعابك"
                : "تقرّر الحسم على أتعابك",
            Body = flag.Status == DiscountFlagStatuses.Waived
                ? $"تنازل المشرف عن الحسم المقترح في أمر العمل {flag.TransactionKey}"
                  + $" — الأتعاب كاملة {netFeeSar:N0} ر.س، والبند جاهز للفوترة."
                : $"قرّر المشرف حسم {flag.ResolvedDiscountSar ?? 0m:N0} ر.س في أمر العمل"
                  + $" {flag.TransactionKey} — الصافي {netFeeSar:N0} ر.س، والبند جاهز للفوترة.",
            Tone = flag.Status == DiscountFlagStatuses.Waived ? "success" : "info",
            Href = "/party-fees",
            Category = "financial",
            EntityType = "task",
            EntityId = flag.WorkflowTaskId?.ToString(),
            SourceEvent = $"fee-discount-decided:{flag.Id:N}",
        };

    /// <summary>The party learns its fee on the transaction was cancelled, and why.</summary>
    public static CreateUserNotificationRequest PartyFeesWaivedNotification(
        string poNumber,
        int lineCount,
        string reason) => new()
        {
            Title = "أُلغيت أتعابك على معاملة",
            Body =
                $"ألغى المشرف أتعابك على أمر العمل {poNumber} ({lineCount} بند)"
                + $" — السبب: {reason.Trim()}.",
            Tone = "warning",
            Href = "/party-fees",
            Category = "financial",
            SourceEvent = $"fee-party-waived:{poNumber.Trim()}:{lineCount}",
        };
}

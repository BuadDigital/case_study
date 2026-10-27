using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Domain;
using RealEstateEval.Financial.Application.Abstractions;
using RealEstateEval.Financial.Domain;

namespace RealEstateEval.Financial.Application.Rules;

/// <summary>
/// Inspector-fee decisions that need no storage: when a survey fee may accrue, the shape of the
/// ledger row and its audit trail, what a patch is allowed to change and where it lands, which of
/// several twin ledgers an actor may transition, and the notifications a change emits.
/// </summary>
public static class InspectorFeeAccrualRules
{
    public const string AccrualReason = "استحقاق عند قبول الأخصائي لمخرجات الرفع المساحي";
    public const string TaskNotFoundError = "المهمة غير موجودة.";
    public const string LedgerNotFoundError = "سجل الأتعاب غير موجود.";
    public const string InvalidTaskIdError = "معرّف مهمة غير صالح.";

    /// <summary>Accrual is only for a completed survey task whose outputs were submitted.</summary>
    public static string? ValidateEngineeringSurveyAccrual(
        WorkflowTask task,
        PartyTaskSubmission? submission)
    {
        if (task.Kind != WorkflowTaskKind.EngineeringSurvey)
            return "الاستحقاق خاص بمهام الرفع المساحي فقط.";
        if (submission is null || submission.Status != PartyTaskSubmissionStatus.Submitted)
            return "لا يمكن الاستحقاق قبل إرسال المخرجات وقبولها.";
        return task.Status != WorkflowTaskStatus.Completed
            ? "مهمة الرفع المساحي غير مكتملة."
            : null;
    }

    /// <summary>A ledger row that already carries an accrued, priced fee is never re-accrued.</summary>
    public static bool IsAccrued(InspectorFeeLedger ledger) =>
        ledger.AccruedAtUtc is not null && ledger.AgreedFeeSar > 0m;

    /// <summary>Idempotence: every target deed already accrued, so the task is done.</summary>
    public static bool AllDeedsAccrued(
        IReadOnlyList<InspectorFeeDeedTarget> deeds,
        IReadOnlyList<InspectorFeeLedger> existingForTask) =>
        deeds.Count > 0
        && deeds.All(d => existingForTask.Any(l => l.DeedId == d.DeedId && IsAccrued(l)));

    /// <summary>A deed of the task itself keeps the task ordinal; extra deeds count on from one.</summary>
    public static int PropertyOrdinalFor(WorkflowTask task, InspectorFeeDeedTarget deed, int ordinal) =>
        deed.PropertyId == task.PropertyId ? task.PropertyOrdinal : ordinal;

    /// <summary>
    /// Where a freshly accrued survey line lands: straight to finance, or to the supervisor when
    /// the specialist proposed a discount that is still waiting for a decision.
    /// </summary>
    /// <remarks>
    /// The single place that decides the accrual status, shared by <see cref="NewAccruedLedger"/> and
    /// <see cref="RefreshAccruedLedger"/> so a new line and a re-accrued line can never disagree.
    /// </remarks>
    public static string AccruedStatus(bool awaitsDiscountDecision) =>
        awaitsDiscountDecision
            ? InspectorFeeBillingStatus.SupReview
            : InspectorFeeBillingStatus.AtFinance;

    /// <summary>A brand-new accrued ledger line for one deed of a survey task.</summary>
    /// <remarks>
    /// <para><b>How it works:</b> the line is created priced (agreed fee + the pricing table it came
    /// from), stamped accrued now, with no discount. <paramref name="awaitsDiscountDecision"/> picks
    /// the status through <see cref="AccruedStatus"/>: <c>at-finance</c> for a plain acceptance,
    /// <c>sup-review</c> when the specialist proposed a discount.</para>
    /// <para><b>Edge case:</b> even with a proposal the discount stays zero here — the proposal lives
    /// on the <see cref="DiscountFlag"/>, and only the supervisor's decision writes a discount.</para>
    /// </remarks>
    public static InspectorFeeLedger NewAccruedLedger(
        WorkflowTask task,
        (Guid TransactionId, Guid DeedId, string UserId) identity,
        InspectorFeeDeedTarget deed,
        int ordinal,
        string partyType,
        decimal agreedFeeSar,
        Guid? pricingTableId,
        DateTime nowUtc,
        bool awaitsDiscountDecision = false) => new()
        {
            Id = Guid.NewGuid(),
            TransactionId = identity.TransactionId,
            DeedId = identity.DeedId,
            UserId = identity.UserId,
            WorkflowTaskId = task.Id,
            PoNumber = task.PoNumber.Trim(),
            PropertyId = deed.PropertyId,
            PropertyOrdinal = PropertyOrdinalFor(task, deed, ordinal),
            AssigneeId = task.AssigneeId,
            InspectorType = partyType,
            SupervisingDepartment = SupervisingDepartments.ForTaskKind(task.Kind),
            AgreedFeeSar = agreedFeeSar,
            PricingTableId = pricingTableId,
            SupervisorDiscountSar = 0m,
            DiscountReason = null,
            BillingStatus = AccruedStatus(awaitsDiscountDecision),
            ExcludedFromBatch = false,
            ExclusionReason = null,
            ReturnTo = null,
            DisbursementBatchId = null,
            DisbursementVoucher = null,
            AccruedAtUtc = nowUtc,
            CreatedAtUtc = nowUtc,
            UpdatedAtUtc = nowUtc,
        };

    /// <summary>
    /// Re-accrues an existing line onto the current identity and price. A new discount proposal
    /// clears the old discount and waits for the supervisor; otherwise a discount the supervisor
    /// already set stays and the line goes straight back to finance.
    /// </summary>
    /// <remarks>
    /// <para><b>How it works:</b> used when a ledger row already exists for the deed but was never
    /// priced (e.g. opened before acceptance). Identity, party type, department and price are
    /// refreshed; then the discount and the status are settled as described above.</para>
    /// <para><b>Edge case fixed:</b> this used to send a discounted line to the retired
    /// <c>office-review</c> state for the office to approve. A supervisor discount is final now, so
    /// the line goes to finance; only a new proposal sends it to the supervisor.</para>
    /// </remarks>
    public static void RefreshAccruedLedger(
        InspectorFeeLedger ledger,
        WorkflowTask task,
        (Guid TransactionId, Guid DeedId, string UserId) identity,
        InspectorFeeDeedTarget deed,
        int ordinal,
        string partyType,
        decimal agreedFeeSar,
        Guid? pricingTableId,
        DateTime nowUtc,
        bool awaitsDiscountDecision = false)
    {
        ledger.TransactionId = identity.TransactionId;
        ledger.DeedId = identity.DeedId;
        ledger.UserId = identity.UserId;
        ledger.AgreedFeeSar = agreedFeeSar;
        ledger.PricingTableId = pricingTableId;
        ledger.InspectorType = partyType;
        ledger.SupervisingDepartment = SupervisingDepartments.ForTaskKind(task.Kind);
        ledger.AssigneeId = task.AssigneeId;
        ledger.PropertyId = deed.PropertyId;
        ledger.PropertyOrdinal = PropertyOrdinalFor(task, deed, ordinal);
        ledger.PoNumber = task.PoNumber.Trim();
        if (awaitsDiscountDecision || ledger.SupervisorDiscountSar <= 0m)
        {
            ledger.SupervisorDiscountSar = 0m;
            ledger.DiscountReason = null;
        }

        ledger.BillingStatus = AccruedStatus(awaitsDiscountDecision);

        ledger.AccruedAtUtc = nowUtc;
        ledger.UpdatedAtUtc = nowUtc;
    }

    /// <summary>The audit row an accrual writes; there is no prior status to name.</summary>
    public static InspectorFeeTransition AccrualTransition(
        InspectorFeeLedger ledger,
        string actorUserId,
        DateTime nowUtc) => new()
        {
            Id = Guid.NewGuid(),
            WorkflowTaskId = ledger.WorkflowTaskId,
            FromStatus = "—",
            ToStatus = ledger.BillingStatus,
            Reason = AccrualReason,
            ActorUserId = actorUserId,
            CreatedAtUtc = nowUtc,
        };

    /// <summary>Reads the total area an engineering-survey submission reported on site.</summary>
    public static decimal? TryParseSurveyOnSiteAreaM2(string payloadJson)
    {
        if (string.IsNullOrWhiteSpace(payloadJson)) return null;
        try
        {
            using var doc = System.Text.Json.JsonDocument.Parse(payloadJson);
            var raw = PartyTaskSubmissionPayloadRules.GetString(doc.RootElement, "onSiteAreaSqm");
            return EngineeringSurveyFeeRules.TryParseAreaM2(raw, out var area) ? area : null;
        }
        catch (System.Text.Json.JsonException)
        {
            return null;
        }
    }

    // ---- patch ----

    /// <summary>
    /// Applies the editable half of a patch to the ledger. Returns false when the request is not
    /// allowed at all (wrong status, hand-priced override on a table-priced row, missing exclusion
    /// reason, discount without a reason) and the caller must abandon the write.
    /// </summary>
    /// <remarks>
    /// The discount branch used to clear the dispute negotiation deadline when a disputed discount
    /// changed. The dispute state and its deadline are retired, so the discount is simply stored
    /// (never negative). A line with a pending proposal never reaches here with a discount — the
    /// service refuses that patch first.
    /// </remarks>
    public static bool TryApplyPatch(InspectorFeeLedger ledger, PatchInspectorFeeRequest request)
    {
        if (!InspectorFeeBillingRules.IsEditableStatus(ledger.BillingStatus)) return false;

        if (request.AgreedFeeSar.HasValue)
        {
            if (!InspectorFeeRules.IsEmployee(ledger.InspectorType)) return false;
 // Flat-priced incentives keep their table stamp; hand override is only for the legacy
 // zero-draft rows that never resolved from a flat schedule.
            if (ledger.PricingTableId is not null) return false;
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
            if (!ledger.ExcludedFromBatch) ledger.ExclusionReason = null;
        }

        if (request.ExclusionReason is not null)
            ledger.ExclusionReason = request.ExclusionReason.Trim();

        if (ledger.ExcludedFromBatch && string.IsNullOrWhiteSpace(ledger.ExclusionReason))
            return false;

        if (ledger.SupervisorDiscountSar <= 0)
            ledger.DiscountReason = null;

        return InspectorFeeBillingRules.ValidateDiscount(
            ledger.SupervisorDiscountSar,
            ledger.DiscountReason,
            ledger.AgreedFeeSar,
            out _);
    }

    /// <summary>A patch counts as a discount only when the caller actually sent a positive one.</summary>
    public static bool DiscountApplied(InspectorFeeLedger ledger, PatchInspectorFeeRequest request) =>
        request.SupervisorDiscountSar.HasValue && ledger.SupervisorDiscountSar > 0m;

    /// <summary>
    /// Where a patched line lands. A supervisor discount is final for employees and for
    /// engineering offices alike — the office is told, not asked — so the line goes to finance.
    /// An accrued survey line left undiscounted also belongs at finance.
    /// </summary>
    /// <remarks>
    /// <para><b>How it works:</b></para>
    /// <list type="number">
    /// <item>Employee, or an accrued engineering-survey line, that received a discount while in
    /// draft / sup-review / at-finance / returned / inquiry → <c>at-finance</c>.</item>
    /// <item>An accrued survey line still in <c>draft</c> → <c>at-finance</c> (survey fees never wait
    /// in draft; they are payable from acceptance).</item>
    /// <item>Anything else is left where it is.</item>
    /// </list>
    /// <para><b>Edge cases:</b></para>
    /// <list type="bullet">
    /// <item>Before the ruling, a discounted survey line went to <c>office-review</c> and waited for
    /// the office. That loop is gone; the discount goes to finance and the office is notified.</item>
    /// <item>A cooperator field-inspection line is not moved: its own submit/approve flow decides.</item>
    /// <item>An unaccrued survey line (no acceptance yet) is not moved: it has no payable fee.</item>
    /// </list>
    /// </remarks>
    public static void ApplyStatusAfterPatch(
        InspectorFeeLedger ledger,
        WorkflowTaskKind taskKind,
        bool isEmployee,
        bool discountApplied)
    {
        var isSurvey = !isEmployee
            && taskKind == WorkflowTaskKind.EngineeringSurvey
            && ledger.AccruedAtUtc is not null;

        if ((isEmployee || isSurvey)
            && discountApplied
            && ledger.BillingStatus is InspectorFeeBillingStatus.Draft
                or InspectorFeeBillingStatus.SupReview
                or InspectorFeeBillingStatus.AtFinance
                or InspectorFeeBillingStatus.Returned
                or InspectorFeeBillingStatus.Inquiry)
        {
            ledger.BillingStatus = InspectorFeeBillingStatus.AtFinance;
            return;
        }

        if (isSurvey && ledger.BillingStatus == InspectorFeeBillingStatus.Draft)
            ledger.BillingStatus = InspectorFeeBillingStatus.AtFinance;
    }

    /// <summary>
    /// Whether the party should hear about a patch: a supervisor discount reaches employees and
    /// engineering offices directly (it no longer waits for their approval).
    /// </summary>
    /// <remarks>
    /// Only a discount actually sent in the patch counts (see <see cref="DiscountApplied"/>), so
    /// saving an exclusion or a fee on an already-discounted line does not re-notify the party.
    /// </remarks>
    public static bool NotifiesPartyOfDiscount(
        WorkflowTaskKind taskKind,
        bool isEmployee,
        bool discountApplied) =>
        discountApplied && (isEmployee || taskKind == WorkflowTaskKind.EngineeringSurvey);

    /// <summary>The audit row a patch writes when it moved the line.</summary>
    public static InspectorFeeTransition PatchTransition(
        InspectorFeeLedger ledger,
        string fromStatus,
        DateTime nowUtc) => new()
        {
            Id = Guid.NewGuid(),
            WorkflowTaskId = ledger.WorkflowTaskId,
            FromStatus = fromStatus,
            ToStatus = ledger.BillingStatus,
            Reason = ledger.DiscountReason,
            ActorUserId = "system",
            CreatedAtUtc = nowUtc,
        };

    // ---- transitions ----

    /// <summary>
    /// Multiple identity lines can share one workflow task (reassign / legacy UserId).
    /// Prefer the row the actor can legally transition — not an arbitrary insert order.
    /// </summary>
    public static InspectorFeeLedger? PickLedgerForTransition(
        IReadOnlyList<InspectorFeeLedger> candidates,
        string action,
        string? actorAssigneeId)
    {
        if (candidates.Count == 0) return null;
        if (candidates.Count == 1) return candidates[0];
        return candidates.FirstOrDefault(l => IsActionable(l, action, actorAssigneeId));
    }

    private static bool IsActionable(
        InspectorFeeLedger ledger,
        string action,
        string? actorAssigneeId)
    {
        if (!InspectorFeeBillingRules.TryResolveTransition(
                ledger.BillingStatus,
                action,
                out _,
                out _,
                out _,
                ledger.PreSuspensionStatus))
        {
            return false;
        }

        if (action is not (InspectorFeeActions.SubmitToSupervisor
            or InspectorFeeActions.CreateDisbursementRequest))
        {
            return true;
        }

        if (string.IsNullOrWhiteSpace(actorAssigneeId)) return false;
        if (!string.Equals(
                ledger.AssigneeId?.Trim(),
                actorAssigneeId.Trim(),
                StringComparison.Ordinal))
        {
            return false;
        }

        if (action != InspectorFeeActions.SubmitToSupervisor) return true;

        if (ledger.ExcludedFromBatch) return false;
        if (!InspectorFeeRules.HasBillableAgreedFee(ledger.AgreedFeeSar)) return false;
        if (ledger.BillingStatus == InspectorFeeBillingStatus.Returned
            && ledger.ReturnTo != InspectorFeeReturnTo.Office)
            return false;
        return ledger.BillingStatus != InspectorFeeBillingStatus.Inquiry
            || ledger.ReturnTo == InspectorFeeReturnTo.Office;
    }

    public static string NormalizeAction(string action) => action.Trim().ToLowerInvariant();

    public static bool IsDisburseAction(string action) =>
        string.Equals(action.Trim(), InspectorFeeActions.Disburse, StringComparison.OrdinalIgnoreCase);

    /// <summary>One line of a batch is applied as an ordinary single transition.</summary>
    public static InspectorFeeTransitionRequest BatchLineRequest(
        BatchInspectorFeeTransitionRequest request) => new()
        {
            Action = request.Action,
            Reason = request.Reason,
            DisbursementVoucher = request.DisbursementVoucher,
        };

    public static InspectorFeeTransitionErrorDto TransitionError(string workflowTaskId, string error) =>
        new() { WorkflowTaskId = workflowTaskId, Error = error };


    // ---- notifications ----

    public static List<string> DistinctAssigneeIds(IEnumerable<InspectorFeeRowDto> rows) =>
        rows
            .Select(row => row.AssigneeId?.Trim())
            .Where(assigneeId => !string.IsNullOrWhiteSpace(assigneeId))
            .Cast<string>()
            .Distinct(StringComparer.Ordinal)
            .ToList();

    /// <summary>
    /// «حسم من أتعابك»: the applied discount and the resulting net, ready for billing. Sent to
    /// employees and engineering offices after a direct supervisor discount.
    /// </summary>
    public static CreateUserNotificationRequest PartyDiscountNotification(InspectorFeeLedger ledger)
    {
        var net = InspectorFeeRules.NetFee(ledger.AgreedFeeSar, ledger.SupervisorDiscountSar);
        return new CreateUserNotificationRequest
        {
            Title = "حسم من أتعابك",
            Body =
                $"طُبّق حسم {ledger.SupervisorDiscountSar:N0} ر.س على أمر العمل {ledger.PoNumber}."
                + $" الصافي {net:N0} ر.س — البند جاهز للفوترة.",
            Tone = "warning",
            Href = "/party-fees",
            Category = "financial",
            SourceEvent = $"fee-discount-notified:{ledger.WorkflowTaskId:N}",
        };
    }

    public static CreateUserNotificationRequest FeeDisbursedNotification(InspectorFeeRowDto row) =>
        new()
        {
            Title = "تم صرف الأتعاب",
            Body = $"صُرفت أتعاب العقار {row.PropertyLabel}.",
            Tone = "success",
            Href = "/party-fees",
            Category = "financial",
            EntityType = "task",
            EntityId = row.WorkflowTaskId,
            SourceEvent = $"fee-disbursed:{row.WorkflowTaskId}",
        };
}

using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Financial.Domain;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.Financial.Infrastructure.Services;

public static class InspectorFeeRowMapper
{
    /// <summary>
    /// Projects one fee line (with its task, labels and optional pending proposal) into the row the
    /// fee screens render, including which actions the row offers.
    /// </summary>
    /// <remarks>
    /// <para><b>Proposal handling:</b> when <paramref name="pendingProposal"/> is given and the line
    /// is still in <c>sup-review</c>, the row carries the proposed amount, reason, proposer and date,
    /// sets <c>CanResolveDiscountProposal</c>, and turns off <c>CanApproveToFinance</c> and
    /// <c>IsEditable</c> — the only way forward is the decision.</para>
    /// <para><b>Edge cases:</b></para>
    /// <list type="bullet">
    /// <item>A flag that is still pending while its line moved on (e.g. the line was suspended) does
    /// not show as a proposal: the row only reports what the supervisor can act on now.</item>
    /// <item>The retired <c>CanOfficeApproveDiscount</c> / <c>CanOfficeDispute</c> /
    /// <c>CanResolveDispute</c> flags were removed with the office loop.</item>
    /// </list>
    /// </remarks>
    public static InspectorFeeRowDto ToRowDto(
        InspectorFeeLedger ledger,
        WorkflowTask task,
        string propertyLabel,
        bool workSubmitted,
        DateTime? workSubmittedAtUtc,
        DateTime? poReceivedAtUtc,
        string? lastTransitionReason,
        DiscountFlag? pendingProposal = null)
    {
        // A pending proposal only matters while its line still waits in sup-review: the row then
        // carries the proposal, offers the decision instead of a plain approval, and is not editable.
        var awaitsDecision = pendingProposal is not null
            && ledger.BillingStatus == InspectorFeeBillingStatus.SupReview;
        var discount = Math.Max(0m, ledger.SupervisorDiscountSar);
        var workStatus = workSubmitted
            ? InspectorFeeWorkStatuses.Done
            : (task.Status == WorkflowTaskStatus.Cancelled
                ? InspectorFeeWorkStatuses.Cancelled
                : InspectorFeeWorkStatuses.InProgress);

        return new InspectorFeeRowDto
        {
            Id = ledger.Id.ToString(),
            WorkflowTaskId = ledger.WorkflowTaskId.ToString(),
            PropertyId = ledger.PropertyId?.ToString(),
            PropertyLabel = propertyLabel,
            PoNumber = ledger.PoNumber,
            AssigneeId = ledger.AssigneeId,
            TaskKind = task.Kind.ToDbValue(),
            InspectorType = ledger.InspectorType,
            SupervisingDepartment = ledger.SupervisingDepartment,
            AgreedFeeSar = ledger.AgreedFeeSar,
            SupervisorDiscountSar = discount,
            DiscountReason = discount > 0
                ? (string.IsNullOrWhiteSpace(ledger.DiscountReason) ? "—" : ledger.DiscountReason)
                : null,
            NetFeeSar = ledger.NetFeeSar > 0m || ledger.AgreedFeeSar == 0m
                ? ledger.NetFeeSar
                : InspectorFeeRules.NetFee(ledger.AgreedFeeSar, discount),
            PaidAmountSar = ledger.PaidAmountSar,
            BillingStatus = ledger.BillingStatus,
            BillingStatusLabel = InspectorFeeBillingRules.StatusLabel(ledger.BillingStatus),
            WorkStatus = workStatus,
            WorkStatusLabel = InspectorFeeBillingRules.WorkStatusLabel(workStatus),
            ExcludedFromBatch = ledger.ExcludedFromBatch,
            ExclusionReason = ledger.ExclusionReason,
            ReturnTo = ledger.ReturnTo,
            DisbursementBatchId = ledger.DisbursementBatchId?.ToString(),
            DisbursementVoucher = ledger.DisbursementVoucher,
            PartyBillingStatementId = ledger.PartyBillingStatementId?.ToString(),
            LastTransitionReason = lastTransitionReason,
            UpdatedAtUtc = ledger.UpdatedAtUtc,
            AccruedAtUtc = ledger.AccruedAtUtc,
            WorkSubmittedAtUtc = workSubmittedAtUtc,
            PoReceivedAtUtc = poReceivedAtUtc,
            // A line waiting on a proposal decision is settled through that decision, not edited.
            IsEditable = InspectorFeeBillingRules.IsEditableStatus(ledger.BillingStatus)
                && !awaitsDecision,
            CanSubmitToSupervisor = workStatus == InspectorFeeWorkStatuses.Done
                && !ledger.ExcludedFromBatch
                && ledger.BillingStatus is InspectorFeeBillingStatus.Draft
                    or InspectorFeeBillingStatus.Returned
                    or InspectorFeeBillingStatus.Inquiry
                && (ledger.BillingStatus != InspectorFeeBillingStatus.Returned
                    || ledger.ReturnTo == InspectorFeeReturnTo.Office)
                && (ledger.BillingStatus != InspectorFeeBillingStatus.Inquiry
                    || ledger.ReturnTo == InspectorFeeReturnTo.Office)
                && task.Kind != WorkflowTaskKind.EngineeringSurvey,
            CanApproveToFinance = workStatus == InspectorFeeWorkStatuses.Done
                && !ledger.ExcludedFromBatch
                && ledger.BillingStatus == InspectorFeeBillingStatus.SupReview
                && !awaitsDecision,
 // all party fee kinds use billing statements; legacy disb-req rows stay on finance disburse.
            CanCreateDisbursementRequest = false,
            ProposedDiscountSar = awaitsDecision ? pendingProposal!.ProposedDiscountSar : null,
            ProposedDiscountReason = awaitsDecision ? pendingProposal!.Reason : null,
            ProposedByName = awaitsDecision ? pendingProposal!.FlaggedByName : null,
            ProposedAtUtc = awaitsDecision ? pendingProposal!.CreatedAtUtc : null,
            CanResolveDiscountProposal = awaitsDecision,
            SuspensionReason = ledger.SuspensionReason,
            CanSuspend = InspectorFeeBillingStatus.Suspendable.Contains(ledger.BillingStatus),
            CanLiftSuspension = ledger.BillingStatus == InspectorFeeBillingStatus.Suspended,
        };
    }

    public static InspectorFeesSummaryDto Summarize(IReadOnlyList<InspectorFeeRowDto> rows)
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
            SuspendedSar = SumNet(r => r.BillingStatus == InspectorFeeBillingStatus.Suspended),
            TotalDiscountsSar = rows.Sum(r => r.SupervisorDiscountSar),
            Rows = rows,
        };
    }

    public static InspectorFeesSummaryDto EmptySummary() => new()
    {
        NetDraftSar = 0m,
        SupReviewSar = 0m,
        AtFinanceSar = 0m,
        DisbReqSar = 0m,
        DisbursedSar = 0m,
        SuspendedSar = 0m,
        TotalDiscountsSar = 0m,
        Rows = [],
    };
}

using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;

namespace RealEstateEval.Infrastructure.Services;

public static class InspectorFeeRowMapper
{
    public static InspectorFeeRowDto ToRowDto(
        InspectorFeeLedger ledger,
        WorkflowTask task,
        string propertyLabel,
        bool workSubmitted,
        DateTime? workSubmittedAtUtc,
        DateTime? poReceivedAtUtc,
        string? lastTransitionReason)
    {
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
            IsEditable = InspectorFeeBillingRules.IsEditableStatus(ledger.BillingStatus),
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
                && ledger.BillingStatus == InspectorFeeBillingStatus.SupReview,
 // all party fee kinds use billing statements; legacy disb-req rows stay on finance disburse.
            CanCreateDisbursementRequest = false,
            CanOfficeApproveDiscount = workStatus == InspectorFeeWorkStatuses.Done
                && !ledger.ExcludedFromBatch
                && !InspectorFeeRules.IsEmployee(ledger.InspectorType)
                && task.Kind == WorkflowTaskKind.EngineeringSurvey
                && ledger.BillingStatus == InspectorFeeBillingStatus.OfficeReview
                && discount > 0m,
            CanOfficeDispute = workStatus == InspectorFeeWorkStatuses.Done
                && !ledger.ExcludedFromBatch
                && !InspectorFeeRules.IsEmployee(ledger.InspectorType)
                && task.Kind == WorkflowTaskKind.EngineeringSurvey
                && ledger.BillingStatus == InspectorFeeBillingStatus.OfficeReview
                && discount > 0m,
            CanResolveDispute = workStatus == InspectorFeeWorkStatuses.Done
                && !ledger.ExcludedFromBatch
                && !InspectorFeeRules.IsEmployee(ledger.InspectorType)
                && task.Kind == WorkflowTaskKind.EngineeringSurvey
                && ledger.BillingStatus == InspectorFeeBillingStatus.Disputed,
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

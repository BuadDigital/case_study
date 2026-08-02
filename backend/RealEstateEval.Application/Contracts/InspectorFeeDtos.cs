namespace RealEstateEval.Application.Contracts;

public class InspectorFeeRowDto
{
    public string WorkflowTaskId { get; set; } = "";
    public string? PropertyId { get; set; }
    public string PropertyLabel { get; set; } = "";
    public string PoNumber { get; set; } = "";
    public string? AssigneeId { get; set; }
    public string TaskKind { get; set; } = "";
    public string InspectorType { get; set; } = "";
    public string SupervisingDepartment { get; set; } = "";
    public decimal AgreedFeeSar { get; set; }
    public decimal SupervisorDiscountSar { get; set; }
    public string? DiscountReason { get; set; }
    public decimal NetFeeSar { get; set; }
    public decimal PaidAmountSar { get; set; }
    public string BillingStatus { get; set; } = "";
    public string BillingStatusLabel { get; set; } = "";
    public string WorkStatus { get; set; } = "";
    public string WorkStatusLabel { get; set; } = "";
    public bool ExcludedFromBatch { get; set; }
    public string? ExclusionReason { get; set; }
    public string? ReturnTo { get; set; }
    public string? DisbursementBatchId { get; set; }
    public string? DisbursementVoucher { get; set; }
    public string? PartyBillingStatementId { get; set; }
    public string? LastTransitionReason { get; set; }
    public DateTime? UpdatedAtUtc { get; set; }
    public DateTime? AccruedAtUtc { get; set; }
    public DateTime? WorkSubmittedAtUtc { get; set; }
    public DateTime? PoReceivedAtUtc { get; set; }
    public string? SuspensionReason { get; set; }
    public bool IsEditable { get; set; }
    public bool CanSubmitToSupervisor { get; set; }
    public bool CanApproveToFinance { get; set; }
    public bool CanCreateDisbursementRequest { get; set; }
    public bool CanOfficeApproveDiscount { get; set; }
    public bool CanOfficeDispute { get; set; }
    public bool CanResolveDispute { get; set; }
    public bool CanSuspend { get; set; }
    public bool CanLiftSuspension { get; set; }
}

public class InspectorFeesSummaryDto
{
    public decimal NetDraftSar { get; set; }
    public decimal SupReviewSar { get; set; }
    public decimal AtFinanceSar { get; set; }
    public decimal DisbReqSar { get; set; }
    public decimal DisbursedSar { get; set; }
    /// <summary>Withheld money. Deliberately outside the payable buckets above.</summary>
    public decimal SuspendedSar { get; set; }
    public decimal TotalDiscountsSar { get; set; }
    public IReadOnlyList<InspectorFeeRowDto> Rows { get; set; } = [];
}

public class PatchInspectorFeeRequest
{
    public decimal? SupervisorDiscountSar { get; set; }
    public string? DiscountReason { get; set; }
    public decimal? AgreedFeeSar { get; set; }
    public bool? ExcludedFromBatch { get; set; }
    public string? ExclusionReason { get; set; }
}

public class InspectorFeeTransitionRequest
{
    public required string Action { get; init; }
    public string? Reason { get; init; }
    public string? DisbursementVoucher { get; init; }
}

public class BatchInspectorFeeTransitionRequest
{
    public IReadOnlyList<string> WorkflowTaskIds { get; init; } = [];
    public required string Action { get; init; }
    public string? Reason { get; init; }
    public string? DisbursementVoucher { get; init; }
    public string? DisbursementBatchId { get; init; }
}

public class BatchInspectorFeeTransitionResult
{
    public IReadOnlyList<InspectorFeeRowDto> Succeeded { get; init; } = [];
    public IReadOnlyList<InspectorFeeTransitionErrorDto> Failed { get; init; } = [];
    public string? DisbursementBatchId { get; init; }
}

public class InspectorFeeTransitionErrorDto
{
    public string WorkflowTaskId { get; init; } = "";
    public string Error { get; init; } = "";
}

public class InspectorFeeAuditEntryDto
{
    public string Id { get; set; } = "";
    public string FromStatus { get; set; } = "";
    public string FromStatusLabel { get; set; } = "";
    public string ToStatus { get; set; } = "";
    public string ToStatusLabel { get; set; } = "";
    public string? Reason { get; set; }
    public string ActorUserId { get; set; } = "";
    public string? ActorLabel { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}

public class CreateDisbursementBatchRequest
{
    public IReadOnlyList<string> WorkflowTaskIds { get; init; } = [];
}

public class CreateDisbursementBatchResult
{
    public string DisbursementBatchId { get; init; } = "";
    public IReadOnlyList<InspectorFeeRowDto> Rows { get; init; } = [];
    public IReadOnlyList<InspectorFeeTransitionErrorDto> Failed { get; init; } = [];
}

public class PoEnfazRevenueLineDto
{
    public string Id { get; set; } = "";
    public string PoNumber { get; set; } = "";
    public string PropertyId { get; set; } = "";
    public string PropertyLabel { get; set; } = "";
    public string WorkStatus { get; set; } = "";
    public string WorkStatusLabel { get; set; } = "";
    /// <summary>دخل دراسة المعاملة.</summary>
    public decimal CaseStudyFeeSar { get; set; }
    /// <summary>دخل تكاليف الرفع.</summary>
    public decimal SurveyFeeSar { get; set; }
    /// <summary>أتعاب مفاتيح (يدوي عند وجود استحقاق).</summary>
    public decimal KeyFeeSar { get; set; }
    public string? KeyEntitlementEnvelopeId { get; set; }
    public bool HasKeyEntitlement { get; set; }
    /// <summary>مراجع مرفقات ظرف المفتاح (صورة/إيصال) — عرض فقط.</summary>
    public IReadOnlyList<string> KeyAttachmentIds { get; set; } = [];
    /// <summary>Computed total (CaseStudy + Survey + Key).</summary>
    public decimal EnfazFeeSar { get; set; }
    public bool IncludedInBilling { get; set; }
}

public class PoEnfazBillingDto
{
    public string PoNumber { get; set; } = "";
    public bool PoReadyForBilling { get; set; }
    public IReadOnlyList<PoEnfazRevenueLineDto> Lines { get; set; } = [];
    public decimal SubtotalSar { get; set; }
    public decimal VatSar { get; set; }
    public decimal TotalSar { get; set; }
    public string? InvoiceNumber { get; set; }
    public DateTime? InvoiceIssuedAtUtc { get; set; }
    public string? InvoiceStatus { get; set; }
    public decimal CollectedAmountSar { get; set; }
    public DateTime? CollectedAtUtc { get; set; }
    public bool IsOverdue { get; set; }
    /// <summary>مرفقات مرتبطة بالفاتورة / ظروف المفاتيح — عرض فقط.</summary>
    public IReadOnlyList<string> AttachmentIds { get; set; } = [];
}

public class EnfazTrackingRowDto
{
    public string PoNumber { get; set; } = "";
    public string PropertyId { get; set; } = "";
    public string PropertyLabel { get; set; } = "";
    public string WorkStatus { get; set; } = "";
    public string WorkStatusLabel { get; set; } = "";
    public bool EnfazFilled { get; set; }
    public decimal CaseStudyFeeSar { get; set; }
    public decimal SurveyFeeSar { get; set; }
    public decimal EnfazFeeSar { get; set; }
    public string? InvoiceNumber { get; set; }
    public string? InvoiceStatus { get; set; }
    public decimal CollectedAmountSar { get; set; }
    public DateTime? InvoiceIssuedAtUtc { get; set; }
    public bool IsOverdue { get; set; }
}

public class EnfazReadyPoSummaryDto
{
    public string PoNumber { get; set; } = "";
    public int DoneCount { get; set; }
    public int CancelledCount { get; set; }
}

public class SavePoEnfazBillingRequest
{
    public IReadOnlyList<PoEnfazRevenueLineInput> Lines { get; init; } = [];
}

public class PoEnfazRevenueLineInput
{
    public string PropertyId { get; init; } = "";
    public decimal CaseStudyFeeSar { get; init; }
    public decimal SurveyFeeSar { get; init; }
    public decimal KeyFeeSar { get; init; }
    public string? KeyEntitlementEnvelopeId { get; init; }
    public bool IncludedInBilling { get; init; } = true;
}

public class CollectPoEnfazInvoiceRequest
{
    public decimal AmountSar { get; init; }
    public string? Note { get; init; }
}

public class PropertyEnfazRevenueDto
{
    public decimal? CaseStudyFeeSar { get; set; }
    public decimal? SurveyFeeSar { get; set; }
    public decimal? EnfazFeeSar { get; set; }
    public bool HasEnfazRevenue { get; set; }
}

/// <summary>Open Enfaz receivables aging (تقادم الذمم).</summary>
public class EnfazAgingReportDto
{
    public DateTime AsOfUtc { get; set; }
    public decimal TotalOutstandingSar { get; set; }
    public int OpenInvoiceCount { get; set; }
    public IReadOnlyList<EnfazAgingBucketDto> Buckets { get; set; } = [];
    public IReadOnlyList<EnfazAgingInvoiceRowDto> Invoices { get; set; } = [];
}

public class EnfazAgingBucketDto
{
    /// <summary>0_30 | 31_60 | 61_90 | 90_plus</summary>
    public string Key { get; set; } = "";
    public string Label { get; set; } = "";
    public int InvoiceCount { get; set; }
    public decimal OutstandingSar { get; set; }
}

public class EnfazAgingInvoiceRowDto
{
    public string PoNumber { get; set; } = "";
    public string InvoiceNumber { get; set; } = "";
    public string Status { get; set; } = "";
    public DateTime IssuedAtUtc { get; set; }
    public int AgeDays { get; set; }
    public string BucketKey { get; set; } = "";
    public string BucketLabel { get; set; } = "";
    public decimal TotalSar { get; set; }
    public decimal CollectedAmountSar { get; set; }
    public decimal OutstandingSar { get; set; }
}

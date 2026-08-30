namespace RealEstateEval.Application.Contracts;

public class PartyBillingReadyLineDto
{
    public string WorkflowTaskId { get; set; } = "";
    public string? PropertyId { get; set; }
    public string PropertyLabel { get; set; } = "";
    public string PoNumber { get; set; } = "";
    public string? AssigneeId { get; set; }
 /// <summary>engineering-survey | field-inspection | government-review | court-visit</summary>
    public string TaskKind { get; set; } = "";
 /// <summary>vendor | individual</summary>
    public string PayeeType { get; set; } = "vendor";
    public string PayeeTypeLabel { get; set; } = "";
    public decimal AgreedFeeSar { get; set; }
    public decimal SupervisorDiscountSar { get; set; }
    public decimal NetFeeSar { get; set; }
    public string BillingStatus { get; set; } = "";
    public string BillingStatusLabel { get; set; } = "";
    public DateTime? AccruedAtUtc { get; set; }
    public DateTime? UpdatedAtUtc { get; set; }
}

public class PartyBillingStatementLineDto
{
    public string Id { get; set; } = "";
    public string WorkflowTaskId { get; set; } = "";
    public string? PropertyId { get; set; }
    public string PropertyLabel { get; set; } = "";
    public string PoNumber { get; set; } = "";
    public decimal NetFeeSar { get; set; }
    public string BillingStatus { get; set; } = "";
    public string BillingStatusLabel { get; set; } = "";
}

public class PartyBillingRejectedInvoiceDto
{
    public string InvoiceNumber { get; set; } = "";
    public DateTime? InvoiceDate { get; set; }
    public string? AttachmentId { get; set; }
    public string Reason { get; set; } = "";
    public string RejectedByUserId { get; set; } = "";
    public DateTime RejectedAtUtc { get; set; }
}

public class PartyBillingStatementDto
{
    public string Id { get; set; } = "";
    public string ReferenceNumber { get; set; } = "";
    public string AssigneeId { get; set; } = "";
    public string PayeeType { get; set; } = "vendor";
    public string PayeeTypeLabel { get; set; } = "";
    public string? TaskKind { get; set; }
    public string Status { get; set; } = "";
    public string StatusLabel { get; set; } = "";
    public decimal TotalNetSar { get; set; }
    public string CreatedByUserId { get; set; } = "";
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? IssuedAtUtc { get; set; }
    public DateTime? ClosedAtUtc { get; set; }
    public string? ExternalInvoiceNumber { get; set; }
    public string? TransferReceiptAttachmentId { get; set; }
    public string? TransferReceiptRef { get; set; }
    public string? TransferReference { get; set; }
    public string? DisbursementVoucher { get; set; }
    public DateTime? PaidAtUtc { get; set; }
    public string? Notes { get; set; }
    public string? VendorInvoiceNumber { get; set; }
    public DateTime? VendorInvoiceDate { get; set; }
    public string? VendorInvoiceAttachmentId { get; set; }
    public DateTime? VendorInvoiceSubmittedAtUtc { get; set; }
    public bool VendorInvoiceMatched { get; set; }
    public DateTime? VendorInvoiceMatchedAtUtc { get; set; }
    public IReadOnlyList<PartyBillingRejectedInvoiceDto> RejectedInvoices { get; set; } = [];
    public DateTime? CancelledAtUtc { get; set; }
    public string? CancelReason { get; set; }
    public IReadOnlyList<PartyBillingStatementLineDto> Lines { get; set; } = [];
}

public class CreatePartyBillingStatementRequest
{
    public IReadOnlyList<string> WorkflowTaskIds { get; init; } = [];
 /// <summary>
 /// When true, other ready (at-finance) lines for the same payee become deferred.
 /// </summary>
    public bool DeferUnselectedForAssignee { get; init; } = true;
    public string? Notes { get; init; }
}

public class CreatePartyBillingStatementResponseDto
{
    public PartyBillingStatementDto? Statement { get; set; }
    public IReadOnlyList<PartyBillingReadyLineDto> DeferredLines { get; set; } = [];
    public string? Error { get; set; }
}

public class CreateMonthPartyBillingStatementsResponseDto
{
    public IReadOnlyList<PartyBillingStatementDto> Created { get; set; } = [];
    public int AssigneesCovered { get; set; }
    public int LinesIncluded { get; set; }
    public string? Error { get; set; }
}

public class ClosePartyBillingStatementRequest
{
 /// <summary>Disbursement Voucher — required and unique.</summary>
    public required string DisbursementVoucher { get; init; }
 /// <summary>Conversion reference — required.</summary>
    public required string TransferReference { get; init; }
 /// <summary>Transfer receipt — attachment id required.</summary>
    public required string TransferReceiptAttachmentId { get; init; }
 /// <summary>Optional free-text receipt note.</summary>
    public string? TransferReceiptRef { get; init; }
 /// <summary>Legacy alias for voucher or external inv; preferred: DisbursementVoucher.</summary>
    public string? ExternalInvoiceNumber { get; init; }
    public DateTime? PaidAtUtc { get; init; }
    public string? Notes { get; init; }
}

public class SubmitVendorInvoiceRequest
{
    public required string InvoiceNumber { get; init; }
    public DateTime? InvoiceDate { get; init; }
    public required string AttachmentId { get; init; }
}

public class RejectVendorInvoiceRequest
{
    public required string Reason { get; init; }
}

public class CancelPartyBillingStatementRequest
{
    public required string Reason { get; init; }
}

public class DeferPartyBillingLinesRequest
{
    public IReadOnlyList<string> WorkflowTaskIds { get; init; } = [];
}

public class DeferPartyBillingLinesResponseDto
{
    public IReadOnlyList<PartyBillingReadyLineDto> Deferred { get; set; } = [];
    public IReadOnlyList<InspectorFeeTransitionErrorDto> Failed { get; set; } = [];
}

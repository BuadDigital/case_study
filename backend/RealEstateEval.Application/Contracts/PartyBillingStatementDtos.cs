namespace RealEstateEval.Application.Contracts;

public class PartyBillingReadyLineDto
{
    public string WorkflowTaskId { get; set; } = "";
    public string? PropertyId { get; set; }
    public string PropertyLabel { get; set; } = "";
    public string PoNumber { get; set; } = "";
    public string? AssigneeId { get; set; }
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

public class PartyBillingStatementDto
{
    public string Id { get; set; } = "";
    public string ReferenceNumber { get; set; } = "";
    public string AssigneeId { get; set; } = "";
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
    public DateTime? PaidAtUtc { get; set; }
    public string? Notes { get; set; }
    public IReadOnlyList<PartyBillingStatementLineDto> Lines { get; set; } = [];
}

public class CreatePartyBillingStatementRequest
{
    public IReadOnlyList<string> WorkflowTaskIds { get; init; } = [];
    /// <summary>
    /// When true, other ready (at-finance) lines for the same office become deferred.
    /// </summary>
    public bool DeferUnselectedForAssignee { get; init; } = true;
    public string? Notes { get; init; }
}

public class CreatePartyBillingStatementResult
{
    public PartyBillingStatementDto? Statement { get; set; }
    public IReadOnlyList<PartyBillingReadyLineDto> DeferredLines { get; set; } = [];
    public string? Error { get; set; }
}

public class ClosePartyBillingStatementRequest
{
    public required string ExternalInvoiceNumber { get; init; }
    public string? TransferReceiptAttachmentId { get; init; }
    public string? TransferReceiptRef { get; init; }
    public DateTime? PaidAtUtc { get; init; }
    public string? Notes { get; init; }
}

public class DeferPartyBillingLinesRequest
{
    public IReadOnlyList<string> WorkflowTaskIds { get; init; } = [];
}

public class DeferPartyBillingLinesResult
{
    public IReadOnlyList<PartyBillingReadyLineDto> Deferred { get; set; } = [];
    public IReadOnlyList<InspectorFeeTransitionErrorDto> Failed { get; set; } = [];
}

namespace RealEstateEval.Application.Contracts;

public class InspectorFeeRowDto
{
    public string WorkflowTaskId { get; set; } = "";
    public string? PropertyId { get; set; }
    public string PropertyLabel { get; set; } = "";
    public string PoNumber { get; set; } = "";
    public string InspectorType { get; set; } = "";
    public decimal AgreedFeeSar { get; set; }
    public decimal SupervisorDiscountSar { get; set; }
    public string? DiscountReason { get; set; }
    public decimal NetFeeSar { get; set; }
    public string BillingStatus { get; set; } = "";
    public string BillingStatusLabel { get; set; } = "";
    public bool ExcludedFromBatch { get; set; }
    public string? ExclusionReason { get; set; }
    public string? InvoiceNumber { get; set; }
    public bool IsEditable { get; set; }
}

public class InspectorFeesSummaryDto
{
    public decimal NetPreBillingSar { get; set; }
    public decimal ReadyForBillingSar { get; set; }
    public decimal TotalDiscountsSar { get; set; }
    public decimal InvoicedSar { get; set; }
    public decimal PaidSar { get; set; }
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
    public string? InvoiceNumber { get; init; }
}

public class BatchInspectorFeeTransitionRequest
{
    public IReadOnlyList<string> WorkflowTaskIds { get; init; } = [];
    public required string Action { get; init; }
    public string? Reason { get; init; }
    public string? InvoiceNumber { get; init; }
}

public class BatchInspectorFeeTransitionResult
{
    public IReadOnlyList<InspectorFeeRowDto> Succeeded { get; init; } = [];
    public IReadOnlyList<InspectorFeeTransitionErrorDto> Failed { get; init; } = [];
}

public class InspectorFeeTransitionErrorDto
{
    public string WorkflowTaskId { get; init; } = "";
    public string Error { get; init; } = "";
}

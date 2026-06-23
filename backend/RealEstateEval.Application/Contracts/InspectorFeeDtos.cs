namespace RealEstateEval.Application.Contracts;

public class InspectorFeeRowDto
{
    public string WorkflowTaskId { get; set; } = "";
    public string PropertyLabel { get; set; } = "";
    public string PoNumber { get; set; } = "";
    public string InspectorType { get; set; } = "";
    public decimal AgreedFeeSar { get; set; }
    public decimal SupervisorDiscountSar { get; set; }
    public string? DiscountReason { get; set; }
    public decimal NetFeeSar { get; set; }
    public string BillingStatus { get; set; } = "";
}

public class InspectorFeesSummaryDto
{
    public decimal NetPreBillingSar { get; set; }
    public decimal TotalDiscountsSar { get; set; }
    public decimal InvoicedSar { get; set; }
    public IReadOnlyList<InspectorFeeRowDto> Rows { get; set; } = [];
}

public class PatchInspectorFeeRequest
{
    public decimal? SupervisorDiscountSar { get; set; }
    public string? DiscountReason { get; set; }
    public string? BillingStatus { get; set; }
    public decimal? AgreedFeeSar { get; set; }
}

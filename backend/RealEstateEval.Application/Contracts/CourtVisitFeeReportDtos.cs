namespace RealEstateEval.Application.Contracts;

// Stays global (A8 Operations slice): returned by the shared ICourtVisitFeeChargeService
// abstraction and served by the financial charges dispatch endpoint.
public class CourtVisitFeeReportRowDto
{
    public Guid Id { get; set; }
    public Guid OperationsTaskId { get; set; }
    public string TaskDisplayId { get; set; } = "";
    public string? PoNumber { get; set; }
    public string CreditAssigneeId { get; set; } = "";
    public string CreditAssigneeName { get; set; } = "";
    public decimal AmountSar { get; set; }
    public string Status { get; set; } = "";
    public DateTime CreatedAtUtc { get; set; }
}

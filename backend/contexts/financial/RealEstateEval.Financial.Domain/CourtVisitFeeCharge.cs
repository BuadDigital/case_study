namespace RealEstateEval.Financial.Domain;

/// <summary>
/// أتعاب الزيارة — earned when an operations <c>court_visit</c> task is completed.
/// Separate from <see cref="KeyReceiptFeeCharge"/> (envelope photo / key receipt).
/// </summary>
public class CourtVisitFeeCharge
{
    public Guid Id { get; set; }
    public Guid OperationsTaskId { get; set; }
    public string TaskDisplayId { get; set; } = "";
    public string? PoNumber { get; set; }
 /// <summary>Execution-credit assignee (who earned the visit fee).</summary>
    public string CreditAssigneeId { get; set; } = "";
    public string CreditAssigneeName { get; set; } = "";
    public decimal AmountSar { get; set; }
 /// <summary>
 /// The <c>PartyFeePricingTable</c> the amount was read from, stamped alongside it. Deliberately
 /// not a foreign key — the id has to keep naming its source even if the table is later removed.
 /// </summary>
    public Guid? PricingTableId { get; set; }
 /// <summary>
 /// <c>open</c> = accrued / ready for costs (or on an open statement line keyed by <see cref="Id"/>);
 /// <c>settled</c> = paid with a closed party billing statement.
 /// </summary>
    public string Status { get; set; } = CourtVisitFeeStatuses.Open;
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
}

public static class CourtVisitFeeStatuses
{
    public const string Open = "open";
    public const string Settled = "settled";
}

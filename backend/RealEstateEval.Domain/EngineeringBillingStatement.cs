namespace RealEstateEval.Domain;

/// <summary>
/// Monthly engineering-office billing statement (كشف فوترة) — stages 6–8.
/// Reference format: FN-CS-YYMMDD-NNN.
/// </summary>
public class EngineeringBillingStatement
{
    public Guid Id { get; set; }
    public string ReferenceNumber { get; set; } = "";
    /// <summary>Engineering office distribution assignee id.</summary>
    public string AssigneeId { get; set; } = "";
    /// <summary>draft | issued | closed</summary>
    public string Status { get; set; } = EngineeringBillingStatementStatus.Draft;
    public decimal TotalNetSar { get; set; }
    public string CreatedByUserId { get; set; } = "";
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? IssuedAtUtc { get; set; }
    public string? IssuedByUserId { get; set; }
    public DateTime? ClosedAtUtc { get; set; }
    public string? ClosedByUserId { get; set; }
    /// <summary>Invoice number from external accounting software.</summary>
    public string? ExternalInvoiceNumber { get; set; }
    /// <summary>Transfer receipt file (attachments scope).</summary>
    public Guid? TransferReceiptAttachmentId { get; set; }
    /// <summary>Optional free-text receipt / transfer reference.</summary>
    public string? TransferReceiptRef { get; set; }
    public DateTime? PaidAtUtc { get; set; }
    public string? Notes { get; set; }

    public ICollection<EngineeringBillingStatementLine> Lines { get; set; } =
        new List<EngineeringBillingStatementLine>();
}

public class EngineeringBillingStatementLine
{
    public Guid Id { get; set; }
    public Guid StatementId { get; set; }
    public Guid WorkflowTaskId { get; set; }
    /// <summary>Net fee snapshot at statement creation.</summary>
    public decimal NetFeeSar { get; set; }

    public EngineeringBillingStatement? Statement { get; set; }
}

public static class EngineeringBillingStatementStatus
{
    public const string Draft = "draft";
    public const string Issued = "issued";
    public const string Closed = "closed";

    public static readonly IReadOnlySet<string> All = new HashSet<string>(StringComparer.Ordinal)
    {
        Draft,
        Issued,
        Closed,
    };

    public static string Label(string? status) => status switch
    {
        Draft => "مسودة",
        Issued => "صادر",
        Closed => "مصروف",
        _ => "—",
    };
}

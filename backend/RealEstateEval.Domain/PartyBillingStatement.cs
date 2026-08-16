namespace RealEstateEval.Domain;

/// <summary>
/// Monthly payee billing document (مسير / أمر صرف) — stages 6–8.
/// Reference format: FN-CS-YYMMDD-NNN.
/// </summary>
public class PartyBillingStatement
{
    public Guid Id { get; set; }
    public string ReferenceNumber { get; set; } = "";
 /// <summary>Distribution assignee id (المستحق).</summary>
    public string AssigneeId { get; set; } = "";
 /// <summary><see cref="PartyBillingPayeeType"/> — vendor needs invoice match; individual does not.</summary>
    public string PayeeType { get; set; } = PartyBillingPayeeType.Vendor;
 /// <summary>Primary task kind snapped at create (engineering-survey · field-inspection · …).</summary>
    public string? TaskKind { get; set; }
 /// <summary>draft | issued | invoice_received | closed | cancelled</summary>
    public string Status { get; set; } = PartyBillingStatementStatus.Draft;
    public decimal TotalNetSar { get; set; }
    public string CreatedByUserId { get; set; } = "";
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? IssuedAtUtc { get; set; }
    public string? IssuedByUserId { get; set; }
    public DateTime? ClosedAtUtc { get; set; }
    public string? ClosedByUserId { get; set; }
 /// <summary>Invoice number from external accounting (legacy close field; also copies vendor invoice).</summary>
    public string? ExternalInvoiceNumber { get; set; }
 /// <summary>Transfer receipt file (attachments scope).</summary>
    public Guid? TransferReceiptAttachmentId { get; set; }
 /// <summary>Optional free-text receipt reference (alongside transfer ref).</summary>
    public string? TransferReceiptRef { get; set; }
 /// <summary>Bank transfer reference — required with voucher + receipt at close.</summary>
    public string? TransferReference { get; set; }
 /// <summary>Disbursement voucher number (سند صرف) — unique.</summary>
    public string? DisbursementVoucher { get; set; }
    public DateTime? PaidAtUtc { get; set; }
    public string? Notes { get; set; }

 // ---- Vendor invoice lifecycle (مكتب / منشأة) ----
    public string? VendorInvoiceNumber { get; set; }
    public DateTime? VendorInvoiceDate { get; set; }
    public Guid? VendorInvoiceAttachmentId { get; set; }
    public DateTime? VendorInvoiceSubmittedAtUtc { get; set; }
    public string? VendorInvoiceSubmittedByUserId { get; set; }
    public DateTime? VendorInvoiceMatchedAtUtc { get; set; }
    public string? VendorInvoiceMatchedByUserId { get; set; }
 /// <summary>JSON array archive of rejected vendor invoices.</summary>
    public string? RejectedInvoicesJson { get; set; }

    public DateTime? CancelledAtUtc { get; set; }
    public string? CancelledByUserId { get; set; }
    public string? CancelReason { get; set; }

    public ICollection<PartyBillingStatementLine> Lines { get; set; } =
        new List<PartyBillingStatementLine>();
}

public class PartyBillingStatementLine
{
    public Guid Id { get; set; }
    public Guid StatementId { get; set; }
    public Guid WorkflowTaskId { get; set; }
 /// <summary>Net fee snapshot at statement creation.</summary>
    public decimal NetFeeSar { get; set; }

    public PartyBillingStatement? Statement { get; set; }
}

public static class PartyBillingPayeeType
{
    public const string Vendor = "vendor";
    public const string Individual = "individual";

    public static string FromTaskKind(WorkflowTaskKind kind) =>
        kind == WorkflowTaskKind.EngineeringSurvey ? Vendor : Individual;

    public static string Label(string? ptype) => ptype switch
    {
        Vendor => "مورّد",
        Individual => "فرد",
        _ => "—",
    };
}

public static class PartyBillingStatementStatus
{
    public const string Draft = "draft";
    public const string Issued = "issued";
 /// <summary>Vendor only — office uploaded invoice; finance must match or reject.</summary>
    public const string InvoiceReceived = "invoice_received";
    public const string Closed = "closed";
    public const string Cancelled = "cancelled";

    public static readonly IReadOnlySet<string> All = new HashSet<string>(StringComparer.Ordinal)
    {
        Draft,
        Issued,
        InvoiceReceived,
        Closed,
        Cancelled,
    };

    public static readonly IReadOnlySet<string> OpenForFinance = new HashSet<string>(StringComparer.Ordinal)
    {
        Draft,
        Issued,
        InvoiceReceived,
    };

    public static string Label(string? status) => status switch
    {
        Draft => "مسير مُعد",
        Issued => "أُرسل / أمر صادر",
        InvoiceReceived => "فاتورة واردة",
        Closed => "مدفوع",
        Cancelled => "ملغى",
        _ => "—",
    };
}

namespace RealEstateEval.Domain;

/// <summary>بند تحصيل أتعاب استلام مفاتيح من إنفاذ — مرتبط بظرف واحد.</summary>
public class KeyReceiptFeeCharge
{
    public Guid Id { get; set; }
    public Guid EnvelopeId { get; set; }
    public string RequestNumber { get; set; } = "";
    public decimal AmountSar { get; set; }
    /// <summary>open | collected</summary>
    public string CollectionStatus { get; set; } = KeyReceiptFeeStatuses.Open;
    public Guid? PhotoAttachmentId { get; set; }
    public Guid? ReceiptAttachmentId { get; set; }
    public string? InvoiceReference { get; set; }
    public DateTime? CollectedAtUtc { get; set; }
    public string CreatedByUserId { get; set; } = "";
    public string CreatedByName { get; set; } = "";
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
}

public static class KeyReceiptFeeStatuses
{
    public const string Open = "open";
    public const string Collected = "collected";
}

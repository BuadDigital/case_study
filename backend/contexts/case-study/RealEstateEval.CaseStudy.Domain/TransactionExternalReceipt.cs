namespace RealEstateEval.CaseStudy.Domain;

/// <summary>Where an external party's delivery stands (Omar 2026-11-08).</summary>
public static class TransactionExternalReceiptStatuses
{
    public const string Pending = "pending";
    public const string Received = "received";
    public const string Cancelled = "cancelled";

    public static readonly IReadOnlyList<string> All = [Pending, Received, Cancelled];
}

/// <summary>
/// One delivery the transaction waits for from a party outside the system (Omar 2026-11-08: «إضافة استلام
/// من طرف خارجي» — the coordinator records who and what, and the transaction shows «بانتظار طرف خارجي»;
/// it cannot be sent to the study until every such delivery is received or dropped).
/// </summary>
public class TransactionExternalReceipt
{
    public Guid Id { get; set; }
    public Guid TransactionId { get; set; }

    /// <summary>Who delivers it (an office, a person, an authority).</summary>
    public string PartyName { get; set; } = "";

    /// <summary>What is awaited from it (a sketch, a letter, a survey…).</summary>
    public string Awaited { get; set; } = "";

    public string Status { get; set; } = TransactionExternalReceiptStatuses.Pending;

    public DateTime CreatedAtUtc { get; set; }
    public string? CreatedByUserId { get; set; }
    public string? CreatedByName { get; set; }

    public DateTime? ReceivedAtUtc { get; set; }
    public string? ReceivedByUserId { get; set; }
    public string? ReceivedByName { get; set; }

    /// <summary>A word on the receipt or on dropping it.</summary>
    public string? Note { get; set; }

    public DateTime? CancelledAtUtc { get; set; }

    public bool IsPending => Status == TransactionExternalReceiptStatuses.Pending;

    /// <summary>The delivery arrived. Edge cases: only a pending one moves; returns whether it changed.</summary>
    public bool MarkReceived(string? userId, string? name, string? note, DateTime nowUtc)
    {
        if (!IsPending) return false;
        Status = TransactionExternalReceiptStatuses.Received;
        ReceivedAtUtc = nowUtc;
        ReceivedByUserId = string.IsNullOrWhiteSpace(userId) ? null : userId.Trim();
        ReceivedByName = string.IsNullOrWhiteSpace(name) ? null : name.Trim();
        Note = string.IsNullOrWhiteSpace(note) ? Note : note.Trim();
        return true;
    }

    /// <summary>It is no longer awaited (added by mistake, or not needed after all).</summary>
    /// <remarks>Edge cases: only a pending one is dropped; returns whether it changed.</remarks>
    public bool Cancel(string? note, DateTime nowUtc)
    {
        if (!IsPending) return false;
        Status = TransactionExternalReceiptStatuses.Cancelled;
        CancelledAtUtc = nowUtc;
        Note = string.IsNullOrWhiteSpace(note) ? Note : note.Trim();
        return true;
    }
}

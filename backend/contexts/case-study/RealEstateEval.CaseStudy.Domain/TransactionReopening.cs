namespace RealEstateEval.CaseStudy.Domain;

/// <summary>Where a reopening came from (Omar 2026-11-05): a note from Enfaz, or an error found inside.</summary>
public static class TransactionReopeningSources
{
    public const string Enfaz = "enfaz";
    public const string Internal = "internal";

    public static readonly IReadOnlyList<string> All = [Enfaz, Internal];

    public static string LabelAr(string? source) => source == Enfaz ? "ملاحظة من إنفاذ" : "خطأ داخلي";
}

/// <summary>
/// Where a reopening stands: open (being corrected) or closed. «awaiting_reply» was the wait for
/// coordination's «تم الرد على إنفاذ» — removed 2026-11-08 (the reply is outside the system); the value
/// stays allowed for rows written before.
/// </summary>
public static class TransactionReopeningStatuses
{
    public const string Open = "open";
    public const string AwaitingReply = "awaiting_reply";
    public const string Closed = "closed";

    public static readonly IReadOnlyList<string> All = [Open, AwaitingReply, Closed];
}

/// <summary>
/// One «إعادة فتح المعاملة» (Omar 2026-11-05): after review approved a transaction, the only way to change it
/// is to reopen it with a reason — from Enfaz (its reference and note) or internal — choosing what it
/// affects. It ends when the transaction is uploaded to Enfaz again, whatever its source (Omar 2026-11-08:
/// the reply to Enfaz happens outside the system, so no «تم الرد» step).
/// </summary>
public class TransactionReopening
{
    public Guid Id { get; set; }
    public Guid TransactionId { get; set; }

    /// <summary>The deed it was opened from (the transaction's deeds share it).</summary>
    public Guid PropertyId { get; set; }

    public string Source { get; set; } = TransactionReopeningSources.Internal;

    /// <summary>Enfaz's reference for the note (its request or message number), when it came from Enfaz.</summary>
    public string? EnfazReference { get; set; }

    public string Reason { get; set; } = "";

    public bool ReopensStudy { get; set; }
    public bool ReopensValuation { get; set; }

    /// <summary>Field work is needed (a new visit or photos) — the study is reopened and a task is made for it.</summary>
    public bool NeedsFieldWork { get; set; }

    public string Status { get; set; } = TransactionReopeningStatuses.Open;

    public DateTime OpenedAtUtc { get; set; }
    public string? OpenedByUserId { get; set; }
    public string? OpenedByName { get; set; }

    /// <summary>When the transaction went back to Enfaz after the correction.</summary>
    public DateTime? UploadedAgainAtUtc { get; set; }

    public DateTime? ClosedAtUtc { get; set; }
    public string? ClosedByUserId { get; set; }
    public string? ClosedByName { get; set; }

    public bool IsActive => Status != TransactionReopeningStatuses.Closed;

    /// <summary>What it affects, in words: «تقرير الدراسة» / «تقرير التقييم» / both, plus field work.</summary>
    public string AffectedLabelAr()
    {
        var parts = new List<string>();
        if (ReopensStudy) parts.Add("تقرير الدراسة");
        if (ReopensValuation) parts.Add("تقرير التقييم");
        if (NeedsFieldWork) parts.Add("عمل ميداني");
        return parts.Count == 0 ? "—" : string.Join(" و", parts);
    }

    /// <summary>
    /// The transaction went back to Enfaz: the reopening closes (an old one still awaiting the reply too).
    /// </summary>
    /// <remarks>Edge cases: only an open reopening moves; returns whether it changed.</remarks>
    public bool MarkUploadedAgain(DateTime nowUtc)
    {
        if (Status == TransactionReopeningStatuses.Closed) return false;
        UploadedAgainAtUtc ??= nowUtc;
        Status = TransactionReopeningStatuses.Closed;
        ClosedAtUtc = nowUtc;
        return true;
    }

}

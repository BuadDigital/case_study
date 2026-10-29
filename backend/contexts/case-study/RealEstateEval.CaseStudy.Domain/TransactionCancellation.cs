using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Domain;

/// <summary>
/// «إلغاء المعاملة»: one request to cancel one transaction (all its deeds, in every work order) or
/// every live transaction of one work order. The case specialist asks, the section supervisor
/// approves or rejects, and the supervisor may later reactivate what was approved. Cancelling is
/// for our own mistakes (a duplicate, a wrong entry) — a transaction Enfaz stops is a failure.
/// </summary>
public class TransactionCancellation : ITrackUpdatedAt
{
    public Guid Id { get; set; }

    /// <summary><see cref="TransactionCancellationScopes"/>: one transaction, or one work order.</summary>
    public string Scope { get; set; } = TransactionCancellationScopes.Transaction;

    /// <summary>The transaction id (scope transaction) or the PO number (scope work-order).</summary>
    public string ScopeRef { get; set; } = "";

    /// <summary>The PO the request was raised from — where its notifications point.</summary>
    public string PoNumber { get; set; } = "";

    /// <summary>JSON array of the deed ids the request covers, fixed when it is raised.</summary>
    public string DeedIdsJson { get; set; } = "[]";

    /// <summary><see cref="TransactionCancellationStatuses"/>.</summary>
    public string Status { get; set; } = TransactionCancellationStatuses.Pending;

    /// <summary><see cref="TransactionCancellationReasons"/>.</summary>
    public string ReasonCode { get; set; } = "";

    public string Note { get; set; } = "";

    /// <summary>Optional supporting file (attachments service id).</summary>
    public Guid? AttachmentId { get; set; }

    public string RequestedByUserId { get; set; } = "";
    public string RequestedByName { get; set; } = "";
    public DateTime RequestedAtUtc { get; set; }

    public string? DecidedByUserId { get; set; }
    public string? DecidedByName { get; set; }
    public DateTime? DecidedAtUtc { get; set; }
    public string? DecisionNote { get; set; }

    public string? ReactivatedByUserId { get; set; }
    public string? ReactivatedByName { get; set; }
    public DateTime? ReactivatedAtUtc { get; set; }
    public string? ReactivationNote { get; set; }

    public DateTime UpdatedAtUtc { get; set; }

    public bool IsPending => Status == TransactionCancellationStatuses.Pending;

    public static TransactionCancellation Create(
        string scope,
        string scopeRef,
        string poNumber,
        string deedIdsJson,
        string reasonCode,
        string note,
        Guid? attachmentId,
        string requestedByUserId,
        string requestedByName,
        DateTime nowUtc) => new()
        {
            Id = Guid.NewGuid(),
            Scope = scope,
            ScopeRef = scopeRef.Trim(),
            PoNumber = poNumber.Trim(),
            DeedIdsJson = deedIdsJson,
            ReasonCode = reasonCode.Trim(),
            Note = note.Trim(),
            AttachmentId = attachmentId,
            RequestedByUserId = requestedByUserId.Trim(),
            RequestedByName = requestedByName.Trim(),
            RequestedAtUtc = nowUtc,
            UpdatedAtUtc = nowUtc,
        };

    /// <summary>The supervisor's decision on a pending request. Returns whether it changed.</summary>
    /// <remarks>
    /// How it works: only a pending request moves, to approved or rejected, with who decided, when
    /// and the optional note. Edge cases: a decided request returns false untouched, so a double
    /// click never decides twice.
    /// </remarks>
    public bool TryDecide(bool approve, string userId, string userName, string? note, DateTime nowUtc)
    {
        if (!IsPending) return false;

        Status = approve ? TransactionCancellationStatuses.Approved : TransactionCancellationStatuses.Rejected;
        DecidedByUserId = userId.Trim();
        DecidedByName = userName.Trim();
        DecisionNote = Texts.NullIfBlank(note);
        DecidedAtUtc = nowUtc;
        UpdatedAtUtc = nowUtc;
        return true;
    }

    /// <summary>The supervisor brings an approved cancellation back to life. Returns whether it changed.</summary>
    /// <remarks>
    /// How it works: only an approved request becomes reactivated, with who, when and why.
    /// Edge cases: a pending, rejected or already reactivated request returns false untouched.
    /// </remarks>
    public bool TryReactivate(string userId, string userName, string note, DateTime nowUtc)
    {
        if (Status != TransactionCancellationStatuses.Approved) return false;

        Status = TransactionCancellationStatuses.Reactivated;
        ReactivatedByUserId = userId.Trim();
        ReactivatedByName = userName.Trim();
        ReactivationNote = note.Trim();
        ReactivatedAtUtc = nowUtc;
        UpdatedAtUtc = nowUtc;
        return true;
    }
}

public static class TransactionCancellationScopes
{
    public const string Transaction = "transaction";
    public const string WorkOrder = "work-order";

    public static readonly IReadOnlyList<string> All = [Transaction, WorkOrder];
}

public static class TransactionCancellationStatuses
{
    public const string Pending = "pending";
    public const string Approved = "approved";
    public const string Rejected = "rejected";
    public const string Reactivated = "reactivated";

    public static readonly IReadOnlyList<string> All = [Pending, Approved, Rejected, Reactivated];
}

/// <summary>Why a transaction is cancelled — our own mistakes only; Enfaz stopping it is a failure.</summary>
public static class TransactionCancellationReasons
{
    public const string Duplicate = "duplicate";
    public const string WrongEntry = "wrong_entry";
    public const string Other = "other";

    public static readonly IReadOnlyList<string> All = [Duplicate, WrongEntry, Other];

    public static bool IsValid(string? code) => code is Duplicate or WrongEntry or Other;

    public static string LabelAr(string? code) => code switch
    {
        Duplicate => "معاملة مكررة",
        WrongEntry => "إدخال خاطئ",
        Other => "أخرى",
        _ => "",
    };
}

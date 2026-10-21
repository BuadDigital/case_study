using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Domain;

/// <summary>
/// The transaction (المعاملة): the property as the reference above its deeds. An ordinary
/// property is a transaction with one deed; a linked property (decision 2026-10-18) is one
/// transaction with several deeds, each from its own Enfaz work order. The case-study report,
/// the valuation request and the valuation report belong to the transaction, while the
/// work order, its finance and its Enfaz upload stay with the deed.
/// </summary>
public class Transaction : ITrackUpdatedAt
{
    public Guid Id { get; set; }

    /// <summary>Draft number TMP-{YY}-{seq}: given at intake, never printed, released on merge.</summary>
    public string DraftNumber { get; set; } = "";

    /// <summary>
    /// Official reference PR-{year}-{seq}: drawn when the case-study report or the valuation
    /// report is first approved, whichever comes first, and never changed afterwards.
    /// </summary>
    public string? ReferenceNumber { get; set; }

    public DateTime? ConfirmedAtUtc { get; set; }

    /// <summary>Why the deeds are one property: <see cref="TransactionLinkKinds"/>; null for a single deed.</summary>
    public string? LinkKind { get; set; }

    public string? LinkReason { get; set; }

    /// <summary>
    /// The deed whose case-study parent task carries the transaction's one study (phase 4).
    /// Set at the first merge; null means the first deed. See <see cref="TransactionStudyRules"/>.
    /// </summary>
    public Guid? StudyHolderPropertyId { get; set; }

    /// <summary>Set when this transaction was merged into another; its deeds now belong there.</summary>
    public Guid? MergedIntoTransactionId { get; set; }

    public DateTime? MergedAtUtc { get; set; }

    public string? MergedByUserId { get; set; }

    public DateTime CreatedAtUtc { get; set; }

    public DateTime UpdatedAtUtc { get; set; }

    public ICollection<WorkOrderProperty> Properties { get; set; } = [];

    public bool IsConfirmed => !string.IsNullOrWhiteSpace(ReferenceNumber);

    public bool IsMerged => MergedIntoTransactionId is not null;

    /// <summary>The number people see: the official reference once confirmed, else the draft number.</summary>
    public string DisplayNumber => IsConfirmed ? ReferenceNumber! : DraftNumber;

    public static Transaction CreateDraft(string draftNumber, DateTime nowUtc) => new()
    {
        Id = Guid.NewGuid(),
        DraftNumber = draftNumber.Trim(),
        CreatedAtUtc = nowUtc,
        UpdatedAtUtc = nowUtc,
    };

    /// <summary>Fixes the official reference once; a second call with a reference already set is a no-op.</summary>
    public bool Confirm(string referenceNumber, DateTime nowUtc)
    {
        if (IsConfirmed) return false;
        ReferenceNumber = referenceNumber.Trim();
        ConfirmedAtUtc = nowUtc;
        UpdatedAtUtc = nowUtc;
        return true;
    }
}

/// <summary>
/// One study per transaction (decision 2026-10-18, phase 4): the study row stays on the
/// case-study parent task of the holder deed; every other deed's study flow folds into it.
/// </summary>
public static class TransactionStudyRules
{
    /// <summary>
    /// The holder deed: the recorded one while it is still a live deed of the transaction, else the
    /// first live deed (by its work order's receipt, then deed number). Null when the transaction
    /// has no live deed.
    /// </summary>
    public static WorkOrderProperty? Holder(Transaction transaction)
    {
        var live = transaction.Properties.Where(p => !p.IsRemoved).ToList();
        if (live.Count == 0) return null;
        if (transaction.StudyHolderPropertyId is Guid recorded)
        {
            var kept = live.FirstOrDefault(p => p.Id == recorded);
            if (kept is not null) return kept;
        }

        return live
            .OrderBy(p => p.WorkOrder?.CreatedAtUtc ?? DateTime.MaxValue)
            .ThenBy(p => p.DeedNumber, StringComparer.Ordinal)
            .First();
    }
}

/// <summary>How the deeds of one transaction are linked (decision 2026-10-18).</summary>
public static class TransactionLinkKinds
{
    /// <summary>One building on several deeds — valued as one.</summary>
    public const string OneBuilding = "one_building";

    /// <summary>Several (usually adjacent) properties bound by a contract to be sold together — valued each, then summed.</summary>
    public const string Contract = "contract";

    public static bool IsValid(string? kind) => kind is OneBuilding or Contract;

    public static string LabelAr(string? kind) => kind switch
    {
        OneBuilding => "مبنى واحد على عدة صكوك",
        Contract => "أعيان مرتبطة بعقد",
        _ => "",
    };
}

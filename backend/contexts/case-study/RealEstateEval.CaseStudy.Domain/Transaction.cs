using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Domain;

/// <summary>
/// The transaction (المعاملة): the property as the reference above its deeds. An ordinary
/// property is a transaction with one deed; a linked property is one
/// transaction with several deeds, each from its own Enfaz work order. The case-study report,
/// the valuation request and the valuation report belong to the transaction, while the
/// work order, its finance and its Enfaz upload stay with the deed.
/// </summary>
public class Transaction : ITrackUpdatedAt
{
    public Guid Id { get; set; }

    /// <summary>
    /// The retired temporary number TMP-{YY}-{seq} (2026-10-20 → 2026-11-08). New transactions have
    /// none; old rows keep it as history (and a merged-away transaction is still known by it).
    /// </summary>
    public string? DraftNumber { get; set; }

    /// <summary>
    /// The property's number (ruling 2026-11-08): a single deed's own number (PR-26-00123), a linked
    /// property's root deed number plus «-L» (PR-26-00123-L). Null until the first deed is numbered at
    /// the first full save of its initial data, and null on a transaction merged into another. Set
    /// through <see cref="TransactionReferenceRules"/> only.
    /// </summary>
    public string? ReferenceNumber { get; set; }

    /// <summary>
    /// The number is locked: the first report (case-study or valuation) was approved, or the deed was
    /// handed over to Enfaz. From then on no deed leaves the property (no unmerge) and the link kind is
    /// fixed. Kept under its old column name; before 2026-11-08 it was the moment PR was drawn.
    /// </summary>
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

    /// <summary>
    /// The formal receipt («إرسال المعاملة للدراسة»): coordination confirmed every party delivered, and the
    /// transaction moved to the shared «دراسة العقار» queue (ruling 2026-11-02). Null until then.
    /// </summary>
    public DateTime? ReceivedAtUtc { get; set; }

    public string? ReceivedByUserId { get; set; }

    public string? ReceivedByName { get; set; }

    /// <summary>
    /// The study handed the transaction to review in one batch — the issued study report and the
    /// valuation draft (Omar 2026-11-05). From then on only the review sub-role edits its data. Null
    /// while the study holds it; cleared when review returns it to the study.
    /// </summary>
    public DateTime? HandedToReviewAtUtc { get; set; }

    public string? HandedToReviewByUserId { get; set; }

    /// <summary>
    /// Review approved the reports (and sent the valuation draft to the appraiser). From then on no
    /// one edits the transaction's data without reopening it. Cleared by a reopen or a return.
    /// </summary>
    public DateTime? ReviewApprovedAtUtc { get; set; }

    public string? ReviewApprovedByUserId { get; set; }

    public DateTime CreatedAtUtc { get; set; }

    public DateTime UpdatedAtUtc { get; set; }

    public ICollection<WorkOrderProperty> Properties { get; set; } = [];

    public bool IsHandedToReview => HandedToReviewAtUtc is not null;

    public bool IsReviewApproved => ReviewApprovedAtUtc is not null;

    /// <summary>
    /// Moves the transaction between the study and review (Omar 2026-11-05): handed, approved, or back
    /// with the study.
    /// </summary>
    /// <remarks>
    /// How it works: «handed» stamps the handover (and clears an old approval); «approved» stamps the
    /// approval (and the handover when missing); «study» clears both. Returns false when nothing changed.
    /// Edge cases: a repeated state keeps its first stamp, so retries are harmless.
    /// </remarks>
    public bool SetReviewState(TransactionReviewState state, string? userId, DateTime nowUtc)
    {
        var who = string.IsNullOrWhiteSpace(userId) ? null : userId.Trim();
        var changed = false;
        switch (state)
        {
            case TransactionReviewState.Handed:
                if (HandedToReviewAtUtc is null) { HandedToReviewAtUtc = nowUtc; HandedToReviewByUserId = who; changed = true; }
                if (ReviewApprovedAtUtc is not null) { ReviewApprovedAtUtc = null; ReviewApprovedByUserId = null; changed = true; }
                break;
            case TransactionReviewState.Approved:
                if (HandedToReviewAtUtc is null) { HandedToReviewAtUtc = nowUtc; HandedToReviewByUserId = who; changed = true; }
                if (ReviewApprovedAtUtc is null) { ReviewApprovedAtUtc = nowUtc; ReviewApprovedByUserId = who; changed = true; }
                break;
            default:
                if (HandedToReviewAtUtc is not null || ReviewApprovedAtUtc is not null)
                {
                    HandedToReviewAtUtc = null; HandedToReviewByUserId = null;
                    ReviewApprovedAtUtc = null; ReviewApprovedByUserId = null;
                    changed = true;
                }
                break;
        }
        if (changed) UpdatedAtUtc = nowUtc;
        return changed;
    }

    public bool IsReceived => ReceivedAtUtc is not null;

    /// <summary>Stamps the formal receipt once; a second call is a no-op and returns false.</summary>
    /// <remarks>
    /// How it works: when not received yet, keeps who and when (name trimmed, «—» when blank) and
    /// returns true. Edge cases: never cleared — returning work to a party after the receipt keeps
    /// the transaction in the study queue (ruling 2026-11-02).
    /// </remarks>
    public bool MarkReceived(string? userId, string? name, DateTime nowUtc)
    {
        if (IsReceived) return false;
        ReceivedAtUtc = nowUtc;
        ReceivedByUserId = string.IsNullOrWhiteSpace(userId) ? null : userId.Trim();
        ReceivedByName = string.IsNullOrWhiteSpace(name) ? "—" : name.Trim();
        UpdatedAtUtc = nowUtc;
        return true;
    }

    /// <summary>
    /// Back to coordination (Omar 2026-11-08): the study returned the inspection to the inspector after the
    /// send — the transaction goes back to the coordinator's follow-up and is sent to the study again once
    /// the corrected work is received. Edge cases: only a received transaction moves; returns whether it did.
    /// </summary>
    public bool ClearReceipt(DateTime nowUtc)
    {
        if (!IsReceived) return false;
        ReceivedAtUtc = null;
        ReceivedByUserId = null;
        ReceivedByName = null;
        UpdatedAtUtc = nowUtc;
        return true;
    }

    /// <summary>The number is locked (first report approved or handed over) — see <see cref="ConfirmedAtUtc"/>.</summary>
    public bool IsConfirmed => ConfirmedAtUtc is not null;

    public bool IsMerged => MergedIntoTransactionId is not null;

    /// <summary>
    /// The number people see for the property: its number, else "" (waiting for the first deed's initial
    /// data). An old row's TMP is history only and never shown (ruling 2026-11-08).
    /// </summary>
    public string DisplayNumber => ReferenceNumber ?? "";

    /// <summary>A new transaction for a deed — no number until the deed's initial data is first saved.</summary>
    public static Transaction Create(DateTime nowUtc) => new()
    {
        Id = Guid.NewGuid(),
        CreatedAtUtc = nowUtc,
        UpdatedAtUtc = nowUtc,
    };

    /// <summary>
    /// A transaction row as it was stored before 2026-11-08 — carrying only a TMP draft number. Used to
    /// build old rows (tests, data from that period); new code calls <see cref="Create"/>.
    /// </summary>
    public static Transaction CreateDraft(string draftNumber, DateTime nowUtc)
    {
        var transaction = Create(nowUtc);
        transaction.DraftNumber = draftNumber.Trim();
        return transaction;
    }

    /// <summary>Locks the number once (first approved report or Enfaz handover); a second call is a no-op.</summary>
    /// <remarks>
    /// How it works: when not locked yet, stamps ConfirmedAtUtc / UpdatedAtUtc and returns true;
    /// otherwise returns false and changes nothing.
    /// Edge cases: a reopen never clears the lock (prod PO-067455 kept its number after an issue reopened
    /// 21 s later), so a deed never leaves a property whose report number was printed.
    /// </remarks>
    public bool LockReference(DateTime nowUtc)
    {
        if (IsConfirmed) return false;
        ConfirmedAtUtc = nowUtc;
        UpdatedAtUtc = nowUtc;
        return true;
    }

    /// <summary>
    /// Recomputes the property's number from its live deeds (<see cref="TransactionReferenceRules.PropertyReference"/>);
    /// returns whether it changed.
    /// </summary>
    /// <remarks>
    /// How it works: passes the live deeds' numbers, the current number and the lock to the rule and
    /// stores the result. Edge cases: no numbered live deed leaves the current number untouched (a
    /// transaction never loses a number it showed); a merged-away transaction is never renumbered here.
    /// </remarks>
    public bool RefreshReference(DateTime nowUtc)
    {
        if (IsMerged) return false;
        var next = TransactionReferenceRules.PropertyReference(
            Properties.Where(p => !p.IsRemoved).Select(p => p.ReferenceNumber),
            ReferenceNumber,
            IsConfirmed);
        if (next is null || string.Equals(next, ReferenceNumber, StringComparison.Ordinal)) return false;
        ReferenceNumber = next;
        UpdatedAtUtc = nowUtc;
        return true;
    }
}

/// <summary>
/// The property's number from its deeds' numbers (ruling 2026-11-08): one deed → its number; several →
/// the root deed's number plus «-L». The root is the smallest number at the moment the deeds are linked,
/// and stays when another deed joins later.
/// </summary>
public static class TransactionReferenceRules
{
    /// <summary>The property number for these live deed numbers, given the current number and the lock.</summary>
    /// <remarks>
    /// How it works: 1) keeps the non-blank deed numbers (trimmed, distinct); none → null; one → that
    /// number. 2) Several: the root stays the current root when it is still one of the deeds and the
    /// current number is either already linked («-L») or locked (a single property whose reports were
    /// approved keeps its number as the root); otherwise the root is the smallest number
    /// (<see cref="ReferenceNumbering.Order"/>). 3) Returns root + «-L».
    /// Edge cases: a later deed with a smaller number joining an already linked property does not move
    /// the root; the root deed leaving (unmerge before approval) re-derives from the smallest left; a
    /// single unlocked property merged with a smaller deed takes the smaller one as root (smallest at
    /// merge time).
    /// </remarks>
    public static string? PropertyReference(
        IEnumerable<string?> liveDeedNumbers,
        string? currentReference,
        bool locked)
    {
        var numbers = liveDeedNumbers
            .Where(n => !string.IsNullOrWhiteSpace(n))
            .Select(n => n!.Trim())
            .Distinct(StringComparer.Ordinal)
            .ToList();
        if (numbers.Count == 0) return null;
        if (numbers.Count == 1) return numbers[0];

        var currentRoot = ReferenceNumbering.RootOf(currentReference);
        var keepRoot = currentRoot is not null
            && numbers.Contains(currentRoot, StringComparer.Ordinal)
            && (ReferenceNumbering.IsLinked(currentReference) || locked);
        var root = keepRoot ? currentRoot! : numbers.Min(ReferenceNumbering.Order)!;
        return ReferenceNumbering.Linked(root);
    }
}

/// <summary>
/// One study per transaction: the study row stays on the
/// case-study parent task of the holder deed; every other deed's study flow folds into it.
/// </summary>
public static class TransactionStudyRules
{
    /// <summary>
    /// The holder deed: the recorded one while it is still a live deed of the transaction, else the
    /// first live deed (by its work order's receipt, then deed number). Null when the transaction
    /// has no live deed.
    /// </summary>
    /// <remarks>
    /// How it works: 1) keeps only the deeds that are not removed; 2) returns the recorded
    /// StudyHolderPropertyId when it is still one of them; 3) otherwise orders the live deeds by
    /// their work order's CreatedAtUtc, then by deed number (ordinal), and returns the first.
    /// Edge cases: a recorded holder that was removed falls back to the ordering rule; a deed whose
    /// work order is not loaded sorts last (DateTime.MaxValue) instead of throwing.
    /// </remarks>
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

/// <summary>How the deeds of one transaction are linked.</summary>
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

/// <summary>Where a transaction stands between the study and review (Omar 2026-11-05).</summary>
/// <summary>The wire names of <see cref="TransactionReviewState"/> (study | handed | approved).</summary>
public static class TransactionReviewStates
{
    public const string Study = "study";
    public const string Handed = "handed";
    public const string Approved = "approved";

    public static TransactionReviewState? Parse(string? value) => value?.Trim().ToLowerInvariant() switch
    {
        Study => TransactionReviewState.Study,
        Handed => TransactionReviewState.Handed,
        Approved => TransactionReviewState.Approved,
        _ => null,
    };

    public static string Of(Transaction t) =>
        t.IsReviewApproved ? Approved : t.IsHandedToReview ? Handed : Study;
}

public enum TransactionReviewState
{
    /// <summary>With the study — every specialist edits.</summary>
    Study = 0,

    /// <summary>The study sent to review (Omar 2026-11-08: every specialist still edits until review approves it).</summary>
    Handed = 1,

    /// <summary>Review approved the study — no one edits until review returns it or the transaction is reopened.</summary>
    Approved = 2,
}

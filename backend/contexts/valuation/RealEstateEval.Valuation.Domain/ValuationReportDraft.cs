using RealEstateEval.Domain;

namespace RealEstateEval.Valuation.Domain;

/// <summary>Lifecycle of the valuation-report draft the case specialist prepares for the appraiser.</summary>
public static class ReportDraftStatuses
{
    /// <summary>The specialist is preparing the report (his own report choices); the appraiser sees nothing yet.</summary>
    public const string Preparing = "preparing";

    /// <summary>
    /// The study handed it to review with the issued study report, in one batch (Omar 2026-11-05): review
    /// alone edits it, then sends it to the appraiser or returns it to the study with a reason. The appraiser
    /// sees it as «preparing».
    /// </summary>
    public const string InReview = "in_review";

    /// <summary>Sent to the appraiser, who reviews it and approves (or review withdraws it).</summary>
    public const string Sent = "sent";

    /// <summary>The appraiser approved: the report is frozen (deposit copy) and waits for the Qeema deposit code.</summary>
    public const string Approved = "approved";

    public static readonly IReadOnlyList<string> All = [Preparing, InReview, Sent, Approved];
}

/// <summary>
/// The draft of the valuation report, from the appraiser's hand-over to his approval. After the
/// appraiser submits his package the case specialist (his assistant) prepares the report — his own
/// choices (the print attachments; ESG is the appraiser's) and the confirmation that the valuation matches the property
/// study — and sends it; the appraiser reviews and approves it (the approved printed report is
/// snapshotted), or the specialist withdraws it. The appraiser's own sections (opinion, reconciliation)
/// are his valuation data, locked at hand-over — they are not written here.
/// One row per cycle (<see cref="Version"/>): a new version (after a deposit) starts a new draft.
/// </summary>
public class ValuationReportDraft
{
    public Guid Id { get; set; }
    public Guid ValuationRequestId { get; set; }

    /// <summary>Report cycle — equals the deposit-copy version this draft leads to (1, 2 …).</summary>
    public int Version { get; set; } = 1;

    public string Status { get; set; } = ReportDraftStatuses.Preparing;

    /// <summary>
    /// The report choices the specialist owns (allow-listed keys only, see <c>ReportDraftChoiceRules</c>):
    /// they overlay the appraiser's own report choices when the report is rendered.
    /// </summary>
    public string SpecialistChoicesJson { get; set; } = "{}";

    /// <summary>Latest note from the specialist to the appraiser (sending / re-sending).</summary>
    public string? SpecialistNote { get; set; }

    /// <summary>Latest note from the appraiser to the specialist (withdrawing his approval).</summary>
    public string? AppraiserNote { get; set; }

    /// <summary>The specialist confirmed the valuation is consistent with the property study — required to send.</summary>
    public DateTime? ConformityConfirmedAtUtc { get; set; }
    public string? ConformityConfirmedByUserId { get; set; }

    /// <summary>When (and by whom) the study handed the draft to review; cleared when it goes back to the study.</summary>
    public DateTime? SubmittedForReviewAtUtc { get; set; }
    public string? SubmittedForReviewByUserId { get; set; }

    /// <summary>Review's latest reason for returning the draft to the study.</summary>
    public string? ReviewNote { get; set; }

    public DateTime? SentAtUtc { get; set; }
    public string? SentByUserId { get; set; }

    public DateTime? ApprovedAtUtc { get; set; }
    public string? ApprovedByUserId { get; set; }

    /// <summary>The report date printed on the report (yyyy-MM-dd): fixed by the appraiser at approval.</summary>
    public string? ReportDate { get; set; }

    /// <summary>The approved printed report (HTML, gzip) as the appraiser saw it when he approved.</summary>
    public byte[]? SnapshotHtmlGz { get; set; }
    public string? SnapshotSha256 { get; set; }
    public int? SnapshotHtmlBytes { get; set; }

    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }

    public static ValuationReportDraft Start(Guid valuationRequestId, int version, DateTime nowUtc) => new()
    {
        Id = Guid.NewGuid(),
        ValuationRequestId = valuationRequestId,
        Version = version,
        CreatedAtUtc = nowUtc,
        UpdatedAtUtc = nowUtc,
    };

    public bool IsPreparing => Status == ReportDraftStatuses.Preparing;
    public bool IsInReview => Status == ReportDraftStatuses.InReview;
    public bool IsSent => Status == ReportDraftStatuses.Sent;
    public bool IsApproved => Status == ReportDraftStatuses.Approved;

    public const string StaleChoicesAr = "حفظ مستخدم آخر تعديلات أحدث — أعد تحميل الصفحة";

    /// <summary>
    /// Optimistic concurrency for the report choices: whether the caller's loaded copy is older than this
    /// draft (no schema change — the token is <see cref="UpdatedAtUtc"/>).
    /// </summary>
    /// <remarks>
    /// How it works: <paramref name="expectedUpdatedAtUtc"/> null = the caller sent no token → never stale.
    /// <paramref name="callerSawNoDraft"/> (token "") = the caller loaded no draft → stale when one already
    /// existed (<paramref name="isNewDraft"/> false). Otherwise stale when this draft was just started (the
    /// caller's draft is gone) or the stamps differ. Compared at microsecond precision — the database keeps
    /// microseconds, .NET ticks are 100 ns.
    /// Edge cases: fixed 2026-11-10 — two specialists autosaving the whole choices object silently replaced
    /// each other (last writer wins).
    /// </remarks>
    public bool IsStaleFor(DateTime? expectedUpdatedAtUtc, bool callerSawNoDraft, bool isNewDraft)
    {
        if (callerSawNoDraft) return !isNewDraft;
        if (expectedUpdatedAtUtc is not { } expected) return false;
        if (isNewDraft) return true;
        return UpdatedAtUtc.Ticks / 10 != expected.Ticks / 10;
    }

    /// <summary>
    /// The report choices are saved while the study prepares, or while review holds the draft (review alone
    /// edits it then — the caller checks who).
    /// </summary>
    public string? SaveChoices(string normalizedChoicesJson, DateTime nowUtc)
    {
        if (!IsPreparing && !IsInReview) return NotPreparingAr;
        SpecialistChoicesJson = normalizedChoicesJson;
        // A changed draft is no longer what he confirmed against the study.
        ConformityConfirmedAtUtc = null;
        ConformityConfirmedByUserId = null;
        UpdatedAtUtc = nowUtc;
        return null;
    }

    /// <summary>
    /// Review issues the draft to the appraiser (Omar 2026-11-08) with the conformity confirmation ticked now.
    /// </summary>
    /// <remarks>
    /// How it works: a sent draft is a no-op; only preparing / legacy in-review drafts go; the tick is
    /// required and stamped with the sender.
    /// Edge cases + fixed 2026-11-10: a legacy draft still «in review» (2026-11-05 flow) used to go out on the
    /// study's old confirmation (and the screen sent the tick for it automatically) — it now needs the tick
    /// like any other.
    /// </remarks>
    public string? Send(bool conformityConfirmed, string? note, string? byUserId, DateTime nowUtc)
    {
        if (IsSent) return null;
        if (!IsPreparing && !IsInReview) return NotPreparingAr;
        if (!conformityConfirmed) return ConformityRequiredAr;

        ConformityConfirmedAtUtc = nowUtc;
        ConformityConfirmedByUserId = Clean(byUserId);
        SubmittedForReviewAtUtc ??= nowUtc;
        SubmittedForReviewByUserId ??= Clean(byUserId);
        SpecialistNote = Clean(note) ?? SpecialistNote;
        SentAtUtc = nowUtc;
        SentByUserId = Clean(byUserId);
        Status = ReportDraftStatuses.Sent;
        UpdatedAtUtc = nowUtc;
        return null;
    }

    /// <summary>The draft goes back to preparing (idempotent) with review's optional note to the appraiser.</summary>
    /// <remarks>How it works: writes the specialist note, then <see cref="BackToPreparing"/>.</remarks>
    public string? Withdraw(string? note, DateTime nowUtc)
    {
        if (IsPreparing) return null;
        if (IsApproved) return ApprovedCannotBeWithdrawnAr;

        SpecialistNote = Clean(note);
        BackToPreparing(nowUtc);
        return null;
    }

    /// <summary>
    /// The one way back to preparing (review's withdraw, the appraiser's return): clears the sent, the
    /// hand-over and the conformity stamps so a «preparing» draft never shows them.
    /// </summary>
    /// <remarks>
    /// Edge cases + fixed 2026-11-10: the appraiser's return used to keep the conformity and hand-over
    /// stamps (still shown on a «preparing» draft); both ways now clear the same stamps.
    /// </remarks>
    private void BackToPreparing(DateTime nowUtc)
    {
        SentAtUtc = null;
        SentByUserId = null;
        SubmittedForReviewAtUtc = null;
        SubmittedForReviewByUserId = null;
        ConformityConfirmedAtUtc = null;
        ConformityConfirmedByUserId = null;
        Status = ReportDraftStatuses.Preparing;
        UpdatedAtUtc = nowUtc;
    }

    public const string ReturnToReviewReasonRequiredAr = "اكتب سبب الإرجاع للمراجع";

    /// <summary>
    /// The appraiser returns the draft to review with a reason (Omar 2026-11-08) — he never edits it himself;
    /// review corrects and issues it to him again.
    /// </summary>
    /// <remarks>
    /// How it works: only a sent draft; the reason becomes the review note, then <see cref="BackToPreparing"/>
    /// (2026-11-10: clears the conformity and hand-over stamps too, like review's withdraw).
    /// </remarks>
    public string? ReturnToReviewer(string? reason, DateTime nowUtc)
    {
        if (!IsSent) return NotSentAr;
        var note = reason?.Trim() ?? "";
        if (note.Length < 3) return ReturnToReviewReasonRequiredAr;
        ReviewNote = note.Length > 1000 ? note[..1000] : note;
        BackToPreparing(nowUtc);
        return null;
    }

    /// <summary>The appraiser approves the sent draft; the printed report as he saw it is kept.</summary>
    public string? Approve(
        string reportDate,
        byte[] snapshotHtmlGz,
        string snapshotSha256,
        int snapshotHtmlBytes,
        string? byUserId,
        DateTime nowUtc)
    {
        if (IsApproved) return null;
        if (!IsSent) return NotSentAr;
        if (!DateOnly.TryParseExact(reportDate?.Trim(), "yyyy-MM-dd", out _)) return ReportDateInvalidAr;
        if (snapshotHtmlGz.Length == 0) return SnapshotRequiredAr;

        ReportDate = reportDate!.Trim();
        SnapshotHtmlGz = snapshotHtmlGz;
        SnapshotSha256 = snapshotSha256.Trim().ToLowerInvariant();
        SnapshotHtmlBytes = snapshotHtmlBytes;
        ApprovedAtUtc = nowUtc;
        ApprovedByUserId = Clean(byUserId);
        Status = ReportDraftStatuses.Approved;
        AppraiserNote = null;
        UpdatedAtUtc = nowUtc;
        return null;
    }

    /// <summary>
    /// The appraiser takes his approval back (before any deposit code is recorded): the draft returns
    /// to «sent» for him to edit-and-approve again, and no version number is spent.
    /// </summary>
    public string? WithdrawApproval(string? note, DateTime nowUtc)
    {
        if (IsSent) return null;
        if (!IsApproved) return NotApprovedAr;

        AppraiserNote = Clean(note);
        ApprovedAtUtc = null;
        ApprovedByUserId = null;
        ReportDate = null;
        SnapshotHtmlGz = null;
        SnapshotSha256 = null;
        SnapshotHtmlBytes = null;
        Status = ReportDraftStatuses.Sent;
        UpdatedAtUtc = nowUtc;
        return null;
    }

    public const string NotPreparingAr = "مسودة التقرير ليست قيد الإعداد — اسحبها أولاً";
    public const string NotSentAr = "لم تُرسَل مسودة التقرير للمقيّم بعد";
    public const string NotApprovedAr = "التقرير غير معتمد";
    public const string ConformityRequiredAr = "أكّد أن التقييم مطابق لدراسة العقار قبل الإرسال";
    public const string ApprovedCannotBeWithdrawnAr = "اعتمد المقيّم التقرير — لا تُسحب المسودة";
    public const string ReportDateInvalidAr = "تاريخ التقرير غير صالح";
    public const string ReportDateNotTodayAr =
        "تاريخ جهازك لا يطابق تاريخ اليوم — حدّث الصفحة وتأكد من ضبط تاريخ الجهاز ثم اعتمد";

    /// <summary>
    /// The report date is the approval date. The printed report is built in the browser before the server sees
    /// it, so the browser's date is sent and accepted only within a day of the server's (Riyadh) date.
    /// </summary>
    public static bool IsApprovalDate(string? reportDate, DateTime nowUtc) =>
        DateOnly.TryParseExact(reportDate?.Trim(), "yyyy-MM-dd", out var date)
        && Math.Abs(date.DayNumber - RiyadhClock.Today(nowUtc).DayNumber) <= 1;
    /// <summary>The report date fixed on an approved draft (yyyy-MM-dd), or null before approval.</summary>
    public static DateOnly? ApprovedDateOf(string? status, string? reportDate) =>
        status == ReportDraftStatuses.Approved
        && DateOnly.TryParseExact(
            reportDate?.Trim(),
            "yyyy-MM-dd",
            System.Globalization.CultureInfo.InvariantCulture,
            System.Globalization.DateTimeStyles.None,
            out var date)
            ? date
            : null;

    public const string SnapshotRequiredAr = "نسخة التقرير المطبوعة مطلوبة للاعتماد";

    private static string? Clean(string? value)
    {
        var trimmed = value?.Trim();
        return string.IsNullOrEmpty(trimmed) ? null : trimmed;
    }
}

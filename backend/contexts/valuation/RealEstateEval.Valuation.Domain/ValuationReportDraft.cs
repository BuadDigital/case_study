namespace RealEstateEval.Valuation.Domain;

/// <summary>Lifecycle of the valuation-report draft the case specialist prepares for the appraiser.</summary>
public static class ReportDraftStatuses
{
    /// <summary>The specialist is preparing the report (his own report choices); the appraiser sees nothing yet.</summary>
    public const string Preparing = "preparing";

    /// <summary>Sent to the appraiser, who reviews it and approves (or the specialist withdraws it).</summary>
    public const string Sent = "sent";

    /// <summary>The appraiser approved: the report is frozen (deposit copy) and waits for the Qeema deposit code.</summary>
    public const string Approved = "approved";

    public static readonly IReadOnlyList<string> All = [Preparing, Sent, Approved];
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
    public bool IsSent => Status == ReportDraftStatuses.Sent;
    public bool IsApproved => Status == ReportDraftStatuses.Approved;

    /// <summary>The specialist saves his report choices — only while he is preparing.</summary>
    public string? SaveChoices(string normalizedChoicesJson, DateTime nowUtc)
    {
        if (!IsPreparing) return NotPreparingAr;
        SpecialistChoicesJson = normalizedChoicesJson;
        // A changed draft is no longer what he confirmed against the study.
        ConformityConfirmedAtUtc = null;
        ConformityConfirmedByUserId = null;
        UpdatedAtUtc = nowUtc;
        return null;
    }

    /// <summary>Sends the draft to the appraiser — needs the explicit conformity confirmation.</summary>
    public string? Send(bool conformityConfirmed, string? note, string? byUserId, DateTime nowUtc)
    {
        if (IsSent) return null;
        if (!IsPreparing) return NotPreparingAr;
        if (!conformityConfirmed) return ConformityRequiredAr;

        ConformityConfirmedAtUtc = nowUtc;
        ConformityConfirmedByUserId = Clean(byUserId);
        SpecialistNote = Clean(note);
        SentAtUtc = nowUtc;
        SentByUserId = Clean(byUserId);
        Status = ReportDraftStatuses.Sent;
        UpdatedAtUtc = nowUtc;
        return null;
    }

    /// <summary>The specialist pulls a sent draft back (idempotent), with an optional note for the appraiser.</summary>
    public string? Withdraw(string? note, DateTime nowUtc)
    {
        if (IsPreparing) return null;
        if (IsApproved) return ApprovedCannotBeWithdrawnAr;

        SpecialistNote = Clean(note);
        SentAtUtc = null;
        SentByUserId = null;
        ConformityConfirmedAtUtc = null;
        ConformityConfirmedByUserId = null;
        Status = ReportDraftStatuses.Preparing;
        UpdatedAtUtc = nowUtc;
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

    /// <summary>Saudi Arabia keeps UTC+3 all year (no daylight saving).</summary>
    public static DateOnly RiyadhToday(DateTime nowUtc) => DateOnly.FromDateTime(nowUtc.AddHours(3));

    /// <summary>
    /// The report date is the approval date. The printed report is built in the browser before the server sees
    /// it, so the browser's date is sent and accepted only within a day of the server's (Riyadh) date.
    /// </summary>
    public static bool IsApprovalDate(string? reportDate, DateTime nowUtc) =>
        DateOnly.TryParseExact(reportDate?.Trim(), "yyyy-MM-dd", out var date)
        && Math.Abs(date.DayNumber - RiyadhToday(nowUtc).DayNumber) <= 1;
    public const string SnapshotRequiredAr = "نسخة التقرير المطبوعة مطلوبة للاعتماد";

    private static string? Clean(string? value)
    {
        var trimmed = value?.Trim();
        return string.IsNullOrEmpty(trimmed) ? null : trimmed;
    }
}

using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;

namespace RealEstateEval.Valuation.Application.Rules;

/// <summary>
/// The timeline milestones the report cycle writes: one stable wording and one tick-versioned key per event,
/// so a repeated step (a second send, a new version) shows again instead of being skipped as «already recorded».
/// </summary>
public static class ValuationTimelineTexts
{
    public const string DraftSentTitleAr = "إرسال مسودة التقرير للمقيّم";
    public const string DraftWithdrawnTitleAr = "سحب مسودة التقرير";
    public const string ApprovedTitleAr = "اعتماد المقيّم للتقرير";
    public const string ApprovalWithdrawnTitleAr = "سحب اعتماد التقرير";
    public const string DepositTitleAr = "تسجيل رمز الإيداع";
    public const string NewVersionTitleAr = "فتح نسخة جديدة من التقرير";
    public const string RecallRequestedTitleAr = "طلب استرجاع التقييم";
    public const string RecallApprovedTitleAr = "قبول الأخصائي لاسترجاع التقييم";
    public const string RecallRejectedTitleAr = "رفض الأخصائي لاسترجاع التقييم";

    public static PropertyTimelineRecordRequest DraftSent(
        string po, Guid propertyId, Guid requestId, string? actor, string? note, DateTime at) =>
        Event(po, propertyId, $"valuation:{requestId:D}:draft-sent:{at.Ticks}",
            DraftSentTitleAr, Detail(actor, note), PropertyTimelineTones.Done, at);

    public static PropertyTimelineRecordRequest DraftWithdrawn(
        string po, Guid propertyId, Guid requestId, string? actor, string? note, DateTime at) =>
        Event(po, propertyId, $"valuation:{requestId:D}:draft-withdrawn:{at.Ticks}",
            DraftWithdrawnTitleAr, Detail(actor, note), PropertyTimelineTones.Warn, at);

    public static PropertyTimelineRecordRequest Approved(
        string po, Guid propertyId, Guid requestId, string? actor, string? reportDate, DateTime at) =>
        Event(po, propertyId, $"valuation:{requestId:D}:approved:{at.Ticks}",
            ApprovedTitleAr,
            Join(actor, string.IsNullOrWhiteSpace(reportDate) ? null : $"تاريخ التقرير {reportDate.Trim()}"),
            PropertyTimelineTones.Done, at);

    public static PropertyTimelineRecordRequest ApprovalWithdrawn(
        string po, Guid propertyId, Guid requestId, string? actor, string? note, DateTime at) =>
        Event(po, propertyId, $"valuation:{requestId:D}:approval-withdrawn:{at.Ticks}",
            ApprovalWithdrawnTitleAr, Detail(actor, note), PropertyTimelineTones.Warn, at);

    public static PropertyTimelineRecordRequest Deposit(
        string po, Guid propertyId, Guid requestId, string? actor, string? code, DateTime at) =>
        Event(po, propertyId, $"valuation:{requestId:D}:deposit:{at.Ticks}",
            DepositTitleAr, Join(string.IsNullOrWhiteSpace(code) ? null : $"الرمز {code.Trim()}", actor),
            PropertyTimelineTones.Done, at);

    public static PropertyTimelineRecordRequest NewVersion(
        string po, Guid propertyId, Guid requestId, string? actor, string? reason, DateTime at) =>
        Event(po, propertyId, $"valuation:{requestId:D}:new-version:{at.Ticks}",
            NewVersionTitleAr, Detail(actor, reason), PropertyTimelineTones.Warn, at);

    public static PropertyTimelineRecordRequest RecallRequested(
        string po, Guid propertyId, Guid taskId, string? reason, DateTime at) =>
        Event(po, propertyId, $"recall:{taskId:D}:requested:{at.Ticks}",
            RecallRequestedTitleAr, Detail(null, reason), PropertyTimelineTones.Warn, at);

    public static PropertyTimelineRecordRequest RecallDecided(
        string po, Guid propertyId, Guid taskId, bool approved, string? note, DateTime at) =>
        Event(po, propertyId, $"recall:{taskId:D}:{(approved ? "approved" : "rejected")}:{at.Ticks}",
            approved ? RecallApprovedTitleAr : RecallRejectedTitleAr,
            Detail(null, note),
            approved ? PropertyTimelineTones.Done : PropertyTimelineTones.Warn,
            at);

    /// <summary>«الاسم — الملاحظة» (either part may be missing; null when both are).</summary>
    internal static string? Detail(string? actor, string? note) =>
        Join(actor, string.IsNullOrWhiteSpace(note) ? null : note.Trim(), " — ");

    private static string? Join(string? first, string? second, string separator = " · ")
    {
        var parts = new[] { first?.Trim(), second?.Trim() }.Where(p => !string.IsNullOrEmpty(p)).ToList();
        return parts.Count == 0 ? null : string.Join(separator, parts);
    }

    private static PropertyTimelineRecordRequest Event(
        string po, Guid propertyId, string key, string title, string? detail, string tone, DateTime at) =>
        new(po, propertyId, key, title, detail, tone, at);
}

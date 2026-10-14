using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Infrastructure.Persistence;

/// <summary>
/// Read side: stored rows → the business milestones the rail shows, oldest first. Rows written before the
/// timeline became «one milestone per business step» are folded away or re-worded here, never deleted.
/// </summary>
public sealed partial class PropertyTimelineService
{
    /// <summary>Distribution rows and their legacy per-party rows are written within this window of each other.</summary>
    private static readonly TimeSpan LegacyDistributionWindow = TimeSpan.FromSeconds(5);

    private const string LegacyAssignedPrefixAr = "تعيين ";

    /// <summary>Old wording → the wording of the current vocabulary (see the timeline plan).</summary>
    private static readonly Dictionary<string, string> LegacyTitles = new(StringComparer.Ordinal)
    {
        ["استلام من إنفاذ"] = "استلام أمر العمل من إنفاذ",
        ["بيانات البورصة للعقار"] = "إتمام استعلام البورصة",
        ["تسليم التقييم للأخصائي"] = "تسليم المقيّم لتقييمه",
        ["اعتماد تقرير التقييم"] = "اطلاع الأخصائي على التقييم",
        ["استلام بيانات المعاينة"] = "قبول الأخصائي لمخرجات المعاينة",
        ["رُفعت المعاملة على إنفاذ (التسليم الشامل — ق-9)"] = "رفع المعاملة على إنفاذ",
    };

    /// <summary>
    /// Technical rows that are not business milestones: the due date (it lives in «مواعيد مهمة»), the task
    /// bookkeeping rows, the second bourse row, and the per-party / case-specialist assignment rows that the
    /// single «توزيع المعاملة» row now names.
    /// </summary>
    internal static bool IsLegacyTechnicalKey(string key) =>
        key == "due"
        || (key.StartsWith("task:", StringComparison.Ordinal)
            && (key.EndsWith(":created", StringComparison.Ordinal)
                || key.EndsWith(":bourse-complete", StringComparison.Ordinal)
                || key.EndsWith(":case-study", StringComparison.Ordinal)
                || key.EndsWith(":specialist-assigned", StringComparison.Ordinal)
                || key.EndsWith(":blocked", StringComparison.Ordinal)))
        || (key.StartsWith("party:", StringComparison.Ordinal)
            && key.EndsWith(":assigned", StringComparison.Ordinal));

    private static bool IsDistributionKey(string key) =>
        key.StartsWith("task:", StringComparison.Ordinal)
        && key.Contains(":distribution", StringComparison.Ordinal);

    internal static IReadOnlyList<PropertyTimelineEventDto> Project(IReadOnlyCollection<PropertyTimelineEntry> rows)
    {
        var hidden = rows.Where(r => IsLegacyTechnicalKey(r.EventKey)).ToList();
        return rows
            .Where(r => !IsLegacyTechnicalKey(r.EventKey))
            .OrderBy(r => r.OccurredAtUtc)
            .ThenBy(r => r.RecordedAtUtc)
            .ThenBy(r => r.EventKey, StringComparer.Ordinal)
            .Select(r => ToDto(r, hidden))
            .ToList();
    }

    private static PropertyTimelineEventDto ToDto(
        PropertyTimelineEntry entry,
        IReadOnlyList<PropertyTimelineEntry> hidden) => new()
    {
        Id = entry.EventKey,
        At = AtOf(entry.OccurredAtUtc),
        Title = ModernTitle(entry.Title),
        Detail = entry.Detail ?? (IsDistributionKey(entry.EventKey) ? LegacyDistributionDetail(entry, hidden) : null),
        Tone = ModernTone(entry),
    };

    /// <summary>A date recorded without a time (midnight UTC) is shown as a date only — never a made-up «03:00».</summary>
    internal static string AtOf(DateTime occurredAtUtc) =>
        occurredAtUtc.TimeOfDay == TimeSpan.Zero
            ? DateOnly.FromDateTime(occurredAtUtc).ToString("yyyy-MM-dd")
            : occurredAtUtc.ToString("O");

    internal static string ModernTitle(string title)
    {
        var t = title.Trim();
        if (LegacyTitles.TryGetValue(t, out var modern)) return modern;
        // «إعادة إسناد — تعيين المعاين الميداني» → «إعادة إسناد — المعاين الميداني»
        const string redistribution = "إعادة إسناد — ";
        if (t.StartsWith(redistribution + LegacyAssignedPrefixAr, StringComparison.Ordinal))
            return redistribution + t[(redistribution.Length + LegacyAssignedPrefixAr.Length)..];
        return t;
    }

    /// <summary>
    /// Every row is an event that HAPPENED: «done», except the backward moves and problems («warn»). The old
    /// «active» (in progress) and «muted» tones belonged to rows that stood for a state, not an event.
    /// </summary>
    internal static string ModernTone(PropertyTimelineEntry entry)
    {
        var key = entry.EventKey;
        if (entry.Tone == PropertyTimelineTones.Warn
            || key.Contains(":phase-revert", StringComparison.Ordinal)
            || key.Contains(":reopened", StringComparison.Ordinal))
        {
            return PropertyTimelineTones.Warn;
        }

        return PropertyTimelineTones.Done;
    }

    /// <summary>«الدور: الاسم · …» rebuilt from the legacy assignment rows written at the same moment.</summary>
    private static string? LegacyDistributionDetail(
        PropertyTimelineEntry distribution,
        IReadOnlyList<PropertyTimelineEntry> hidden)
    {
        var parts = hidden
            .Where(h => h.EventKey.EndsWith(":assigned", StringComparison.Ordinal)
                        || h.EventKey.EndsWith(":specialist-assigned", StringComparison.Ordinal))
            .Where(h => !string.IsNullOrWhiteSpace(h.Detail)
                        && (h.OccurredAtUtc - distribution.OccurredAtUtc).Duration() <= LegacyDistributionWindow)
            .OrderBy(h => h.EventKey.EndsWith(":specialist-assigned", StringComparison.Ordinal) ? 0 : 1)
            .ThenBy(h => h.EventKey, StringComparer.Ordinal)
            .Select(h =>
            {
                var role = h.Title.StartsWith(LegacyAssignedPrefixAr, StringComparison.Ordinal)
                    ? h.Title[LegacyAssignedPrefixAr.Length..]
                    : h.Title;
                return $"{role}: {h.Detail!.Trim()}";
            })
            .ToList();
        return parts.Count == 0 ? null : string.Join(" · ", parts);
    }
}

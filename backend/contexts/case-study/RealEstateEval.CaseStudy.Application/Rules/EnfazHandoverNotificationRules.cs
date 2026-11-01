using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Contracts;

namespace RealEstateEval.CaseStudy.Application.Rules;

/// <summary>
/// What the finance team is told when a deed is handed over to Enfaz: who hears it, what it says and where it
/// opens. Pure — the service only finds the users and sends what this builds.
/// </summary>
public static class EnfazHandoverNotificationRules
{
    /// <summary>The role that bills Enfaz: every user holding it hears about a new handover.</summary>
    public const string RecipientRole = "financial-officer";

    private const string EligibleTabHref = "/financial?area=revenue&stage=eligible";

    /// <summary>The notice for one handed-over deed.</summary>
    /// <remarks>
    /// How it works: names the deed and the work order in the text, and links to the finance screen's
    /// «مؤهلة للفوترة» tab filtered on that order — where the deed now waits for «تعليم جاهز للفوترة».
    /// Edge cases: a deed with no number falls back to its real-estate registration number, then to the plain
    /// word «صك»; a missing order number drops that part of the text and the link's filter. The source event
    /// carries the handover time, so a deed returned from Enfaz and handed over again notifies once more.
    /// </remarks>
    public static CreateUserNotificationRequest Build(
        Guid propertyId,
        string? poNumber,
        string? deedNumber,
        string? realEstateRegNumber,
        DateTime handedOverAtUtc)
    {
        var po = (poNumber ?? "").Trim();
        var deed = FirstNonEmpty(deedNumber, realEstateRegNumber);
        var deedText = deed is null ? "صك" : $"الصك {deed}";
        var orderText = po.Length > 0 ? $" من أمر العمل {po}" : "";

        return new CreateUserNotificationRequest
        {
            Title = "صك جديد مرفوع على إنفاذ",
            Body = $"رُفع {deedText}{orderText} على إنفاذ. علّمه «جاهز للفوترة» عند ظهور بياناته المالية على منصة إنفاذ.",
            Tone = NotificationContract.Tones.Info,
            Href = po.Length > 0 ? $"{EligibleTabHref}&po={Uri.EscapeDataString(po)}" : EligibleTabHref,
            Category = NotificationContract.Categories.Financial,
            EntityType = NotificationContract.EntityTypes.Property,
            EntityId = propertyId.ToString("D"),
            SourceEvent = $"enfaz-handover:{propertyId:D}:{handedOverAtUtc.Ticks}",
        };
    }

    private static string? FirstNonEmpty(params string?[] values) =>
        values.Select(v => v?.Trim()).FirstOrDefault(v => !string.IsNullOrEmpty(v));
}

using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Contracts;

namespace RealEstateEval.Application.Notifications;

/// <summary>
/// One shape for every «إعادة للتصحيح» in the system — party work, vendor invoices,
/// failures, valuation recalls, catalog suggestions.
///
/// Each of those flows already forces the actor to type a reason and validates it, so the
/// notification always carries it: the recipient has to know WHY before they can act, and a
/// bare "your work came back" costs them a round trip to find out. Tone is always
/// <see cref="NotificationContract.Tones.Warn"/> — something is waiting on them.
/// </summary>
public static class ReturnedForCorrectionNotice
{
    /// <param name="title">Short headline, e.g. «إعادة الفاتورة للتصحيح».</param>
    /// <param name="summary">What happened, without trailing punctuation — the reason is appended to it.</param>
    /// <param name="reason">The mandatory note the actor typed; blank falls back to the summary alone.</param>
    public static CreateUserNotificationRequest Build(
        string title,
        string summary,
        string? reason,
        string href,
        string category,
        string? entityType,
        string? entityId,
        string sourceEvent,
        string? actor = null)
    {
        var note = (reason ?? "").Trim();
        return new CreateUserNotificationRequest
        {
            Title = title,
            Body = note.Length == 0 ? $"{summary}." : $"{summary}: {note}",
            Tone = NotificationContract.Tones.Warn,
            Href = href,
            Category = category,
            EntityType = entityType,
            EntityId = entityId,
            Actor = actor,
            SourceEvent = sourceEvent,
        };
    }
}

using RealEstateEval.Application;
using RealEstateEval.Application.Contracts;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Shared.Contracts;

namespace RealEstateEval.CaseStudy.Application.Services;

public sealed partial class TransactionStateService
{
    /// <summary>The role that bills Enfaz: every user holding it hears about a new handover.</summary>
    internal const string FinanceRole = "financial-officer";

    /// <summary>
    /// Tells the finance team that a deed was handed over to Enfaz, so they know to watch for its financial data.
    /// </summary>
    /// <remarks>
    /// How it works: resolves every user with the financial-officer role and sends each one notification naming
    /// the deed and the work order, linking to the finance screen's «مؤهلة للفوترة» tab filtered on that order —
    /// where the deed now waits for «تعليم جاهز للفوترة». The source event carries the handover time, so a deed
    /// returned from Enfaz and handed over again notifies once more.
    /// Edge cases and how they were fixed: the handover used to tell nobody, and the accountant only found new
    /// deeds by opening the finance screen (the 30-day stall clock was already running). Best-effort: no finance
    /// user, no notification service, or a failure to send never fails the handover, which is already saved.
    /// </remarks>
    private async Task NotifyFinanceOfHandoverAsync(
        Guid workOrderId,
        WorkOrderProperty property,
        CancellationToken cancellationToken)
    {
        if (notifications is null || recipients is null) return;
        try
        {
            var userIds = await recipients.ResolveUserIdsWithPrototypeRoleAsync(FinanceRole, cancellationToken);
            if (userIds.Count == 0) return;

            var po = (await db.GetPoNumberAsync(workOrderId, cancellationToken) ?? "").Trim();
            var deed = FirstNonEmpty(property.DeedNumber, property.RealEstateRegNumber);
            var deedText = deed is null ? "صك" : $"الصك {deed}";
            var orderText = po.Length > 0 ? $" من أمر العمل {po}" : "";
            var handedOverAt = property.EnfazHandoverAtUtc ?? _time.UtcNow();

            await notifications.CreateForUsersAsync(
                userIds,
                new CreateUserNotificationRequest
                {
                    Title = "صك جديد مرفوع على إنفاذ",
                    Body = $"رُفع {deedText}{orderText} على إنفاذ. علّمه «جاهز للفوترة» عند ظهور بياناته المالية على منصة إنفاذ.",
                    Tone = NotificationContract.Tones.Info,
                    Href = po.Length > 0
                        ? $"/financial?area=revenue&stage=eligible&po={Uri.EscapeDataString(po)}"
                        : "/financial?area=revenue&stage=eligible",
                    Category = NotificationContract.Categories.Financial,
                    EntityType = NotificationContract.EntityTypes.Property,
                    EntityId = property.Id.ToString("D"),
                    SourceEvent = $"enfaz-handover:{property.Id:D}:{handedOverAt.Ticks}",
                },
                cancellationToken);
        }
        catch
        {
            // The handover is saved — a failed notification does not undo it.
        }
    }

    private static string? FirstNonEmpty(params string?[] values) =>
        values.Select(v => v?.Trim()).FirstOrDefault(v => !string.IsNullOrEmpty(v));
}

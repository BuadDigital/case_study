using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Services;

/// <summary>
/// Post-patch notices: an obstruction resolved (by a supervisor's hand or by resolving the
/// failure) that hands the transaction back to the case specialist — or re-targets it to a
/// new one — tells that specialist «معاملة أُعيدت إليك»; they had no other way to know.
/// </summary>
public sealed class WorkflowTaskPatchNotifier(
    INotificationService notifications,
    INotificationRecipientResolver recipients) : IWorkflowTaskPatchNotifier
{
    public async Task NotifyAfterPatchAsync(
        WorkflowTask task,
        WorkflowTaskPatchSnapshot before,
        CancellationToken cancellationToken)
    {
        if (!WorkflowTaskLifecycleRules.ShouldNotifySpecialistReturned(
                task,
                before.WasBlocked,
                before.PreviousAssigneeId))
        {
            return;
        }

        var assigneeId = task.AssigneeId?.Trim();
        if (string.IsNullOrWhiteSpace(assigneeId)) return;

        var userId = await recipients.ResolveUserIdForDistributionAssigneeAsync(
            assigneeId,
            cancellationToken);
        if (string.IsNullOrWhiteSpace(userId)) return;

        await notifications.CreateForUserAsync(
            userId,
            new CreateUserNotificationRequest
            {
                Title = "معاملة أُعيدت إليك",
                Body = "أُعيدت المعاملة إليك بعد معالجة التعذّر — تابع دراسة الحالة.",
                Tone = "info",
                Href = $"/case-study/{Uri.EscapeDataString(task.Id.ToString())}",
                Category = "workflow",
                EntityType = "task",
                EntityId = task.Id.ToString(),
                SourceEvent = $"case-study-returned:{task.Id}:{task.UpdatedAtUtc:O}",
            },
            cancellationToken);
    }
}

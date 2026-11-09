using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Application.Rules;

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

        // No specialist is named on the task any more (ruling 2026-11-02): coordination, which
        // follows every failure, hears that the transaction is back after its obstruction.
        var userIds = await recipients.ResolveCaseSpecialistUserIdsAsync(
            CaseSpecialistAudience.Operations,
            cancellationToken);
        if (userIds.Count == 0) return;

        await notifications.CreateForUsersAsync(
            userIds,
            new CreateUserNotificationRequest
            {
                Title = "عادت معاملة بعد معالجة التعذّر",
                Body = "أُعيدت المعاملة إلى مسارها بعد معالجة التعذّر — تابعها.",
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

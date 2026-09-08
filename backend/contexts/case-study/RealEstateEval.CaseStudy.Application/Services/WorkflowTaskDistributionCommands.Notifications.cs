using RealEstateEval.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Services;

/// <summary>Inbox fan-out after confirm / redistribute: the party children and the specialist.</summary>
public sealed partial class WorkflowTaskDistributionCommands
{
    /// <summary>Deed of the parent's property, blank when there is none — what notifications quote.</summary>
    private async Task<string> ParentDeedAsync(WorkflowTask parent, CancellationToken cancellationToken)
    {
        if (parent.PropertyId is not Guid deedPropertyId) return "";
        var prop = await _caseStudy.GetPropertyAsync(deedPropertyId, cancellationToken);
        return prop?.DeedNumber?.Trim() ?? "";
    }

    private async Task NotifyCaseSpecialistAssignedAsync(
        WorkflowTask parent,
        string deed,
        CancellationToken cancellationToken)
    {
        var assigneeId = parent.AssigneeId?.Trim();
        if (string.IsNullOrWhiteSpace(assigneeId)) return;

        var usersByAssignee = await _recipients.ResolveUserIdsForDistributionAssigneesAsync(
            [assigneeId],
            cancellationToken);
        if (!usersByAssignee.TryGetValue(assigneeId, out var userId)) return;

        var refLabel = WorkflowTaskDistributionRules.RefLabel(deed, parent.PoNumber);
        await _notifications.CreateForUsersAsync(
            new Dictionary<string, CreateUserNotificationRequest>(StringComparer.Ordinal)
            {
                [userId] = WorkflowTaskDistributionRules.CaseSpecialistAssignedRequest(parent, refLabel),
            },
            cancellationToken);
    }

    private async Task NotifyDistributionAssignedAsync(
        WorkflowTask parent,
        IReadOnlyCollection<WorkflowTask> children,
        string deed,
        CancellationToken cancellationToken)
    {
        var assigneeIds = WorkflowTaskLifecycleRules.DistinctAssigneeIds(children);
        var usersByAssignee = await _recipients.ResolveUserIdsForDistributionAssigneesAsync(
            assigneeIds,
            cancellationToken);

        var refLabel = WorkflowTaskDistributionRules.RefLabel(deed, parent.PoNumber);
        var requestsByUser = WorkflowTaskDistributionRules.DistributionAssignedRequests(
            parent,
            children,
            usersByAssignee,
            refLabel);

        await _notifications.CreateForUsersAsync(requestsByUser, cancellationToken);
    }
}

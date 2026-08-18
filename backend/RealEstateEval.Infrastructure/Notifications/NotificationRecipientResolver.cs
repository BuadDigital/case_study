using RealEstateEval.Application.Abstractions;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Services;

namespace RealEstateEval.Infrastructure.Notifications;

/// <summary>
/// Resolves notification recipients. Workflow assignees come from Case Study
/// (<see cref="IWorkflowAssigneeLookup"/>); profile and email maps come from Identity
/// (<see cref="IIdentityDirectory"/>).
/// </summary>
public sealed class NotificationRecipientResolver
{
    private readonly IWorkflowAssigneeLookup _assignees;
    private readonly IIdentityDirectory _identity;

    /// <summary>Test helper wiring EF-backed lookups; DI uses the interface constructor.</summary>
    public static NotificationRecipientResolver ForContexts(
        CaseStudyDbContext caseStudy,
        IdentityDbContext identity) =>
        new(new WorkflowAssigneeLookup(caseStudy), new IdentityDirectory(identity));

    public NotificationRecipientResolver(
        IWorkflowAssigneeLookup assignees,
        IIdentityDirectory identity)
    {
        _assignees = assignees;
        _identity = identity;
    }

    public async Task<IReadOnlyList<string>> ResolveAssigneeUserIdsForPropertyAsync(
        Guid propertyId,
        IReadOnlyCollection<WorkflowTaskKind> taskKinds,
        CancellationToken cancellationToken = default)
    {
        var assigneeIds = await _assignees.GetOpenAssigneeIdsForPropertyAsync(
            propertyId,
            taskKinds,
            cancellationToken);
        return await MapAssigneesToUserIdsAsync(assigneeIds, cancellationToken);
    }

    public async Task<IReadOnlyList<string>> ResolveAssigneeUserIdsForPoAsync(
        string poNumber,
        IReadOnlyCollection<WorkflowTaskKind> taskKinds,
        CancellationToken cancellationToken = default)
    {
        var assigneeIds = await _assignees.GetOpenAssigneeIdsForPoAsync(
            poNumber,
            taskKinds,
            cancellationToken);
        return await MapAssigneesToUserIdsAsync(assigneeIds, cancellationToken);
    }

    public Task<string?> ResolveUserIdForDistributionAssigneeAsync(
        string distributionAssigneeId,
        CancellationToken cancellationToken = default) =>
        _identity.ResolveUserIdForDistributionAssigneeAsync(distributionAssigneeId, cancellationToken);

    public Task<string?> ResolveUserIdForEmailAsync(
        string email,
        CancellationToken cancellationToken = default) =>
        _identity.ResolveUserIdForEmailAsync(email, cancellationToken);

    public Task<IReadOnlyDictionary<string, string>> ResolveUserIdsForDistributionAssigneesAsync(
        IReadOnlyCollection<string> distributionAssigneeIds,
        CancellationToken cancellationToken = default) =>
        _identity.ResolveUserIdsForDistributionAssigneesAsync(distributionAssigneeIds, cancellationToken);

    public Task<IReadOnlyList<string>> ResolveUserIdsWithPrototypeRoleAsync(
        string prototypeRole,
        CancellationToken cancellationToken = default) =>
        _identity.ResolveUserIdsWithPrototypeRoleAsync(prototypeRole, cancellationToken);

    private async Task<IReadOnlyList<string>> MapAssigneesToUserIdsAsync(
        IReadOnlyList<string> assigneeIds,
        CancellationToken cancellationToken)
    {
        if (assigneeIds.Count == 0) return [];
        var map = await _identity.ResolveUserIdsForDistributionAssigneesAsync(
            assigneeIds,
            cancellationToken);
        return map.Values.Where(id => !string.IsNullOrWhiteSpace(id)).Distinct().ToList();
    }
}

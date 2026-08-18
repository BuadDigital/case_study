using RealEstateEval.Domain;

namespace RealEstateEval.Application.Abstractions;

/// <summary>
/// Resolves notification recipients: workflow assignees from Case Study, profile and
/// email maps from Identity. Extracted so bounded-context libraries can depend on the
/// abstraction instead of the shared Infrastructure resolver (A8).
/// </summary>
public interface INotificationRecipientResolver
{
    Task<IReadOnlyList<string>> ResolveAssigneeUserIdsForPropertyAsync(
        Guid propertyId,
        IReadOnlyCollection<WorkflowTaskKind> taskKinds,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<string>> ResolveAssigneeUserIdsForPoAsync(
        string poNumber,
        IReadOnlyCollection<WorkflowTaskKind> taskKinds,
        CancellationToken cancellationToken = default);

    Task<string?> ResolveUserIdForDistributionAssigneeAsync(
        string distributionAssigneeId,
        CancellationToken cancellationToken = default);

    Task<string?> ResolveUserIdForEmailAsync(
        string email,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyDictionary<string, string>> ResolveUserIdsForDistributionAssigneesAsync(
        IReadOnlyCollection<string> distributionAssigneeIds,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<string>> ResolveUserIdsWithPrototypeRoleAsync(
        string prototypeRole,
        CancellationToken cancellationToken = default);
}

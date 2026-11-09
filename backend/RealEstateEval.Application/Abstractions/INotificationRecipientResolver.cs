using RealEstateEval.Domain;

namespace RealEstateEval.Application.Abstractions;

/// <summary>
/// Resolves notification recipients: workflow assignees from Case Study, profile and
/// email maps from Identity. Extracted so bounded-context libraries can depend on the
/// abstraction instead of the shared Infrastructure resolver.
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

    /// <summary>
    /// Active case specialists holding one sub-role (coordination | study | review) — the audience of
    /// a stage's notices now that every stage is a shared queue (ruling 2026-11-02). The default
    /// answers every active case specialist, for directories that do not know the sub-roles.
    /// </summary>
    Task<IReadOnlyList<string>> ResolveCaseSpecialistUserIdsAsync(
        string subRole,
        CancellationToken cancellationToken = default) =>
        ResolveUserIdsWithPrototypeRoleAsync(StaffRoleIds.CaseSpecialist, cancellationToken);
}

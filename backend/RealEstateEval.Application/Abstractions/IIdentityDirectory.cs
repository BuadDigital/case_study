using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;

namespace RealEstateEval.Application.Abstractions;

/// <summary>
/// Cross-service Identity reads (labels, compensation, assignee→user maps).
/// The Identity host uses EF; other hosts call the Identity API.
/// </summary>
public interface IIdentityDirectory : IUserLabelLookup
{
    Task<IdentityCompensationProfileDto?> GetCompensationByAssigneeAsync(
        string assigneeId,
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

    Task<IReadOnlyDictionary<string, string>> ResolveDisplayNamesByUserIdsAsync(
        IReadOnlyCollection<string> userIds,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyDictionary<string, string>> ResolveDisplayNamesByAssigneeIdsAsync(
        IReadOnlyCollection<string> assigneeIds,
        CancellationToken cancellationToken = default);
}

public interface IWorkflowAssigneeLookup
{
    Task<IReadOnlyList<string>> GetOpenAssigneeIdsForPropertyAsync(
        Guid propertyId,
        IReadOnlyCollection<WorkflowTaskKind> taskKinds,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<string>> GetOpenAssigneeIdsForPoAsync(
        string poNumber,
        IReadOnlyCollection<WorkflowTaskKind> taskKinds,
        CancellationToken cancellationToken = default);
}

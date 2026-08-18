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

using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Abstractions;

/// <summary>Which group a property currently sits in.</summary>
public sealed record PropertyGroupMembership(Guid PropertyId, Guid GroupId);

/// <summary>Inspection coordinates recorded for a property.</summary>
public sealed record PropertyInspectionPoint(Guid PropertyId, decimal? Latitude, decimal? Longitude);

/// <summary>
/// Persistence boundary for the grouped-property use case. The use case in
/// <c>CaseStudy.Application</c> composes these calls; only the Infrastructure adapter opens EF.
/// Reads are untracked unless the method says otherwise.
/// </summary>
public interface IPropertyGroupRepository
{
    Task<PropertyGroupMembership?> GetActiveMembershipAsync(
        Guid propertyId,
        CancellationToken cancellationToken);

    Task<WorkOrderProperty?> GetPropertyAsync(Guid propertyId, CancellationToken cancellationToken);

    /// <summary>Every active membership, for the already-linked map.</summary>
    Task<IReadOnlyList<PropertyGroupMembership>> ListActiveMembershipsAsync(
        CancellationToken cancellationToken);

    /// <summary>Live properties other than the subject, newest id first.</summary>
    Task<IReadOnlyList<WorkOrderProperty>> ListLinkCandidatesAsync(
        Guid excludePropertyId,
        int take,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<WorkOrderProperty>> ListPropertiesByIdsAsync(
        IReadOnlyCollection<Guid> propertyIds,
        CancellationToken cancellationToken);

    /// <summary>Tracked properties with their contacts; edits persist on SaveChangesAsync.</summary>
    Task<IReadOnlyList<WorkOrderProperty>> ListPropertiesForUpdateAsync(
        IReadOnlyCollection<Guid> propertyIds,
        CancellationToken cancellationToken);

    /// <summary>Tracked property (no contacts), or null.</summary>
    Task<WorkOrderProperty?> GetPropertyForUpdateAsync(Guid propertyId, CancellationToken cancellationToken);

    /// <summary>Tracked field-inspection submissions of the properties, every status.</summary>
    Task<IReadOnlyList<PartyTaskSubmission>> ListFieldInspectionsForUpdateAsync(
        IReadOnlyCollection<Guid> propertyIds,
        CancellationToken cancellationToken);

    void AddContact(PropertyContact contact);

    /// <summary>The workflow task, or null.</summary>
    Task<WorkflowTask?> GetTaskAsync(Guid taskId, CancellationToken cancellationToken);

    void AddSubmission(PartyTaskSubmission submission);

    Task<IReadOnlyDictionary<Guid, string>> GetPoNumbersByWorkOrderIdsAsync(
        IReadOnlyCollection<Guid> workOrderIds,
        CancellationToken cancellationToken);

    /// <summary>PO number of every work order, keyed by work-order id.</summary>
    Task<IReadOnlyDictionary<Guid, string>> ListAllPoNumbersAsync(CancellationToken cancellationToken);

    /// <summary>Inspection points for the properties, newest update first.</summary>
    Task<IReadOnlyList<PropertyInspectionPoint>> ListInspectionPointsAsync(
        IReadOnlyCollection<Guid> propertyIds,
        CancellationToken cancellationToken);

    /// <summary>Tracked active members of the given properties; edits persist on SaveChangesAsync.</summary>
    Task<IReadOnlyList<PropertyGroupMember>> ListActiveMembersForPropertiesAsync(
        IReadOnlyCollection<Guid> propertyIds,
        CancellationToken cancellationToken);

    /// <summary>Tracked active member of one property, or null.</summary>
    Task<PropertyGroupMember?> GetActiveMemberForUpdateAsync(
        Guid propertyId,
        CancellationToken cancellationToken);

    Task<PropertyGroup?> GetGroupAsync(Guid groupId, CancellationToken cancellationToken);

    /// <summary>Active members of a group, oldest link first.</summary>
    Task<IReadOnlyList<PropertyGroupMember>> ListActiveMembersAsync(
        Guid groupId,
        CancellationToken cancellationToken);

    void AddGroup(PropertyGroup group);

    void AddMember(PropertyGroupMember member);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}

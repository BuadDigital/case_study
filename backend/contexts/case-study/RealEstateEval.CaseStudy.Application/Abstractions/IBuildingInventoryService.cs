using RealEstateEval.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Rules;

namespace RealEstateEval.CaseStudy.Application.Abstractions;

public interface IBuildingInventoryService
{
    Task<BuildingInventoryDto?> GetAsync(
        string poNumber,
        Guid propertyId,
        CancellationToken cancellationToken);

    /// <summary>
    /// How far <paramref name="actor"/> may write this property's inventory: case staff fully, the
    /// assigned field inspector (before he submits) the table only, everyone else not at all.
    /// </summary>
    Task<BuildingInventoryWriteAccess> ResolveWriteAccessAsync(
        string poNumber,
        Guid propertyId,
        PartySubmissionActor actor,
        CancellationToken cancellationToken);

    /// <summary>
    /// Whether <paramref name="actor"/> may read this property's inventory: a field inspector only
    /// on a property of an inspection task assigned to him; every other reader as the endpoint allows.
    /// </summary>
    Task<bool> CanReadAsync(
        string poNumber,
        Guid propertyId,
        PartySubmissionActor actor,
        CancellationToken cancellationToken);

    Task<(BuildingInventoryDto? Result, Dictionary<string, string>? Errors)> SaveAsync(
        string poNumber,
        Guid propertyId,
        SaveBuildingInventoryRequest request,
        BuildingInventoryWriteAccess access,
        CancellationToken cancellationToken,
        PartySubmissionActor? actor = null);
}

using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Abstractions;

public interface IBuildingInventoryService
{
    Task<BuildingInventoryDto?> GetAsync(
        string poNumber,
        Guid propertyId,
        CancellationToken cancellationToken);

    Task<(BuildingInventoryDto? Result, Dictionary<string, string>? Errors)> SaveAsync(
        string poNumber,
        Guid propertyId,
        SaveBuildingInventoryRequest request,
        CancellationToken cancellationToken);
}

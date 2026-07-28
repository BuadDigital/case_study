using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Abstractions;

public interface IRegionsService
{
    Task EnsureSeededAsync(CancellationToken cancellationToken = default);

    Task<IReadOnlyList<SelectableRegionDto>> ListSelectableRegionsAsync(
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<SelectableCityDto>> ListAllSelectableCitiesAsync(
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<SelectableCityDto>> ListSelectableCitiesAsync(
        Guid regionId,
        CancellationToken cancellationToken = default);
}

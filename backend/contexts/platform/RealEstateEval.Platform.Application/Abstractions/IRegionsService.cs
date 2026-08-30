using RealEstateEval.Application.Contracts;
using RealEstateEval.Platform.Application.Contracts;

namespace RealEstateEval.Platform.Application.Abstractions;

public interface IRegionsService
{
    Task EnsureSeededAsync(CancellationToken cancellationToken = default);

    Task<IReadOnlyList<SelectableRegionDto>> ListSelectableRegionsAsync(
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<SelectableCityDto>> ListAllSelectableCitiesAsync(
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<SelectableCityDto>> SearchCitiesAsync(
        Guid regionId,
        string? query,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<SelectableDistrictDto>> SearchDistrictsAsync(
        Guid cityId,
        string? query,
        CancellationToken cancellationToken = default);

    Task<SuggestLocationResultDto> SuggestAsync(
        SuggestLocationRequest request,
        string userId,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<PendingLocationDto>> ListPendingAsync(
        CancellationToken cancellationToken = default);

    Task ReviewCityAsync(
        Guid cityId,
        ReviewLocationRequest request,
        string reviewerUserId,
        CancellationToken cancellationToken = default);

    Task ReviewDistrictAsync(
        Guid districtId,
        ReviewLocationRequest request,
        string reviewerUserId,
        CancellationToken cancellationToken = default);
}

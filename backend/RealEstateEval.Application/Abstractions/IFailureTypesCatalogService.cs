using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Abstractions;

public interface IFailureTypesCatalogService
{
    Task<FailureTypesCatalogDto> GetAsync(CancellationToken cancellationToken = default);

    Task<FailureTypesCatalogDto> SaveAsync(
        SaveFailureTypesCatalogRequest request,
        CancellationToken cancellationToken = default);
}

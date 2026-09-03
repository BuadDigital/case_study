using RealEstateEval.Application.Contracts;
using RealEstateEval.Failures.Application.Contracts;

namespace RealEstateEval.Failures.Application.Abstractions;

public interface IFailureTypesCatalogService
{
    Task<FailureTypesCatalogDto> GetAsync(CancellationToken cancellationToken = default);

    Task<FailureTypesCatalogDto> SaveAsync(
        SaveFailureTypesCatalogRequest request,
        CancellationToken cancellationToken = default);
}

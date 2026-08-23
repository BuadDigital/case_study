using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Abstractions;

public interface IValuationListsService
{
    Task<ValuationListsDto> GetAsync(CancellationToken cancellationToken = default);

    Task<ValuationListsDto> SaveAsync(
        SaveValuationListsRequest request,
        CancellationToken cancellationToken = default);
}

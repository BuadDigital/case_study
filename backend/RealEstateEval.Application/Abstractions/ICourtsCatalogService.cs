using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Abstractions;

public interface ICourtsCatalogService
{
    Task<IReadOnlyList<CourtCatalogEntryDto>> ListAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<CourtCatalogEntryDto>> ReplaceAllAsync(
        SaveCourtsCatalogRequest request,
        CancellationToken cancellationToken = default);
}

using RealEstateEval.Application.Contracts;
using RealEstateEval.Platform.Application.Contracts;

namespace RealEstateEval.Platform.Application.Abstractions;

public interface ICourtsCatalogService
{
    Task<IReadOnlyList<CourtCatalogEntryDto>> ListAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<CourtCatalogEntryDto>> ReplaceAllAsync(
        SaveCourtsCatalogRequest request,
        string actorId,
        CancellationToken cancellationToken = default);
}

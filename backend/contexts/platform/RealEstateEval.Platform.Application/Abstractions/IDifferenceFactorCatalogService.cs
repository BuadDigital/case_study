using RealEstateEval.Application.Contracts;
using RealEstateEval.Platform.Application.Contracts;

namespace RealEstateEval.Platform.Application.Abstractions;

/// <summary>difference-factor definitions as admin reference data.</summary>
public interface IDifferenceFactorCatalogService
{
    Task<DifferenceFactorCatalogDto> GetAsync(CancellationToken cancellationToken = default);

    Task<(DifferenceFactorCatalogDto? Result, string? Error)> SaveAsync(
        SaveDifferenceFactorCatalogRequest request,
        string actorId,
        CancellationToken cancellationToken = default);
}

using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Abstractions;

/// <summary>Decision 19.2 — difference-factor definitions as admin reference data.</summary>
public interface IDifferenceFactorCatalogService
{
    Task<DifferenceFactorCatalogDto> GetAsync(CancellationToken cancellationToken = default);

    Task<(DifferenceFactorCatalogDto? Result, string? Error)> SaveAsync(
        SaveDifferenceFactorCatalogRequest request,
        string actorId,
        CancellationToken cancellationToken = default);
}

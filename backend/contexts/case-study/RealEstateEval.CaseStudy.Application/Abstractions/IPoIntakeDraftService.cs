using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Abstractions;

public interface IPoIntakeDraftService
{
    Task<PoIntakeDraftDto?> GetForUserAsync(
        string userId,
        CancellationToken cancellationToken = default);

    Task<PoIntakeDraftDto> SaveForUserAsync(
        string userId,
        PoIntakeDraftDto request,
        CancellationToken cancellationToken = default);

    Task DeleteForUserAsync(string userId, CancellationToken cancellationToken = default);
}

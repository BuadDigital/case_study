using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Abstractions;

public interface ICourtsService
{
    Task<CourtListResponseDto> ListAdminAsync(
        string? search,
        string? status,
        string? region,
        string? city,
        int page,
        int limit,
        CancellationToken cancellationToken = default);

    Task<CourtDetailDto?> GetAdminAsync(Guid id, CancellationToken cancellationToken = default);

    Task<(CourtDto? Court, string? Error)> CreateAsync(
        CreateCourtRequest request,
        string actorId,
        CancellationToken cancellationToken = default);

    Task<(CourtDto? Court, string? Error)> UpdateAsync(
        Guid id,
        UpdateCourtRequest request,
        string actorId,
        CancellationToken cancellationToken = default);

    Task<(CourtDto? Court, string? Error)> SetCourtStatusAsync(
        Guid id,
        bool isActive,
        string actorId,
        CancellationToken cancellationToken = default);

    Task<(CourtCircuitDto? Circuit, string? Error)> CreateCircuitAsync(
        Guid courtId,
        CreateCourtCircuitRequest request,
        string actorId,
        CancellationToken cancellationToken = default);

    Task<(CourtCircuitDto? Circuit, string? Error)> UpdateCircuitAsync(
        Guid courtId,
        Guid circuitId,
        UpdateCourtCircuitRequest request,
        string actorId,
        CancellationToken cancellationToken = default);

    Task<(CourtCircuitDto? Circuit, string? Error)> SetCircuitStatusAsync(
        Guid courtId,
        Guid circuitId,
        bool isActive,
        string actorId,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<SelectableCourtDto>> ListSelectableAsync(
        string? region,
        string? city,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<SelectableCircuitDto>> ListSelectableCircuitsAsync(
        Guid courtId,
        CancellationToken cancellationToken = default);

    /// <summary>Ensure Courts table is seeded (from legacy catalog or defaults).</summary>
    Task EnsureSeededAsync(CancellationToken cancellationToken = default);
}

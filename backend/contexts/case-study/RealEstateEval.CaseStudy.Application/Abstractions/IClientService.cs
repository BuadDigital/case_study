using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Abstractions;

public interface IClientService
{
    Task<IReadOnlyList<ClientDto>> ListAsync(
        bool includeInactive,
        CancellationToken cancellationToken);

    Task<ClientDto?> GetAsync(Guid id, CancellationToken cancellationToken);

    Task<(ClientDto? Result, Dictionary<string, string>? Errors)> CreateAsync(
        UpsertClientRequest request,
        CancellationToken cancellationToken);

    Task<(ClientDto? Result, Dictionary<string, string>? Errors)> UpdateAsync(
        Guid id,
        UpsertClientRequest request,
        CancellationToken cancellationToken);

    Task<(bool Ok, string? Error)> DeactivateAsync(Guid id, CancellationToken cancellationToken);

    Task EnsureSeedClientsAsync(CancellationToken cancellationToken);
}

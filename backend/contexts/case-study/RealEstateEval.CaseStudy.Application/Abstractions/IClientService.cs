using RealEstateEval.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Contracts;

namespace RealEstateEval.CaseStudy.Application.Abstractions;

public interface IClientService
{
    Task<IReadOnlyList<ClientDto>> ListAsync(
        bool includeInactive,
        CancellationToken cancellationToken);

    Task<ClientDto?> GetAsync(Guid id, CancellationToken cancellationToken);

    Task<(ClientDto? Result, Dictionary<string, string>? Errors)> CreateAsync(
        UpsertClientRequest request,
        string actorId,
        CancellationToken cancellationToken);

    Task<(ClientDto? Result, Dictionary<string, string>? Errors)> UpdateAsync(
        Guid id,
        UpsertClientRequest request,
        string actorId,
        CancellationToken cancellationToken);

    Task<(bool Ok, string? Error)> DeactivateAsync(Guid id, string actorId, CancellationToken cancellationToken);

    Task EnsureSeedClientsAsync(CancellationToken cancellationToken);
}

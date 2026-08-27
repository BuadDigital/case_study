using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Abstractions;

/// <summary>
/// Persistence boundary for the client registry. Application code must not open
/// the Case Study EF context for this aggregate.
/// </summary>
public interface IClientRepository
{
    Task<bool> ExistsAsync(Guid id, CancellationToken cancellationToken);

    Task<Client?> GetByIdAsync(Guid id, bool track, CancellationToken cancellationToken);

    Task<IReadOnlyList<Client>> ListAsync(bool includeInactive, CancellationToken cancellationToken);

    void Add(Client client);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}

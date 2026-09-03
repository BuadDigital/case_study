using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Infrastructure.Persistence;

public sealed class ClientRepository(
    CaseStudyDbContext db,
    IOptions<DatabaseOptions>? dbOptions = null) : IClientRepository
{
    private readonly DatabaseOptions _dbOptions = dbOptions?.Value ?? new DatabaseOptions();

    public Task<bool> ExistsAsync(Guid id, CancellationToken cancellationToken) =>
        db.Clients.AnyAsync(c => c.Id == id, cancellationToken);

    public Task<Client?> GetByIdAsync(Guid id, bool track, CancellationToken cancellationToken)
    {
        var query = track ? db.Clients.AsQueryable() : db.Clients.AsNoTracking();
        return query.FirstOrDefaultAsync(c => c.Id == id, cancellationToken);
    }

    public async Task<IReadOnlyList<Client>> ListAsync(
        bool includeInactive,
        CancellationToken cancellationToken)
    {
        var q = db.Clients.AsNoTracking().AsQueryable();
        if (!includeInactive)
            q = q.Where(c => c.IsActive);
        var (_, take, _, _) = NpgsqlConfiguration.ResolveListPaging(null, null, _dbOptions);
        return await q.OrderBy(c => c.NameAr).Take(take).ToListAsync(cancellationToken);
    }

    public void Add(Client client) => db.Clients.Add(client);

    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        db.SaveChangesAsync(cancellationToken);
}

using Microsoft.EntityFrameworkCore;
using RealEstateEval.Domain;
using RealEstateEval.Platform.Application.Abstractions;
using RealEstateEval.Platform.Domain;
using RealEstateEval.Platform.Infrastructure.Data.Contexts;

namespace RealEstateEval.Platform.Infrastructure.Persistence;

/// <summary>
/// EF adapter for <see cref="ICourtsRepository"/>. The only place the courts catalog use case
/// reaches <see cref="PlatformDbContext"/>.
/// </summary>
public sealed class CourtsRepository(PlatformDbContext db) : ICourtsRepository
{
    public Task<bool> AnyCourtsAsync(CancellationToken cancellationToken) =>
        db.Courts.AnyAsync(cancellationToken);

    public async Task<IReadOnlyList<CourtCatalogEntry>> ListLegacyCatalogAsync(
        CancellationToken cancellationToken) =>
        await db.CourtCatalogEntries.AsNoTracking().ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<Court>> ListCourtsWithCircuitsAsync(
        CancellationToken cancellationToken) =>
        await db.Courts.Include(c => c.Circuits).ToListAsync(cancellationToken);

    public Task AddCourtAsync(Court court, CancellationToken cancellationToken)
    {
        db.Courts.Add(court);
        return Task.CompletedTask;
    }

    public Task AddCircuitAsync(CourtCircuit circuit, CancellationToken cancellationToken)
    {
        db.CourtCircuits.Add(circuit);
        return Task.CompletedTask;
    }

    public bool HasPendingChanges() => db.ChangeTracker.HasChanges();

    public Task<int> CountAdminAsync(CourtAdminFilter filter, CancellationToken cancellationToken) =>
        Filtered(filter).CountAsync(cancellationToken);

    public async Task<IReadOnlyList<CourtWithCircuitCount>> ListAdminPageAsync(
        CourtAdminFilter filter,
        int skip,
        int take,
        CancellationToken cancellationToken) =>
        await Filtered(filter)
            .OrderBy(c => c.City)
            .ThenBy(c => c.Name)
            .Skip(skip)
            .Take(take)
            .Select(c => new CourtWithCircuitCount(c, c.Circuits.Count))
            .ToListAsync(cancellationToken);

    public Task<Court?> GetCourtWithCircuitsAsync(Guid id, CancellationToken cancellationToken) =>
        db.Courts
            .AsNoTracking()
            .Include(c => c.Circuits)
            .FirstOrDefaultAsync(c => c.Id == id, cancellationToken);

    public Task<Court?> FindCourtAsync(Guid id, CancellationToken cancellationToken) =>
        db.Courts.FirstOrDefaultAsync(c => c.Id == id, cancellationToken);

    public Task<Court?> FindCourtWithCircuitsAsync(Guid id, CancellationToken cancellationToken) =>
        db.Courts.Include(c => c.Circuits).FirstOrDefaultAsync(c => c.Id == id, cancellationToken);

    public Task<bool> CourtNameTakenAsync(
        string name,
        string city,
        Guid? excludingId,
        CancellationToken cancellationToken) =>
        db.Courts.AnyAsync(
            c => c.Name == name
                && c.City == city
                && (excludingId == null || c.Id != excludingId),
            cancellationToken);

    public Task<CourtCircuit?> FindCircuitAsync(
        Guid courtId,
        Guid circuitId,
        CancellationToken cancellationToken) =>
        db.CourtCircuits.FirstOrDefaultAsync(
            c => c.Id == circuitId && c.CourtId == courtId,
            cancellationToken);

    public Task<bool> CircuitNoTakenAsync(
        Guid courtId,
        string circuitNo,
        Guid? excludingId,
        CancellationToken cancellationToken) =>
        db.CourtCircuits.AnyAsync(
            c => c.CourtId == courtId
                && c.CircuitNo == circuitNo
                && (excludingId == null || c.Id != excludingId),
            cancellationToken);

    public async Task<IReadOnlyList<Court>> ListActiveCourtsAsync(
        string? region,
        string? city,
        CancellationToken cancellationToken)
    {
        var q = db.Courts.AsNoTracking().Where(c => c.IsActive);
        if (!string.IsNullOrWhiteSpace(region))
        {
            var r = region.Trim();
            q = q.Where(c => c.Region == r);
        }
        if (!string.IsNullOrWhiteSpace(city))
        {
            var t = city.Trim();
            q = q.Where(c => c.City == t);
        }

        return await q.OrderBy(c => c.City).ThenBy(c => c.Name).ToListAsync(cancellationToken);
    }

    public Task<bool> IsCourtActiveAsync(Guid courtId, CancellationToken cancellationToken) =>
        db.Courts.AsNoTracking().AnyAsync(c => c.Id == courtId && c.IsActive, cancellationToken);

    public async Task<IReadOnlyList<CourtCircuit>> ListActiveCircuitsAsync(
        Guid courtId,
        CancellationToken cancellationToken) =>
        await db.CourtCircuits.AsNoTracking()
            .Where(c => c.CourtId == courtId && c.IsActive)
            .OrderBy(c => c.CircuitNo)
            .ToListAsync(cancellationToken);

    public Task AppendAuditAsync(AuditLog entry, CancellationToken cancellationToken)
    {
        db.AuditLogs.Add(entry);
        return Task.CompletedTask;
    }

    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        db.SaveChangesAsync(cancellationToken);

    private IQueryable<Court> Filtered(CourtAdminFilter filter)
    {
        var q = db.Courts.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            var s = filter.Search.Trim();
            q = q.Where(c => c.Name.Contains(s) || c.City.Contains(s) || c.Region.Contains(s));
        }

        if (string.Equals(filter.Status, "active", StringComparison.OrdinalIgnoreCase))
            q = q.Where(c => c.IsActive);
        else if (string.Equals(filter.Status, "inactive", StringComparison.OrdinalIgnoreCase))
            q = q.Where(c => !c.IsActive);

        if (!string.IsNullOrWhiteSpace(filter.Region))
        {
            var r = filter.Region.Trim();
            q = q.Where(c => c.Region == r);
        }

        if (!string.IsNullOrWhiteSpace(filter.City))
        {
            var t = filter.City.Trim();
            q = q.Where(c => c.City == t);
        }

        return q;
    }
}

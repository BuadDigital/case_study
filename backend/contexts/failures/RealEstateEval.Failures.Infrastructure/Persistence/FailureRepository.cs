using Microsoft.EntityFrameworkCore;
using RealEstateEval.Failures.Application.Abstractions;
using RealEstateEval.Failures.Domain;
using RealEstateEval.Failures.Infrastructure.Data.Contexts;

namespace RealEstateEval.Failures.Infrastructure.Persistence;

/// <summary>
/// EF adapter for <see cref="IFailureRepository"/>. The only place the failures use case
/// reaches <see cref="FailuresDbContext"/>.
/// </summary>
public sealed class FailureRepository(FailuresDbContext failures) : IFailureRepository
{
    private static readonly HashSet<string> ActiveStatuses = PropertyFailureStatus.Active;

    public async Task<IReadOnlyList<PropertyFailure>> ListRecentAsync(
        IReadOnlyCollection<string>? visiblePoNumbers,
        int max,
        CancellationToken cancellationToken)
    {
        IQueryable<PropertyFailure> query = failures.PropertyFailures
            .AsNoTracking()
            .OrderByDescending(f => f.UpdatedAtUtc);

        if (visiblePoNumbers is not null)
        {
            if (visiblePoNumbers.Count == 0) return [];
            var pos = visiblePoNumbers.ToList();
            query = query.Where(f => pos.Contains(f.PoNumber));
        }

        return await query.Take(max).ToListAsync(cancellationToken);
    }

    public Task<PropertyFailure?> FindAsync(Guid id, CancellationToken cancellationToken) =>
        failures.PropertyFailures.FirstOrDefaultAsync(f => f.Id == id, cancellationToken);

    public Task<PropertyFailure?> GetActiveForPropertyAsync(
        string poNumber,
        string propertyId,
        CancellationToken cancellationToken)
    {
        var po = poNumber.Trim();
        var prop = propertyId.Trim();
        return failures.PropertyFailures
            .AsNoTracking()
            .Where(f =>
                f.PoNumber == po
                && f.PropertyId == prop
                && ActiveStatuses.Contains(f.Status))
            .OrderByDescending(f => f.UpdatedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public Task<PropertyFailure?> FindLatestUnresolvedAsync(
        string poNumber,
        string propertyId,
        CancellationToken cancellationToken)
    {
        var po = poNumber.Trim();
        var prop = propertyId.Trim();
        return failures.PropertyFailures
            .Where(f =>
                f.PoNumber == po
                && f.PropertyId == prop
                && f.Status != PropertyFailureStatus.Resolved)
            .OrderByDescending(f => f.UpdatedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<PropertyFailure>> FindOpenEvictionHoldsAsync(
        string poNumber,
        string propertyId,
        string problemTypeId,
        CancellationToken cancellationToken)
    {
        var po = poNumber.Trim();
        var prop = propertyId.Trim();
        return await failures.PropertyFailures
            .Where(f =>
                f.PoNumber == po
                && f.PropertyId == prop
                && f.ProblemTypeId == problemTypeId
                && f.Status != PropertyFailureStatus.Resolved
                && f.Status != PropertyFailureStatus.Approved)
            .ToListAsync(cancellationToken);
    }

    public Task<bool> HasUnresolvedAsync(
        string poNumber,
        string propertyId,
        CancellationToken cancellationToken)
    {
        var po = poNumber.Trim();
        var prop = propertyId.Trim();
        return failures.PropertyFailures.AnyAsync(
            f =>
                f.PoNumber == po
                && f.PropertyId == prop
                && f.Status != PropertyFailureStatus.Resolved,
            cancellationToken);
    }

    public Task AddAsync(PropertyFailure failure, CancellationToken cancellationToken)
    {
        failures.PropertyFailures.Add(failure);
        return Task.CompletedTask;
    }

    public async Task DeleteForPoAsync(string poNumber, CancellationToken cancellationToken)
    {
        var po = poNumber.Trim();
        await failures.PropertyFailures
            .Where(f => f.PoNumber == po)
            .ExecuteDeleteAsync(cancellationToken);
    }

    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        failures.SaveChangesAsync(cancellationToken);
}

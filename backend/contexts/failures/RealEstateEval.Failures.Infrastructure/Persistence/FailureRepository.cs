using Microsoft.EntityFrameworkCore;
using RealEstateEval.Failures.Application.Abstractions;
using RealEstateEval.Failures.Application.Contracts;
using RealEstateEval.Failures.Application.Rules;
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

 /// <summary>
 /// Filters, sorts and pages in the database. Every filter is an EF predicate, so no row is
 /// dropped after materialisation and the page agrees with <see cref="CountAsync"/>.
 /// </summary>
    public async Task<IReadOnlyList<PropertyFailure>> ListPageAsync(
        IReadOnlyCollection<string>? visiblePoNumbers,
        FailureListQuery query,
        int skip,
        int take,
        CancellationToken cancellationToken)
    {
        var rows = Filtered(visiblePoNumbers, query);
        if (rows is null) return [];

        var sorted = Sort(rows, query);
        if (skip > 0)
            sorted = sorted.Skip(skip);

        return await sorted.Take(take).ToListAsync(cancellationToken);
    }

    public async Task<int> CountAsync(
        IReadOnlyCollection<string>? visiblePoNumbers,
        FailureListQuery query,
        CancellationToken cancellationToken)
    {
        var rows = Filtered(visiblePoNumbers, query);
        return rows is null ? 0 : await rows.CountAsync(cancellationToken);
    }

 /// <summary>Null means the actor sees nothing at all — the caller short-circuits.</summary>
    private IQueryable<PropertyFailure>? Filtered(
        IReadOnlyCollection<string>? visiblePoNumbers,
        FailureListQuery query)
    {
        IQueryable<PropertyFailure> rows = failures.PropertyFailures.AsNoTracking();

        if (visiblePoNumbers is not null)
        {
            if (visiblePoNumbers.Count == 0) return null;
            var pos = visiblePoNumbers.ToList();
            rows = rows.Where(f => pos.Contains(f.PoNumber));
        }

        var statuses = FailureListQueryRules.ResolveStatuses(query.Status).ToList();
        if (statuses.Count > 0)
            rows = rows.Where(f => statuses.Contains(f.Status));

        var poNumber = FailureListQueryRules.NormalizeExact(query.PoNumber);
        if (poNumber is not null)
            rows = rows.Where(f => f.PoNumber == poNumber);

        var problemTypeId = FailureListQueryRules.NormalizeExact(query.ProblemTypeId);
        if (problemTypeId is not null)
            rows = rows.Where(f => f.ProblemTypeId == problemTypeId);

        var search = FailureListQueryRules.NormalizeSearch(query.Q);
        if (search is not null)
        {
            rows = rows.Where(f =>
                f.PoNumber.Contains(search)
                || f.DeedNumber.Contains(search)
                || f.Title.Contains(search)
                || f.Specialist.Contains(search));
        }

        return rows;
    }

 /// <summary>Allow-listed sort plus a stable tiebreaker so consecutive pages never overlap.</summary>
    private static IQueryable<PropertyFailure> Sort(
        IQueryable<PropertyFailure> rows,
        FailureListQuery query)
    {
        var descending = FailureListQueryRules.ResolveDescending(query.Dir);
        IOrderedQueryable<PropertyFailure> ordered = FailureListQueryRules.ResolveSort(query.Sort) switch
        {
            FailureListSortKey.Created => descending
                ? rows.OrderByDescending(f => f.CreatedAtUtc)
                : rows.OrderBy(f => f.CreatedAtUtc),
            FailureListSortKey.PoNumber => descending
                ? rows.OrderByDescending(f => f.PoNumber)
                : rows.OrderBy(f => f.PoNumber),
            FailureListSortKey.Deed => descending
                ? rows.OrderByDescending(f => f.DeedNumber)
                : rows.OrderBy(f => f.DeedNumber),
            _ => descending
                ? rows.OrderByDescending(f => f.UpdatedAtUtc)
                : rows.OrderBy(f => f.UpdatedAtUtc),
        };

        return ordered.ThenBy(f => f.Id);
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

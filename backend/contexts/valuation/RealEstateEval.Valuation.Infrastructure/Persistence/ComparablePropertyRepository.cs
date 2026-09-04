using Microsoft.EntityFrameworkCore;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Domain;
using RealEstateEval.Valuation.Infrastructure.Data.Contexts;

namespace RealEstateEval.Valuation.Infrastructure.Persistence;

/// <summary>
/// EF adapter for <see cref="IComparablePropertyRepository"/>. The only place the comparables
/// bank use case reaches <see cref="ValuationDbContext"/>.
/// </summary>
public sealed class ComparablePropertyRepository(ValuationDbContext db)
    : IComparablePropertyRepository
{
    public async Task<IReadOnlyList<ComparableProperty>> ListAsync(
        ComparableBankFilter filter,
        int take,
        CancellationToken cancellationToken)
    {
        var q = db.ComparableProperties.AsNoTracking().AsQueryable();

        if (!filter.IncludeInactive)
            q = q.Where(x => x.IsActive);

        if (!string.IsNullOrWhiteSpace(filter.District))
        {
            var d = filter.District.Trim();
            q = q.Where(x => x.District.Contains(d));
        }

        if (!string.IsNullOrWhiteSpace(filter.City))
        {
            var c = filter.City.Trim();
            q = q.Where(x => x.City != null && x.City.Contains(c));
        }

        if (!string.IsNullOrWhiteSpace(filter.TransactionKind))
        {
            var k = filter.TransactionKind.Trim();
            q = q.Where(x => x.TransactionKind == k);
        }

        if (!string.IsNullOrWhiteSpace(filter.Source))
        {
            var s = filter.Source.Trim();
            q = q.Where(x => x.Source == s);
        }

        if (!string.IsNullOrWhiteSpace(filter.IntakeChannel))
        {
            var i = filter.IntakeChannel.Trim();
            q = q.Where(x => x.IntakeChannel == i);
        }

        if (!string.IsNullOrWhiteSpace(filter.PropertyType))
        {
            var t = filter.PropertyType.Trim();
            q = q.Where(x => x.ComparablePropertyType.Contains(t));
        }

        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            var term = filter.Search.Trim();
            q = q.Where(x =>
                x.ReferenceCode.Contains(term)
                || x.ComparablePropertyType.Contains(term)
                || x.District.Contains(term)
                || (x.ListingNumber != null && x.ListingNumber.Contains(term))
                || (x.Description != null && x.Description.Contains(term)));
        }

        if (filter.FromDate is { } from)
            q = q.Where(x => x.TransactionDate >= from);

        if (filter.ToDate is { } to)
            q = q.Where(x => x.TransactionDate <= to);

        return await q
            .OrderByDescending(x => x.TransactionDate)
            .ThenByDescending(x => x.CreatedAtUtc)
            .Take(take)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<ComparableCoordinate>> ListDuplicateCoordinatesAsync(
        CancellationToken cancellationToken) =>
        await db.ComparableProperties.AsNoTracking()
            .Where(c => c.IsActive)
            .GroupBy(c => new { c.Latitude, c.Longitude })
            .Where(g => g.Count() > 1)
            .Select(g => new ComparableCoordinate(g.Key.Latitude, g.Key.Longitude))
            .ToListAsync(cancellationToken);

    public Task<ComparableProperty?> GetAsync(Guid id, CancellationToken cancellationToken) =>
        db.ComparableProperties.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

    public Task<ComparableProperty?> FindAsync(Guid id, CancellationToken cancellationToken) =>
        db.ComparableProperties.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

    public Task AddAsync(ComparableProperty entity, CancellationToken cancellationToken)
    {
        db.ComparableProperties.Add(entity);
        return Task.CompletedTask;
    }

    public Task AddLinkAsync(PropertyComparableLink link, CancellationToken cancellationToken)
    {
        db.PropertyComparableLinks.Add(link);
        return Task.CompletedTask;
    }

    public async Task<IReadOnlyList<ComparableProperty>> ListProximityPoolAsync(
        ComparableProximityFilter filter,
        int take,
        CancellationToken cancellationToken)
    {
        // ق-3: anomalous / unreliable / duplicate-tagged records stay visible in the bank but
        // never surface as suggestions.
        var q = db.ComparableProperties.AsNoTracking()
            .Where(x => x.IsActive
                && !x.IsDuplicateTagged
                && x.ReliabilityTag == ComparableReliabilityTags.Normal);

        if (filter.ExcludeIds.Count > 0)
        {
            var exclude = filter.ExcludeIds.ToList();
            q = q.Where(x => !exclude.Contains(x.Id));
        }

        if (!string.IsNullOrWhiteSpace(filter.District))
        {
            var d = filter.District.Trim();
            q = q.Where(x => x.District.Contains(d));
        }

        if (!string.IsNullOrWhiteSpace(filter.PropertyType))
        {
            var t = filter.PropertyType.Trim();
            q = q.Where(x => x.ComparablePropertyType.Contains(t));
        }

        return await q
            .OrderByDescending(x => x.TransactionDate)
            .Take(take)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<decimal>> ListDistrictPeerPricesAsync(
        Guid excludeId,
        string district,
        int take,
        CancellationToken cancellationToken) =>
        await db.ComparableProperties.AsNoTracking()
            .Where(c => c.IsActive && c.Id != excludeId && c.District == district)
            .OrderByDescending(c => c.TransactionDate)
            .Take(take)
            .Select(c => c.PricePerSqm)
            .ToListAsync(cancellationToken);

    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        db.SaveChangesAsync(cancellationToken);
}

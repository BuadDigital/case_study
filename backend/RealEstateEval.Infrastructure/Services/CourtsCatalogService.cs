using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Caching;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Infrastructure.Services;

/// <summary>
/// Legacy catalog shape (city + court + circuits[]) backed by Courts / CourtCircuits.
/// </summary>
public sealed class CourtsCatalogService : ICourtsCatalogService
{
    private readonly ApplicationDbContext _db;
    private readonly ApiResponseCache _cache;
    private readonly ICourtsService _courts;

    public CourtsCatalogService(
        ApplicationDbContext db,
        ApiResponseCache cache,
        ICourtsService courts)
    {
        _db = db;
        _cache = cache;
        _courts = courts;
    }

    public async Task<IReadOnlyList<CourtCatalogEntryDto>> ListAsync(
        CancellationToken cancellationToken = default)
    {
        return await _cache.GetOrCreateAsync(
            CacheKeys.CourtsCatalog,
            CacheDurations.CourtsCatalog,
            async _ =>
            {
                await _courts.EnsureSeededAsync(cancellationToken);
                var rows = await _db.Courts
                    .AsNoTracking()
                    .Include(c => c.Circuits)
                    .OrderBy(c => c.City)
                    .ThenBy(c => c.Name)
                    .ToListAsync(cancellationToken);
                return rows.Select(c => new CourtCatalogEntryDto
                {
                    Id = c.Id,
                    City = c.City,
                    Court = c.Name,
                    Circuits = c.Circuits
                        .Where(x => x.IsActive)
                        .OrderBy(x => x.CircuitNo)
                        .Select(x => x.CircuitNo)
                        .ToList(),
                }).ToList();
            },
            cancellationToken);
    }

    public async Task<IReadOnlyList<CourtCatalogEntryDto>> ReplaceAllAsync(
        SaveCourtsCatalogRequest request,
        CancellationToken cancellationToken = default)
    {
        await _courts.EnsureSeededAsync(cancellationToken);

        var existingCourts = await _db.Courts.Include(c => c.Circuits).ToListAsync(cancellationToken);
        var existingCircuits = existingCourts.SelectMany(c => c.Circuits).ToList();
        _db.CourtCircuits.RemoveRange(existingCircuits);
        _db.Courts.RemoveRange(existingCourts);
        await _db.SaveChangesAsync(cancellationToken);

        foreach (var dto in request.Entries)
        {
            var court = new Court
            {
                Id = dto.Id == Guid.Empty ? Guid.NewGuid() : dto.Id,
                Name = dto.Court.Trim(),
                Region = dto.City.Trim(),
                City = dto.City.Trim(),
                IsActive = true,
                CreatedBy = "system",
                CreatedAtUtc = DateTime.UtcNow,
            };
            _db.Courts.Add(court);
            foreach (var circuitNo in dto.Circuits
                         .Select(c => c.Trim())
                         .Where(c => c.Length > 0)
                         .Distinct(StringComparer.Ordinal))
            {
                _db.CourtCircuits.Add(new CourtCircuit
                {
                    Id = Guid.NewGuid(),
                    CourtId = court.Id,
                    CircuitNo = circuitNo,
                    IsActive = true,
                    CreatedBy = "system",
                    CreatedAtUtc = DateTime.UtcNow,
                });
            }
        }

        await _db.SaveChangesAsync(cancellationToken);
        await _cache.RemoveAsync(CacheKeys.CourtsCatalog, cancellationToken);
        return await ListAsync(cancellationToken);
    }
}

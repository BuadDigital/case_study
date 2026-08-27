using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Caching;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Platform.Application.Abstractions;
using RealEstateEval.Platform.Infrastructure.Data.Contexts;
using RealEstateEval.Platform.Application.Contracts;
using RealEstateEval.Platform.Domain;

namespace RealEstateEval.Platform.Infrastructure.Services;

/// <summary>
/// Legacy catalog shape (city + court + circuits[]) backed by Courts / CourtCircuits.
/// </summary>
public sealed class CourtsCatalogService : ICourtsCatalogService
{
    private readonly PlatformDbContext _db;
    private readonly ApiResponseCache _cache;
    private readonly ICourtsService _courts;
    private readonly IAuditLogWriter _audit;
    private readonly TimeProvider _time;

    public CourtsCatalogService(
        PlatformDbContext db,
        ApiResponseCache cache,
        ICourtsService courts,
        IAuditLogWriter audit,
        TimeProvider? time = null)
    {
        _time = time ?? TimeProvider.System;

        _db = db;
        _cache = cache;
        _courts = courts;
        _audit = audit;
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
        string actorId,
        CancellationToken cancellationToken = default)
    {
        await _courts.EnsureSeededAsync(cancellationToken);

 // Wipe then recreate needs two SaveChanges (same Ids may be reused), so wrap both
 // in a transaction — otherwise a failure after the wipe leaves an empty catalog.
        await DbContextTransaction.ExecuteInTransactionAsync(
            _db,
            async ct =>
            {
                var existingCourts = await _db.Courts
                    .Include(c => c.Circuits)
                    .ToListAsync(ct);
                var before = existingCourts.Select(c => new
                {
                    c.Id,
                    c.Name,
                    c.Region,
                    c.City,
                    c.IsActive,
                    circuits = c.Circuits
                        .Select(x => new { x.Id, x.CircuitNo, x.CircuitName, x.IsActive })
                        .ToList(),
                }).ToList();
                var existingCircuits = existingCourts.SelectMany(c => c.Circuits).ToList();
                _db.CourtCircuits.RemoveRange(existingCircuits);
                _db.Courts.RemoveRange(existingCourts);
                await _db.SaveChangesAsync(ct);

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
                        CreatedAtUtc = _time.UtcNow(),
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
                            CreatedAtUtc = _time.UtcNow(),
                        });
                    }
                }

                _db.AuditLogs.Add(_audit.Create(
                    actorId,
                    "COURT_CATALOG_REPLACED",
                    "court_catalog",
                    "all",
                    before,
                    request.Entries));
                await _db.SaveChangesAsync(ct);
            },
            cancellationToken);

        await _cache.RemoveAsync(CacheKeys.CourtsCatalog, cancellationToken);
        return await ListAsync(cancellationToken);
    }
}

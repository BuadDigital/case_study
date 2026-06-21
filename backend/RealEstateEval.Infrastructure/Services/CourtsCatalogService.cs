using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Caching;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Infrastructure.Services;

public sealed class CourtsCatalogService : ICourtsCatalogService
{
    private readonly ApplicationDbContext _db;
    private readonly ApiResponseCache _cache;

    public CourtsCatalogService(ApplicationDbContext db, ApiResponseCache cache)
    {
        _db = db;
        _cache = cache;
    }

    public async Task<IReadOnlyList<CourtCatalogEntryDto>> ListAsync(
        CancellationToken cancellationToken = default)
    {
        return await _cache.GetOrCreateAsync(
            CacheKeys.CourtsCatalog,
            CacheDurations.CourtsCatalog,
            _ => LoadCourtsAsync(cancellationToken),
            cancellationToken);
    }

    public async Task<IReadOnlyList<CourtCatalogEntryDto>> ReplaceAllAsync(
        SaveCourtsCatalogRequest request,
        CancellationToken cancellationToken = default)
    {
        var existing = await _db.CourtCatalogEntries.ToListAsync(cancellationToken);
        _db.CourtCatalogEntries.RemoveRange(existing);

        foreach (var dto in request.Entries)
        {
            _db.CourtCatalogEntries.Add(new CourtCatalogEntry
            {
                Id = dto.Id == Guid.Empty ? Guid.NewGuid() : dto.Id,
                City = dto.City.Trim(),
                Court = dto.Court.Trim(),
                CircuitsJson = JsonSerializer.Serialize(dto.Circuits),
            });
        }

        await _db.SaveChangesAsync(cancellationToken);
        await _cache.RemoveAsync(CacheKeys.CourtsCatalog, cancellationToken);
        return await ListAsync(cancellationToken);
    }

    private async Task<IReadOnlyList<CourtCatalogEntryDto>> LoadCourtsAsync(
        CancellationToken cancellationToken)
    {
        if (!await _db.CourtCatalogEntries.AnyAsync(cancellationToken))
            await SeedDefaultsAsync(cancellationToken);

        var rows = await _db.CourtCatalogEntries
            .AsNoTracking()
            .OrderBy(c => c.City)
            .ThenBy(c => c.Court)
            .ToListAsync(cancellationToken);

        return rows.Select(WorkOrderMapper.ToCourtDto).ToList();
    }

    private async Task SeedDefaultsAsync(CancellationToken cancellationToken)
    {
        var defaults = new (string City, string Court, string[] Circuits)[]
        {
            ("مكة المكرمة", "محكمة التنفيذ بمكة المكرمة", ["الدائرة الأولى", "الدائرة الثانية"]),
            ("مكة المكرمة", "محكمة الاستئناف بمكة المكرمة", ["دائرة الأحوال"]),
            ("جدة", "محكمة التنفيذ بجدة", ["الدائرة الأولى", "الدائرة الثانية", "الدائرة الثالثة"]),
            ("الرياض", "محكمة التنفيذ بالرياض", ["الدائرة الأولى", "الدائرة الثانية"]),
            ("الطائف", "محكمة التنفيذ بالطائف", ["الدائرة الأولى"]),
        };

        foreach (var d in defaults)
        {
            _db.CourtCatalogEntries.Add(new CourtCatalogEntry
            {
                Id = Guid.NewGuid(),
                City = d.City,
                Court = d.Court,
                CircuitsJson = JsonSerializer.Serialize(d.Circuits),
            });
        }

        await _db.SaveChangesAsync(cancellationToken);
    }
}

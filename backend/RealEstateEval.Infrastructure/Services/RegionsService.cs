using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Caching;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Infrastructure.Services;

public sealed class RegionsService : IRegionsService
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    private readonly PlatformDbContext _db;
    private readonly ApiResponseCache _cache;

    public RegionsService(PlatformDbContext db, ApiResponseCache cache)
    {
        _db = db;
        _cache = cache;
    }

    public async Task EnsureSeededAsync(CancellationToken cancellationToken = default)
    {
        if (await _db.Regions.AnyAsync(cancellationToken)) return;

        var payload = LoadSeedPayload();
        if (payload?.Regions is null || payload.Cities is null || payload.Regions.Count == 0)
            return;

        var now = DateTime.UtcNow;
        var regionMap = new Dictionary<int, Guid>();

        foreach (var row in payload.Regions)
        {
            var id = SeedGuid(0xB1, row.Id);
            regionMap[row.Id] = id;
            _db.Regions.Add(new Region
            {
                Id = id,
                Code = row.Code.Trim(),
                NameAr = row.NameAr.Trim(),
                CapitalAr = row.CapitalAr.Trim(),
                IsActive = true,
                CreatedAtUtc = now,
            });
        }

        foreach (var row in payload.Cities)
        {
            if (!regionMap.TryGetValue(row.RegionId, out var regionId)) continue;
            _db.Cities.Add(new City
            {
                Id = SeedGuid(0xB2, row.Id),
                RegionId = regionId,
                NameAr = row.NameAr.Trim(),
                IsCapital = row.IsCapital,
                IsActive = row.IsActive,
                CreatedAtUtc = now,
            });
        }

        await _db.SaveChangesAsync(cancellationToken);
        await _cache.RemoveAsync(CacheKeys.RegionsCatalog, cancellationToken);
        await _cache.RemoveAsync(CacheKeys.CitiesCatalog, cancellationToken);
    }

    public async Task<IReadOnlyList<SelectableRegionDto>> ListSelectableRegionsAsync(
        CancellationToken cancellationToken = default)
    {
        await EnsureSeededAsync(cancellationToken);
        return await _cache.GetOrCreateAsync(
            CacheKeys.RegionsCatalog,
            CacheDurations.RegionsCatalog,
            async ct =>
            {
                return await _db.Regions.AsNoTracking()
                    .Where(r => r.IsActive)
                    .OrderBy(r => r.NameAr)
                    .Select(r => new SelectableRegionDto
                    {
                        Id = r.Id,
                        Code = r.Code,
                        NameAr = r.NameAr,
                        CapitalAr = r.CapitalAr,
                    })
                    .ToListAsync(ct);
            },
            cancellationToken);
    }

    public async Task<IReadOnlyList<SelectableCityDto>> ListAllSelectableCitiesAsync(
        CancellationToken cancellationToken = default)
    {
        await EnsureSeededAsync(cancellationToken);
        return await _cache.GetOrCreateAsync(
            CacheKeys.CitiesCatalog,
            CacheDurations.RegionsCatalog,
            async ct =>
            {
                return await _db.Cities.AsNoTracking()
                    .Where(c => c.IsActive && c.Region != null && c.Region.IsActive)
                    .OrderBy(c => c.NameAr)
                    .Select(c => new SelectableCityDto
                    {
                        Id = c.Id,
                        RegionId = c.RegionId,
                        NameAr = c.NameAr,
                        IsCapital = c.IsCapital,
                        RegionNameAr = c.Region!.NameAr,
                    })
                    .ToListAsync(ct);
            },
            cancellationToken);
    }

    public async Task<IReadOnlyList<SelectableCityDto>> ListSelectableCitiesAsync(
        Guid regionId,
        CancellationToken cancellationToken = default)
    {
        await EnsureSeededAsync(cancellationToken);

        var region = await _db.Regions.AsNoTracking()
            .Where(r => r.Id == regionId && r.IsActive)
            .Select(r => new { r.Id, r.NameAr })
            .FirstOrDefaultAsync(cancellationToken);
        if (region is null) return [];

        return await _db.Cities.AsNoTracking()
            .Where(c => c.RegionId == regionId && c.IsActive)
            .OrderByDescending(c => c.IsCapital)
            .ThenBy(c => c.NameAr)
            .Select(c => new SelectableCityDto
            {
                Id = c.Id,
                RegionId = c.RegionId,
                NameAr = c.NameAr,
                IsCapital = c.IsCapital,
                RegionNameAr = region.NameAr,
            })
            .ToListAsync(cancellationToken);
    }

    private static Guid SeedGuid(byte kind, int id)
    {
        var bytes = new byte[16];
        bytes[0] = kind;
        bytes[7] = 0x40; // version-ish marker
        bytes[8] = 0x80;
        var idBytes = BitConverter.GetBytes(id);
        if (BitConverter.IsLittleEndian) Array.Reverse(idBytes);
        Buffer.BlockCopy(idBytes, 0, bytes, 12, 4);
        return new Guid(bytes);
    }

    private static SeedFile? LoadSeedPayload()
    {
        var paths = new[]
        {
            Path.Combine(AppContext.BaseDirectory, "Data", "Seed", "regions_cities.json"),
            Path.Combine(AppContext.BaseDirectory, "regions_cities.json"),
            Path.GetFullPath(Path.Combine(
                AppContext.BaseDirectory,
                "..", "..", "..", "..",
                "RealEstateEval.Infrastructure", "Data", "Seed", "regions_cities.json")),
        };

        foreach (var path in paths)
        {
            if (!File.Exists(path)) continue;
            var json = File.ReadAllText(path);
            return JsonSerializer.Deserialize<SeedFile>(json, JsonOpts);
        }

        var asm = typeof(RegionsService).Assembly;
        var resourceName = asm.GetManifestResourceNames()
            .FirstOrDefault(n => n.EndsWith("regions_cities.json", StringComparison.OrdinalIgnoreCase));
        if (resourceName is null) return null;
        using var stream = asm.GetManifestResourceStream(resourceName);
        if (stream is null) return null;
        return JsonSerializer.Deserialize<SeedFile>(stream, JsonOpts);
    }

    private sealed class SeedFile
    {
        public List<SeedRegion> Regions { get; set; } = [];
        public List<SeedCity> Cities { get; set; } = [];
    }

    private sealed class SeedRegion
    {
        public int Id { get; set; }
        public string Code { get; set; } = "";
        [System.Text.Json.Serialization.JsonPropertyName("name_ar")]
        public string NameAr { get; set; } = "";
        [System.Text.Json.Serialization.JsonPropertyName("capital_ar")]
        public string CapitalAr { get; set; } = "";
    }

    private sealed class SeedCity
    {
        public int Id { get; set; }
        [System.Text.Json.Serialization.JsonPropertyName("region_id")]
        public int RegionId { get; set; }
        [System.Text.Json.Serialization.JsonPropertyName("name_ar")]
        public string NameAr { get; set; } = "";
        [System.Text.Json.Serialization.JsonPropertyName("is_capital")]
        public bool IsCapital { get; set; }
        [System.Text.Json.Serialization.JsonPropertyName("is_active")]
        public bool IsActive { get; set; } = true;
    }
}

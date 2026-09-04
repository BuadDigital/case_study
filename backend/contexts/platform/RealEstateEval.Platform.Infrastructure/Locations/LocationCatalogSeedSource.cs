using System.Text.Json;
using System.Text.Json.Serialization;
using RealEstateEval.Domain;
using RealEstateEval.Platform.Application.Abstractions;

namespace RealEstateEval.Platform.Infrastructure.Locations;

/// <summary>
/// Reads the shipped regions/cities catalog: the file next to the host if it was copied, else
/// the embedded resource of this assembly. Keeps the JSON shape — and the assembly the resource
/// lives in — out of <c>Platform.Application</c>.
/// </summary>
public sealed class LocationCatalogSeedSource : ILocationCatalogSeedSource
{
    private static readonly JsonSerializerOptions JsonOpts = JsonDefaults.CaseInsensitive;

    public LocationCatalogSeed? Load()
    {
        var file = ReadFromDisk() ?? ReadFromEmbeddedResource();
        if (file?.Regions is null || file.Cities is null) return null;

        return new LocationCatalogSeed(
            file.Regions
                .Select(r => new LocationSeedRegion(
                    r.Id, r.Code, r.AdminAreaId, r.NameAr, r.CapitalAr, r.IsActive))
                .ToList(),
            file.Cities
                .Select(c => new LocationSeedCity(
                    c.Id,
                    c.RegionId,
                    c.NameAr,
                    c.NameEn,
                    c.NameSearch,
                    c.IsGovernorate,
                    c.IsCapital,
                    c.IsActive,
                    c.DuplicateOf))
                .ToList());
    }

    private static SeedFile? ReadFromDisk()
    {
        var paths = new[]
        {
            Path.Combine(AppContext.BaseDirectory, "Data", "Seed", "regions_cities.json"),
            Path.Combine(AppContext.BaseDirectory, "regions_cities.json"),
            Path.GetFullPath(Path.Combine(
                AppContext.BaseDirectory,
                "..", "..", "..", "..",
                "RealEstateEval.Platform.Infrastructure", "Data", "Seed", "regions_cities.json")),
        };

        foreach (var path in paths)
        {
            if (!File.Exists(path)) continue;
            return JsonSerializer.Deserialize<SeedFile>(File.ReadAllText(path), JsonOpts);
        }

        return null;
    }

    private static SeedFile? ReadFromEmbeddedResource()
    {
        var asm = typeof(LocationCatalogSeedSource).Assembly;
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
        [JsonPropertyName("admin_area_id")]
        public int AdminAreaId { get; set; }
        [JsonPropertyName("name_ar")]
        public string NameAr { get; set; } = "";
        [JsonPropertyName("capital_ar")]
        public string CapitalAr { get; set; } = "";
        [JsonPropertyName("is_active")]
        public bool IsActive { get; set; } = true;
    }

    private sealed class SeedCity
    {
        public int Id { get; set; }
        [JsonPropertyName("region_id")]
        public int RegionId { get; set; }
        [JsonPropertyName("name_ar")]
        public string NameAr { get; set; } = "";
        [JsonPropertyName("name_en")]
        public string? NameEn { get; set; }
        [JsonPropertyName("name_search")]
        public string? NameSearch { get; set; }
        [JsonPropertyName("is_governorate")]
        public bool IsGovernorate { get; set; }
        [JsonPropertyName("is_capital")]
        public bool IsCapital { get; set; }
        [JsonPropertyName("is_active")]
        public bool IsActive { get; set; } = true;
        [JsonPropertyName("duplicate_of")]
        public int? DuplicateOf { get; set; }
    }
}

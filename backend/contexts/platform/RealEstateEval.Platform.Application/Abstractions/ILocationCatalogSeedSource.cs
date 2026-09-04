namespace RealEstateEval.Platform.Application.Abstractions;

/// <summary>One region of the official administrative catalog.</summary>
public sealed record LocationSeedRegion(
    int Id,
    string Code,
    int AdminAreaId,
    string NameAr,
    string CapitalAr,
    bool IsActive);

/// <summary>One city of the official administrative catalog.</summary>
public sealed record LocationSeedCity(
    int Id,
    int RegionId,
    string NameAr,
    string? NameEn,
    string? NameSearch,
    bool IsGovernorate,
    bool IsCapital,
    bool IsActive,
    int? DuplicateOf);

public sealed record LocationCatalogSeed(
    IReadOnlyList<LocationSeedRegion> Regions,
    IReadOnlyList<LocationSeedCity> Cities);

/// <summary>
/// Supplies the shipped regions/cities catalog. The payload is an embedded resource of the
/// Platform Infrastructure assembly, so the reconciliation use case asks for it through this
/// port instead of reading a file itself.
/// </summary>
public interface ILocationCatalogSeedSource
{
    /// <summary>The shipped catalog, or <c>null</c> when it cannot be located.</summary>
    LocationCatalogSeed? Load();
}

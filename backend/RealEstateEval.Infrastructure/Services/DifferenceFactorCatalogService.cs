using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Infrastructure.Services;

/// <summary>
/// factor definitions are admin-managed reference
/// data with a version log: every save bumps the version and writes an audit row.
/// </summary>
public sealed class DifferenceFactorCatalogService(
    PlatformDbContext db,
    IAuditLogWriter audit) : IDifferenceFactorCatalogService
{
    private static readonly Guid SingletonId = Guid.Parse("6f1a3c60-19b2-4c8e-9d55-000000000019");

    public async Task<DifferenceFactorCatalogDto> GetAsync(
        CancellationToken cancellationToken = default)
    {
        var row = await db.DifferenceFactorCatalogConfigs.AsNoTracking()
            .FirstOrDefaultAsync(cancellationToken);
        if (row is null)
        {
            return ToDto(DifferenceFactorCatalog.Seed(), version: 0, DateTime.UtcNow);
        }

        var entries = DifferenceFactorCatalog.Parse(row.CatalogJson);
        return ToDto(entries.Count > 0 ? entries : DifferenceFactorCatalog.Seed(), row.Version, row.UpdatedAtUtc);
    }

    public async Task<(DifferenceFactorCatalogDto? Result, string? Error)> SaveAsync(
        SaveDifferenceFactorCatalogRequest request,
        string actorId,
        CancellationToken cancellationToken = default)
    {
        var entries = (request.Factors ?? [])
            .Select((f, i) => new DifferenceFactorDefinition(
                f.Key.Trim().ToLowerInvariant(),
                f.LabelAr.Trim(),
                f.DefinitionAr?.Trim() ?? "",
                f.ExcludesAr?.Trim() ?? "",
                f.SortOrder != 0 ? f.SortOrder : i + 1,
                f.IsActive))
            .ToList();

        if (DifferenceFactorCatalog.Validate(entries) is { } error)
            return (null, error);

        var row = await db.DifferenceFactorCatalogConfigs
            .FirstOrDefaultAsync(cancellationToken);
        var now = DateTime.UtcNow;
        var previousJson = row?.CatalogJson;
        if (row is null)
        {
            row = new DifferenceFactorCatalogConfig
            {
                Id = SingletonId,
                Version = 1,
                UpdatedAtUtc = now,
            };
            db.DifferenceFactorCatalogConfigs.Add(row);
        }
        else
        {
            row.Version += 1;
            row.UpdatedAtUtc = now;
        }

        row.CatalogJson = DifferenceFactorCatalog.Serialize(entries);

 // سجل النسخ — the audit trail carries the before/after of every version.
        db.AuditLogs.Add(audit.Create(
            string.IsNullOrWhiteSpace(actorId) ? "system" : actorId,
            "DIFFERENCE_FACTOR_CATALOG_SAVED",
            "difference_factor_catalog",
            row.Id.ToString("D"),
            new { version = row.Version - 1, factors = DifferenceFactorCatalog.Parse(previousJson) },
            new { version = row.Version, factors = entries }));

        await db.SaveChangesAsync(cancellationToken);
        return (ToDto(entries, row.Version, row.UpdatedAtUtc), null);
    }

    private static DifferenceFactorCatalogDto ToDto(
        IReadOnlyList<DifferenceFactorDefinition> entries,
        int version,
        DateTime updatedAtUtc) =>
        new()
        {
            Factors = entries
                .OrderBy(e => e.SortOrder)
                .Select(e => new DifferenceFactorDefinitionDto
                {
                    Key = e.Key,
                    LabelAr = e.LabelAr,
                    DefinitionAr = e.DefinitionAr,
                    ExcludesAr = e.ExcludesAr,
                    SortOrder = e.SortOrder,
                    IsActive = e.IsActive,
                })
                .ToList(),
            Version = version,
            UpdatedAtUtc = updatedAtUtc,
        };
}

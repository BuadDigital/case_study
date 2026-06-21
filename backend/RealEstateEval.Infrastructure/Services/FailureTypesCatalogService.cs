using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Infrastructure.Services;

public sealed class FailureTypesCatalogService : IFailureTypesCatalogService
{
    private static readonly Guid SingletonId = Guid.Parse("c2d3e4f5-a6b7-8901-cdef-123456789012");
    private readonly ApplicationDbContext _db;

    public FailureTypesCatalogService(ApplicationDbContext db) => _db = db;

    public async Task<FailureTypesCatalogDto> GetAsync(CancellationToken cancellationToken = default)
    {
        var row = await _db.FailureTypesCatalogConfigs.AsNoTracking()
            .FirstOrDefaultAsync(cancellationToken);
        return row is null ? Empty() : ToDto(row);
    }

    public async Task<FailureTypesCatalogDto> SaveAsync(
        SaveFailureTypesCatalogRequest request,
        CancellationToken cancellationToken = default)
    {
        var payload = JsonSerializer.Serialize(new
        {
            categories = request.Categories ?? [],
            problemTypes = request.ProblemTypes ?? [],
        });

        var row = await _db.FailureTypesCatalogConfigs.FirstOrDefaultAsync(cancellationToken);
        var now = DateTime.UtcNow;
        if (row is null)
        {
            row = new FailureTypesCatalogConfig
            {
                Id = SingletonId,
                CatalogJson = payload,
                UpdatedAtUtc = now,
            };
            _db.FailureTypesCatalogConfigs.Add(row);
        }
        else
        {
            row.CatalogJson = payload;
            row.UpdatedAtUtc = now;
        }

        await _db.SaveChangesAsync(cancellationToken);
        return ToDto(row);
    }

    private static FailureTypesCatalogDto Empty() => new()
    {
        Categories = [],
        ProblemTypes = [],
        UpdatedAtUtc = DateTime.UtcNow,
    };

    private static FailureTypesCatalogDto ToDto(FailureTypesCatalogConfig row)
    {
        using var doc = JsonDocument.Parse(row.CatalogJson);
        var root = doc.RootElement;
        var categories = root.TryGetProperty("categories", out var c)
            ? JsonSerializer.Deserialize<List<FailureTypeCategoryDto>>(c.GetRawText()) ?? []
            : [];
        var problemTypes = root.TryGetProperty("problemTypes", out var p)
            ? JsonSerializer.Deserialize<List<FailureProblemTypeDto>>(p.GetRawText()) ?? []
            : [];
        return new FailureTypesCatalogDto
        {
            Categories = categories,
            ProblemTypes = problemTypes,
            UpdatedAtUtc = row.UpdatedAtUtc,
        };
    }
}

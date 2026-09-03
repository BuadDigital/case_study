using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Failures.Application.Abstractions;
using RealEstateEval.Failures.Infrastructure.Data.Contexts;
using RealEstateEval.Failures.Application.Contracts;
using RealEstateEval.Failures.Domain;

namespace RealEstateEval.Failures.Infrastructure.Services;

public sealed class FailureTypesCatalogService : IFailureTypesCatalogService
{
    private static readonly Guid SingletonId = Guid.Parse("c2d3e4f5-a6b7-8901-cdef-123456789012");

    private static readonly JsonSerializerOptions JsonOptions = JsonDefaults.CamelCaseInsensitive;

    private readonly FailuresDbContext _db;
    private readonly TimeProvider _time;

    public FailureTypesCatalogService(FailuresDbContext db, TimeProvider? time = null)
    {
        _db = db;
        _time = time ?? TimeProvider.System;
    }

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
        }, JsonOptions);

        var row = await _db.FailureTypesCatalogConfigs.FirstOrDefaultAsync(cancellationToken);
        var now = _time.UtcNow();
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

    private FailureTypesCatalogDto Empty() => new()
    {
        Categories = [],
        ProblemTypes = [],
        UpdatedAtUtc = _time.UtcNow(),
    };

    private static FailureTypesCatalogDto ToDto(FailureTypesCatalogConfig row)
    {
        using var doc = JsonDocument.Parse(row.CatalogJson);
        var root = doc.RootElement;
        var categories = root.TryGetProperty("categories", out var c)
            ? JsonSerializer.Deserialize<List<FailureTypeCategoryDto>>(c.GetRawText(), JsonOptions) ?? []
            : [];
        var problemTypes = root.TryGetProperty("problemTypes", out var p)
            ? JsonSerializer.Deserialize<List<FailureProblemTypeDto>>(p.GetRawText(), JsonOptions) ?? []
            : [];
        return new FailureTypesCatalogDto
        {
            Categories = categories,
            ProblemTypes = problemTypes,
            UpdatedAtUtc = row.UpdatedAtUtc,
        };
    }
}

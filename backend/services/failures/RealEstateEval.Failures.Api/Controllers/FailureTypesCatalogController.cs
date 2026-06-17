using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Failures.Api.Controllers;

[ApiController]
[Route("api/failure-types-catalog")]
[Authorize]
public class FailureTypesCatalogController : ControllerBase
{
    private static readonly Guid SingletonId = Guid.Parse("c2d3e4f5-a6b7-8901-cdef-123456789012");
    private readonly ApplicationDbContext _db;

    public FailureTypesCatalogController(ApplicationDbContext db) => _db = db;

    [HttpGet]
    public async Task<ActionResult<FailureTypesCatalogDto>> Get(CancellationToken ct)
    {
        var row = await _db.FailureTypesCatalogConfigs.AsNoTracking().FirstOrDefaultAsync(ct);
        return Ok(row is null ? Empty() : ToDto(row));
    }

    [HttpPut]
    public async Task<ActionResult<FailureTypesCatalogDto>> Save(
        [FromBody] SaveFailureTypesCatalogRequest request,
        CancellationToken ct)
    {
        var payload = JsonSerializer.Serialize(new
        {
            categories = request.Categories ?? [],
            problemTypes = request.ProblemTypes ?? [],
        });

        var row = await _db.FailureTypesCatalogConfigs.FirstOrDefaultAsync(ct);
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

        await _db.SaveChangesAsync(ct);
        return Ok(ToDto(row));
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

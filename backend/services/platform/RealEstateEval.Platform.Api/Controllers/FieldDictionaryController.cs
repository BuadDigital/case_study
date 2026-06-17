using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Platform.Api.Controllers;

[ApiController]
[Route("api/field-dictionary")]
[Authorize]
public class FieldDictionaryController : ControllerBase
{
    private static readonly Guid SingletonId = Guid.Parse("b1c2d3e4-f5a6-7890-abcd-ef1234567891");
    private readonly ApplicationDbContext _db;

    public FieldDictionaryController(ApplicationDbContext db) => _db = db;

    [HttpGet]
    public async Task<ActionResult<FieldDictionaryStateDto>> Get(CancellationToken ct)
    {
        var row = await _db.FieldDictionaryConfigs.AsNoTracking().FirstOrDefaultAsync(ct);
        return Ok(row is null ? Empty() : ToDto(row));
    }

    [HttpPut]
    public async Task<ActionResult<FieldDictionaryStateDto>> Save(
        [FromBody] SaveFieldDictionaryStateRequest request,
        CancellationToken ct)
    {
        var payload = JsonSerializer.Serialize(new
        {
            fields = request.Fields ?? [],
            tags = request.Tags ?? [],
        });

        var row = await _db.FieldDictionaryConfigs.FirstOrDefaultAsync(ct);
        var now = DateTime.UtcNow;
        if (row is null)
        {
            row = new FieldDictionaryConfig
            {
                Id = SingletonId,
                StateJson = payload,
                UpdatedAtUtc = now,
            };
            _db.FieldDictionaryConfigs.Add(row);
        }
        else
        {
            row.StateJson = payload;
            row.UpdatedAtUtc = now;
        }

        await _db.SaveChangesAsync(ct);
        return Ok(ToDto(row));
    }

    private static FieldDictionaryStateDto Empty() => new()
    {
        Fields = [],
        Tags = [],
        UpdatedAtUtc = DateTime.UtcNow,
    };

    private static FieldDictionaryStateDto ToDto(FieldDictionaryConfig row)
    {
        using var doc = JsonDocument.Parse(row.StateJson);
        var root = doc.RootElement;
        var fields = root.TryGetProperty("fields", out var f)
            ? JsonSerializer.Deserialize<List<FieldDictionaryFieldDto>>(f.GetRawText()) ?? []
            : [];
        var tags = root.TryGetProperty("tags", out var t)
            ? JsonSerializer.Deserialize<List<string>>(t.GetRawText()) ?? []
            : [];
        return new FieldDictionaryStateDto
        {
            Fields = fields,
            Tags = tags,
            UpdatedAtUtc = row.UpdatedAtUtc,
        };
    }
}

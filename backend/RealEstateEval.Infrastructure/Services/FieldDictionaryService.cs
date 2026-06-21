using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Infrastructure.Services;

public sealed class FieldDictionaryService : IFieldDictionaryService
{
    private static readonly Guid SingletonId = Guid.Parse("b1c2d3e4-f5a6-7890-abcd-ef1234567891");
    private readonly ApplicationDbContext _db;

    public FieldDictionaryService(ApplicationDbContext db) => _db = db;

    public async Task<FieldDictionaryStateDto> GetAsync(CancellationToken cancellationToken = default)
    {
        var row = await _db.FieldDictionaryConfigs.AsNoTracking()
            .FirstOrDefaultAsync(cancellationToken);
        return row is null ? Empty() : ToDto(row);
    }

    public async Task<FieldDictionaryStateDto> SaveAsync(
        SaveFieldDictionaryStateRequest request,
        CancellationToken cancellationToken = default)
    {
        var payload = JsonSerializer.Serialize(new
        {
            fields = request.Fields ?? [],
            tags = request.Tags ?? [],
        });

        var row = await _db.FieldDictionaryConfigs.FirstOrDefaultAsync(cancellationToken);
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

        await _db.SaveChangesAsync(cancellationToken);
        return ToDto(row);
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

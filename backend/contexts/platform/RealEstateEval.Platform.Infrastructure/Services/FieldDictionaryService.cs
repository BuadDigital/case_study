using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Platform.Application.Abstractions;
using RealEstateEval.Platform.Infrastructure.Data.Contexts;
using RealEstateEval.Platform.Application.Contracts;
using RealEstateEval.Platform.Domain;

namespace RealEstateEval.Platform.Infrastructure.Services;

public sealed class FieldDictionaryService : IFieldDictionaryService
{
    private readonly PlatformDbContext _db;
    private readonly TimeProvider _time;

    public FieldDictionaryService(PlatformDbContext db, TimeProvider? time = null)
    {
        _time = time ?? TimeProvider.System;
        _db = db;
    }

    public async Task<FieldDictionaryStateDto> GetAsync(CancellationToken cancellationToken = default)
    {
        var row = await _db.FieldDictionaryConfigs.AsNoTracking()
            .FirstOrDefaultAsync(cancellationToken);
        return row is null ? Empty() : ToDto(row);
    }

    private FieldDictionaryStateDto Empty() => new()
    {
        Fields = [],
        Tags = [],
        UpdatedAtUtc = _time.UtcNow(),
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

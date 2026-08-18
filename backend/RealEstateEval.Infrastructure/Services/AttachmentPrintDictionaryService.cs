using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Infrastructure.Services;

public sealed class AttachmentPrintDictionaryService : IAttachmentPrintDictionaryService
{
    private static readonly Guid SingletonId = AttachmentPrintDictionarySeed.SingletonId;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
    };

    private readonly PlatformDbContext _db;
    private readonly TimeProvider _time;

    public AttachmentPrintDictionaryService(PlatformDbContext db, TimeProvider? time = null)
    {
        _db = db;
        _time = time ?? TimeProvider.System;
    }

    public async Task<AttachmentPrintDictionaryDto> GetAsync(
        CancellationToken cancellationToken = default)
    {
        var row = await _db.AttachmentPrintDictionaryConfigs.AsNoTracking()
            .FirstOrDefaultAsync(cancellationToken);
        if (row is null)
        {
            return ToDto(new AttachmentPrintDictionaryConfig
            {
                Id = SingletonId,
                CatalogJson = AttachmentPrintDictionarySeed.CatalogJson,
                UpdatedAtUtc = _time.UtcNow(),
            });
        }

        return ToDto(row);
    }

    public async Task<AttachmentPrintDictionaryDto> SaveAsync(
        SaveAttachmentPrintDictionaryRequest request,
        CancellationToken cancellationToken = default)
    {
        var types = Normalize(request.Types ?? []);
        var payload = JsonSerializer.Serialize(new { types }, JsonOptions);

        var row = await _db.AttachmentPrintDictionaryConfigs
            .FirstOrDefaultAsync(cancellationToken);
        var now = _time.UtcNow();
        if (row is null)
        {
            row = new AttachmentPrintDictionaryConfig
            {
                Id = SingletonId,
                CatalogJson = payload,
                UpdatedAtUtc = now,
            };
            _db.AttachmentPrintDictionaryConfigs.Add(row);
        }
        else
        {
            row.CatalogJson = payload;
            row.UpdatedAtUtc = now;
        }

        await _db.SaveChangesAsync(cancellationToken);
        return ToDto(row);
    }

    private static List<AttachmentPrintTypeDto> Normalize(
        IReadOnlyList<AttachmentPrintTypeDto> types)
    {
        var result = new List<AttachmentPrintTypeDto>();
        var order = 0;
        foreach (var t in types)
        {
            var key = (t.Key ?? "").Trim().ToLowerInvariant();
            var label = (t.LabelAr ?? "").Trim();
            if (string.IsNullOrWhiteSpace(key) || string.IsNullOrWhiteSpace(label))
                continue;
            order++;
            result.Add(new AttachmentPrintTypeDto
            {
                Id = string.IsNullOrWhiteSpace(t.Id) ? key : t.Id.Trim(),
                Key = key,
                LabelAr = label,
                PropertyTypeKeys = (t.PropertyTypeKeys ?? [])
                    .Select(x => x.Trim())
                    .Where(x => x.Length > 0)
                    .Distinct(StringComparer.Ordinal)
                    .ToList(),
                IsRequired = t.IsRequired,
                IsSystemDefault = t.IsSystemDefault,
                SortOrder = t.SortOrder > 0 ? t.SortOrder : order,
                IsActive = t.IsActive,
            });
        }

        return result.OrderBy(x => x.SortOrder).ThenBy(x => x.LabelAr).ToList();
    }

    private static AttachmentPrintDictionaryDto ToDto(AttachmentPrintDictionaryConfig row)
    {
        using var doc = JsonDocument.Parse(
            string.IsNullOrWhiteSpace(row.CatalogJson) ? "{}" : row.CatalogJson);
        var root = doc.RootElement;
        var types = root.TryGetProperty("types", out var t)
            ? JsonSerializer.Deserialize<List<AttachmentPrintTypeDto>>(t.GetRawText(), JsonOptions)
              ?? []
            : [];
        return new AttachmentPrintDictionaryDto
        {
            Types = types.OrderBy(x => x.SortOrder).ThenBy(x => x.LabelAr).ToList(),
            UpdatedAtUtc = row.UpdatedAtUtc,
        };
    }
}

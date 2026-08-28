using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Platform.Infrastructure.Data.Contexts;
using RealEstateEval.Platform.Infrastructure.Data;
using RealEstateEval.Platform.Domain;

namespace RealEstateEval.Platform.Infrastructure.Services;

public sealed class AttachmentPrintDictionaryService
    : IAttachmentPrintDictionaryService, IValuationListsService
{
    private static readonly Guid SingletonId = AttachmentPrintDictionarySeed.SingletonId;

    private static readonly JsonSerializerOptions JsonOptions = JsonDefaults.CamelCaseInsensitive;

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
        var catalog = await LoadAsync(cancellationToken);
        return ToPrintDto(catalog);
    }

    public async Task<AttachmentPrintDictionaryDto> SaveAsync(
        SaveAttachmentPrintDictionaryRequest request,
        CancellationToken cancellationToken = default)
    {
        var catalog = await LoadAsync(cancellationToken);
        catalog.Lists[ValuationListIds.Attachments] = FromPrintTypes(NormalizePrint(request.Types ?? []));
        await PersistAsync(catalog, cancellationToken);
        return ToPrintDto(catalog);
    }

    async Task<ValuationListsDto> IValuationListsService.GetAsync(
        CancellationToken cancellationToken)
    {
        var catalog = await LoadAsync(cancellationToken);
        return ToListsDto(catalog);
    }

    async Task<ValuationListsDto> IValuationListsService.SaveAsync(
        SaveValuationListsRequest request,
        CancellationToken cancellationToken)
    {
        var catalog = await LoadAsync(cancellationToken);
        if (!string.IsNullOrWhiteSpace(request.IvsEffectiveDate))
            catalog.IvsEffectiveDate = request.IvsEffectiveDate.Trim();
        if (request.PhotoPagesLand is >= 1 and <= 3)
            catalog.PhotoPagesLand = request.PhotoPagesLand.Value;
        if (request.PhotoPagesBuilt is >= 1 and <= 4)
            catalog.PhotoPagesBuilt = request.PhotoPagesBuilt.Value;

        if (request.Lists is not null)
        {
            foreach (var id in ValuationListIds.TableLists)
            {
                if (!request.Lists.TryGetValue(id, out var rows) || rows is null)
                    continue;
                catalog.Lists[id] = NormalizeList(id, rows);
            }
        }

        await PersistAsync(catalog, cancellationToken);
        return ToListsDto(catalog);
    }

    private async Task<CatalogState> LoadAsync(CancellationToken cancellationToken)
    {
        var row = await _db.AttachmentPrintDictionaryConfigs.AsNoTracking()
            .FirstOrDefaultAsync(cancellationToken);
        return Parse(row?.CatalogJson, row?.UpdatedAtUtc ?? _time.UtcNow());
    }

    private async Task PersistAsync(CatalogState catalog, CancellationToken cancellationToken)
    {
        var payload = JsonSerializer.Serialize(new
        {
            version = 2,
            ivsEffectiveDate = catalog.IvsEffectiveDate,
            photoPagesLand = catalog.PhotoPagesLand,
            photoPagesBuilt = catalog.PhotoPagesBuilt,
            lists = catalog.Lists,
        }, JsonOptions);

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
        catalog.UpdatedAtUtc = now;
    }

    private static CatalogState Parse(string? json, DateTime updatedAt)
    {
        var seeded = ValuationListsSeed.Defaults();
        var state = new CatalogState
        {
            IvsEffectiveDate = ValuationListsSeed.DefaultIvsDate,
            PhotoPagesLand = ValuationListsSeed.DefaultPhotoPagesLand,
            PhotoPagesBuilt = ValuationListsSeed.DefaultPhotoPagesBuilt,
            Lists = seeded,
            UpdatedAtUtc = updatedAt,
        };

        if (string.IsNullOrWhiteSpace(json))
            return state;

        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        if (root.TryGetProperty("ivsEffectiveDate", out var ivs) && ivs.ValueKind == JsonValueKind.String)
            state.IvsEffectiveDate = ivs.GetString()?.Trim() is { Length: > 0 } d
                ? d
                : state.IvsEffectiveDate;
        if (root.TryGetProperty("photoPagesLand", out var land) && land.TryGetInt32(out var landN))
            state.PhotoPagesLand = Math.Clamp(landN, 1, 3);
        if (root.TryGetProperty("photoPagesBuilt", out var built) && built.TryGetInt32(out var builtN))
            state.PhotoPagesBuilt = Math.Clamp(builtN, 1, 4);

        if (root.TryGetProperty("lists", out var listsEl) && listsEl.ValueKind == JsonValueKind.Object)
        {
            foreach (var id in ValuationListIds.TableLists)
            {
                if (!listsEl.TryGetProperty(id, out var arr) || arr.ValueKind != JsonValueKind.Array)
                    continue;
                var rows = JsonSerializer.Deserialize<List<ValuationListItemDto>>(arr.GetRawText(), JsonOptions);
                if (rows is { Count: > 0 })
                    state.Lists[id] = NormalizeList(id, rows);
            }
        }
        else if (root.TryGetProperty("types", out var typesEl))
        {
            var types = JsonSerializer.Deserialize<List<AttachmentPrintTypeDto>>(
                typesEl.GetRawText(), JsonOptions) ?? [];
            if (types.Count > 0)
                state.Lists[ValuationListIds.Attachments] = FromPrintTypes(NormalizePrint(types));
        }

        return state;
    }

    private static List<ValuationListItemDto> NormalizeList(
        string listId,
        IReadOnlyList<ValuationListItemDto> rows)
    {
        var result = new List<ValuationListItemDto>();
        var order = 0;
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var row in rows)
        {
            var name = (row.Name ?? "").Trim();
            if (name.Length == 0)
                continue;
            var key = (row.Key ?? "").Trim().ToLowerInvariant();
            if (key.Length == 0)
                key = $"item-{Guid.NewGuid():N}"[..16];
            if (!seen.Add(key))
                continue;
            order++;
            var cells = (row.Cells ?? [])
                .Select(x => (x ?? "").Trim())
                .ToList();
            var required = listId == ValuationListIds.Attachments
                && (row.IsRequired || cells.FirstOrDefault() == "إلزامي");
            var propertyKeys = listId == ValuationListIds.Attachments
                ? NormalizePropertyKeys(row.PropertyTypeKeys, cells.ElementAtOrDefault(1))
                : [];
            if (listId == ValuationListIds.Attachments)
            {
                if (cells.Count < 1) cells.Add(required ? "إلزامي" : "اختياري");
                else cells[0] = required ? "إلزامي" : "اختياري";
                var propertyLabel = propertyKeys.Count == 0 ? "الكل" : string.Join("، ", propertyKeys);
                if (cells.Count < 2) cells.Add(propertyLabel);
                else cells[1] = propertyLabel;
            }

            result.Add(new ValuationListItemDto
            {
                Id = string.IsNullOrWhiteSpace(row.Id) ? $"{listId}-{key}" : row.Id.Trim(),
                Key = key,
                Name = name,
                Cells = cells,
                IsEnabled = row.IsEnabled,
                DefaultName = string.IsNullOrWhiteSpace(row.DefaultName) ? name : row.DefaultName.Trim(),
                Usage = Math.Max(0, row.Usage),
                SortOrder = row.SortOrder > 0 ? row.SortOrder : order,
                IsSystemDefault = row.IsSystemDefault,
                IsRequired = required,
                PropertyTypeKeys = propertyKeys,
            });
        }

        return result.OrderBy(x => x.SortOrder).ThenBy(x => x.Name).ToList();
    }

    private static IReadOnlyList<string> NormalizePropertyKeys(
        IReadOnlyList<string>? keys,
        string? cell)
    {
        var fromKeys = (keys ?? [])
            .Select(x => x.Trim())
            .Where(x => x.Length > 0 && x != "الكل")
            .Distinct(StringComparer.Ordinal)
            .ToList();
        if (fromKeys.Count > 0)
            return fromKeys;
        var fromCell = (cell ?? "")
            .Split(['،', ',', '|'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(x => x != "الكل")
            .Distinct(StringComparer.Ordinal)
            .ToList();
        return fromCell;
    }

    private static List<AttachmentPrintTypeDto> NormalizePrint(
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

    private static List<ValuationListItemDto> FromPrintTypes(IReadOnlyList<AttachmentPrintTypeDto> types)
    {
        var order = 0;
        return types.Select(t =>
        {
            order++;
            var property = t.PropertyTypeKeys.Count == 0 ? "الكل" : string.Join("، ", t.PropertyTypeKeys);
            return new ValuationListItemDto
            {
                Id = t.Id,
                Key = t.Key,
                Name = t.LabelAr,
                Cells = [t.IsRequired ? "إلزامي" : "اختياري", property],
                IsEnabled = t.IsActive,
                DefaultName = t.LabelAr,
                Usage = 0,
                SortOrder = t.SortOrder > 0 ? t.SortOrder : order,
                IsSystemDefault = t.IsSystemDefault,
                IsRequired = t.IsRequired,
                PropertyTypeKeys = t.PropertyTypeKeys,
            };
        }).ToList();
    }

    private static AttachmentPrintDictionaryDto ToPrintDto(CatalogState catalog)
    {
        var types = (catalog.Lists.GetValueOrDefault(ValuationListIds.Attachments) ?? [])
            .Select(x => new AttachmentPrintTypeDto
            {
                Id = x.Id,
                Key = x.Key,
                LabelAr = x.Name,
                PropertyTypeKeys = x.PropertyTypeKeys.ToList(),
                IsRequired = x.IsRequired,
                IsSystemDefault = x.IsSystemDefault,
                SortOrder = x.SortOrder,
                IsActive = x.IsEnabled,
            })
            .OrderBy(x => x.SortOrder)
            .ThenBy(x => x.LabelAr)
            .ToList();
        return new AttachmentPrintDictionaryDto
        {
            Types = types,
            UpdatedAtUtc = catalog.UpdatedAtUtc,
        };
    }

    private static ValuationListsDto ToListsDto(CatalogState catalog) =>
        new()
        {
            IvsEffectiveDate = catalog.IvsEffectiveDate,
            PhotoPagesLand = catalog.PhotoPagesLand,
            PhotoPagesBuilt = catalog.PhotoPagesBuilt,
            Lists = catalog.Lists.ToDictionary(
                kv => kv.Key,
                kv => kv.Value),
            UpdatedAtUtc = catalog.UpdatedAtUtc,
        };

    private sealed class CatalogState
    {
        public string IvsEffectiveDate { get; set; } = ValuationListsSeed.DefaultIvsDate;
        public int PhotoPagesLand { get; set; } = ValuationListsSeed.DefaultPhotoPagesLand;
        public int PhotoPagesBuilt { get; set; } = ValuationListsSeed.DefaultPhotoPagesBuilt;
        public Dictionary<string, List<ValuationListItemDto>> Lists { get; set; } = [];
        public DateTime UpdatedAtUtc { get; set; }
    }
}

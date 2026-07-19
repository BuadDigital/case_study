using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Caching;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Infrastructure.Services;

public sealed class CourtsService : ICourtsService
{
    private static readonly JsonSerializerOptions AuditJsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private readonly ApplicationDbContext _db;
    private readonly ApiResponseCache _cache;

    public CourtsService(ApplicationDbContext db, ApiResponseCache cache)
    {
        _db = db;
        _cache = cache;
    }

    public async Task EnsureSeededAsync(CancellationToken cancellationToken = default)
    {
        if (await _db.Courts.AnyAsync(cancellationToken)) return;

        var legacy = await _db.CourtCatalogEntries.AsNoTracking().ToListAsync(cancellationToken);
        if (legacy.Count > 0)
        {
            foreach (var row in legacy)
            {
                var court = new Court
                {
                    Id = row.Id == Guid.Empty ? Guid.NewGuid() : row.Id,
                    Name = row.Court.Trim(),
                    Region = row.City.Trim(),
                    City = row.City.Trim(),
                    IsActive = true,
                    CreatedBy = "system",
                    CreatedAtUtc = DateTime.UtcNow,
                };
                _db.Courts.Add(court);
                var circuits = ParseCircuits(row.CircuitsJson);
                foreach (var circuitNo in circuits)
                {
                    _db.CourtCircuits.Add(new CourtCircuit
                    {
                        Id = Guid.NewGuid(),
                        CourtId = court.Id,
                        CircuitNo = circuitNo.Trim(),
                        IsActive = true,
                        CreatedBy = "system",
                        CreatedAtUtc = DateTime.UtcNow,
                    });
                }
            }
            await _db.SaveChangesAsync(cancellationToken);
            await _cache.RemoveAsync(CacheKeys.CourtsCatalog, cancellationToken);
            return;
        }

        var defaults = new (string City, string Court, string[] Circuits)[]
        {
            ("مكة المكرمة", "محكمة التنفيذ بمكة المكرمة", ["الدائرة الأولى", "الدائرة الثانية"]),
            ("مكة المكرمة", "محكمة الاستئناف بمكة المكرمة", ["دائرة الأحوال"]),
            ("جدة", "محكمة التنفيذ بجدة", ["الدائرة الأولى", "الدائرة الثانية", "الدائرة الثالثة"]),
            ("الرياض", "محكمة التنفيذ بالرياض", ["الدائرة الأولى", "الدائرة الثانية"]),
            ("الطائف", "محكمة التنفيذ بالطائف", ["الدائرة الأولى"]),
        };
        foreach (var d in defaults)
        {
            var court = new Court
            {
                Id = Guid.NewGuid(),
                Name = d.Court,
                Region = d.City,
                City = d.City,
                IsActive = true,
                CreatedBy = "system",
                CreatedAtUtc = DateTime.UtcNow,
            };
            _db.Courts.Add(court);
            foreach (var circuitNo in d.Circuits)
            {
                _db.CourtCircuits.Add(new CourtCircuit
                {
                    Id = Guid.NewGuid(),
                    CourtId = court.Id,
                    CircuitNo = circuitNo,
                    IsActive = true,
                    CreatedBy = "system",
                    CreatedAtUtc = DateTime.UtcNow,
                });
            }
        }
        await _db.SaveChangesAsync(cancellationToken);
        await _cache.RemoveAsync(CacheKeys.CourtsCatalog, cancellationToken);
    }

    public async Task<CourtListResponseDto> ListAdminAsync(
        string? search,
        string? status,
        string? region,
        string? city,
        int page,
        int limit,
        CancellationToken cancellationToken = default)
    {
        await EnsureSeededAsync(cancellationToken);
        page = Math.Max(1, page);
        limit = Math.Clamp(limit <= 0 ? 50 : limit, 1, 200);

        var q = _db.Courts.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            q = q.Where(c => c.Name.Contains(s) || c.City.Contains(s) || c.Region.Contains(s));
        }
        if (string.Equals(status, "active", StringComparison.OrdinalIgnoreCase))
            q = q.Where(c => c.IsActive);
        else if (string.Equals(status, "inactive", StringComparison.OrdinalIgnoreCase))
            q = q.Where(c => !c.IsActive);
        if (!string.IsNullOrWhiteSpace(region))
            q = q.Where(c => c.Region == region.Trim());
        if (!string.IsNullOrWhiteSpace(city))
            q = q.Where(c => c.City == city.Trim());

        var total = await q.CountAsync(cancellationToken);
        var rows = await q
            .OrderBy(c => c.City)
            .ThenBy(c => c.Name)
            .Skip((page - 1) * limit)
            .Take(limit)
            .Select(c => new CourtDto
            {
                Id = c.Id,
                Name = c.Name,
                Region = c.Region,
                City = c.City,
                IsActive = c.IsActive,
                CircuitsCount = c.Circuits.Count,
                CreatedBy = c.CreatedBy,
                CreatedAtUtc = c.CreatedAtUtc.ToString("o"),
                UpdatedBy = c.UpdatedBy,
                UpdatedAtUtc = c.UpdatedAtUtc.HasValue ? c.UpdatedAtUtc.Value.ToString("o") : null,
            })
            .ToListAsync(cancellationToken);

        return new CourtListResponseDto
        {
            Data = rows,
            Total = total,
            Page = page,
            Limit = limit,
        };
    }

    public async Task<CourtDetailDto?> GetAdminAsync(Guid id, CancellationToken cancellationToken = default)
    {
        await EnsureSeededAsync(cancellationToken);
        var court = await _db.Courts
            .AsNoTracking()
            .Include(c => c.Circuits)
            .FirstOrDefaultAsync(c => c.Id == id, cancellationToken);
        if (court is null) return null;
        return ToDetail(court);
    }

    public async Task<(CourtDto? Court, string? Error)> CreateAsync(
        CreateCourtRequest request,
        string actorId,
        CancellationToken cancellationToken = default)
    {
        await EnsureSeededAsync(cancellationToken);
        var name = request.Name.Trim();
        var region = request.Region.Trim();
        var city = request.City.Trim();
        if (name.Length is < 2 or > 150) return (null, "اسم المحكمة مطلوب");
        if (string.IsNullOrWhiteSpace(region)) return (null, "المنطقة غير صحيحة");
        if (string.IsNullOrWhiteSpace(city)) return (null, "المدينة غير صحيحة");

        var exists = await _db.Courts.AnyAsync(
            c => c.Name == name && c.City == city,
            cancellationToken);
        if (exists) return (null, "توجد محكمة بنفس الاسم في هذه المدينة");

        var entity = new Court
        {
            Id = Guid.NewGuid(),
            Name = name,
            Region = region,
            City = city,
            IsActive = request.IsActive,
            CreatedBy = actorId,
            CreatedAtUtc = DateTime.UtcNow,
        };
        _db.Courts.Add(entity);
        AddAudit(
            CourtAuditActions.CourtCreated,
            CourtAuditEntityTypes.Court,
            entity.Id,
            actorId,
            new Dictionary<string, object?>
            {
                ["name"] = Diff(null, entity.Name),
                ["region"] = Diff(null, entity.Region),
                ["city"] = Diff(null, entity.City),
                ["isActive"] = Diff(null, entity.IsActive),
            });
        await _db.SaveChangesAsync(cancellationToken);
        await _cache.RemoveAsync(CacheKeys.CourtsCatalog, cancellationToken);
        return (ToDto(entity, 0), null);
    }

    public async Task<(CourtDto? Court, string? Error)> UpdateAsync(
        Guid id,
        UpdateCourtRequest request,
        string actorId,
        CancellationToken cancellationToken = default)
    {
        var entity = await _db.Courts.Include(c => c.Circuits).FirstOrDefaultAsync(c => c.Id == id, cancellationToken);
        if (entity is null) return (null, "المحكمة غير موجودة");

        var name = request.Name?.Trim() ?? entity.Name;
        var region = request.Region?.Trim() ?? entity.Region;
        var city = request.City?.Trim() ?? entity.City;
        if (name.Length is < 2 or > 150) return (null, "اسم المحكمة مطلوب");
        if (string.IsNullOrWhiteSpace(region)) return (null, "المنطقة غير صحيحة");
        if (string.IsNullOrWhiteSpace(city)) return (null, "المدينة غير صحيحة");

        var clash = await _db.Courts.AnyAsync(
            c => c.Id != id && c.Name == name && c.City == city,
            cancellationToken);
        if (clash) return (null, "توجد محكمة بنفس الاسم في هذه المدينة");

        var beforeName = entity.Name;
        var beforeRegion = entity.Region;
        var beforeCity = entity.City;
        var beforeActive = entity.IsActive;

        entity.Name = name;
        entity.Region = region;
        entity.City = city;
        if (request.IsActive.HasValue) entity.IsActive = request.IsActive.Value;
        entity.UpdatedBy = actorId;
        entity.UpdatedAtUtc = DateTime.UtcNow;

        var changes = new Dictionary<string, object?>();
        if (!string.Equals(beforeName, entity.Name, StringComparison.Ordinal))
            changes["name"] = Diff(beforeName, entity.Name);
        if (!string.Equals(beforeRegion, entity.Region, StringComparison.Ordinal))
            changes["region"] = Diff(beforeRegion, entity.Region);
        if (!string.Equals(beforeCity, entity.City, StringComparison.Ordinal))
            changes["city"] = Diff(beforeCity, entity.City);
        if (beforeActive != entity.IsActive)
            changes["isActive"] = Diff(beforeActive, entity.IsActive);

        if (changes.Count > 0)
        {
            AddAudit(
                CourtAuditActions.CourtUpdated,
                CourtAuditEntityTypes.Court,
                entity.Id,
                actorId,
                changes);
        }

        await _db.SaveChangesAsync(cancellationToken);
        await _cache.RemoveAsync(CacheKeys.CourtsCatalog, cancellationToken);
        return (ToDto(entity, entity.Circuits.Count), null);
    }

    public async Task<(CourtDto? Court, string? Error)> SetCourtStatusAsync(
        Guid id,
        bool isActive,
        string actorId,
        CancellationToken cancellationToken = default)
    {
        var entity = await _db.Courts.Include(c => c.Circuits).FirstOrDefaultAsync(c => c.Id == id, cancellationToken);
        if (entity is null) return (null, "المحكمة غير موجودة");
        if (entity.IsActive == isActive)
            return (ToDto(entity, entity.Circuits.Count), null);

        var before = entity.IsActive;
        entity.IsActive = isActive;
        entity.UpdatedBy = actorId;
        entity.UpdatedAtUtc = DateTime.UtcNow;
        AddAudit(
            isActive ? CourtAuditActions.CourtActivated : CourtAuditActions.CourtDeactivated,
            CourtAuditEntityTypes.Court,
            entity.Id,
            actorId,
            new Dictionary<string, object?> { ["isActive"] = Diff(before, isActive) });
        await _db.SaveChangesAsync(cancellationToken);
        await _cache.RemoveAsync(CacheKeys.CourtsCatalog, cancellationToken);
        return (ToDto(entity, entity.Circuits.Count), null);
    }

    public async Task<(CourtCircuitDto? Circuit, string? Error)> CreateCircuitAsync(
        Guid courtId,
        CreateCourtCircuitRequest request,
        string actorId,
        CancellationToken cancellationToken = default)
    {
        var court = await _db.Courts.FirstOrDefaultAsync(c => c.Id == courtId, cancellationToken);
        if (court is null) return (null, "المحكمة غير موجودة");
        var circuitNo = request.CircuitNo.Trim();
        if (circuitNo.Length is < 1 or > 50) return (null, "رقم الدائرة مطلوب");

        var exists = await _db.CourtCircuits.AnyAsync(
            c => c.CourtId == courtId && c.CircuitNo == circuitNo,
            cancellationToken);
        if (exists) return (null, "الدائرة مكرّرة في هذه المحكمة");

        var entity = new CourtCircuit
        {
            Id = Guid.NewGuid(),
            CourtId = courtId,
            CircuitNo = circuitNo,
            CircuitName = string.IsNullOrWhiteSpace(request.CircuitName) ? null : request.CircuitName.Trim(),
            IsActive = request.IsActive,
            CreatedBy = actorId,
            CreatedAtUtc = DateTime.UtcNow,
        };
        _db.CourtCircuits.Add(entity);
        AddAudit(
            CourtAuditActions.CircuitCreated,
            CourtAuditEntityTypes.Circuit,
            entity.Id,
            actorId,
            new Dictionary<string, object?>
            {
                ["courtId"] = Diff(null, entity.CourtId),
                ["circuitNo"] = Diff(null, entity.CircuitNo),
                ["circuitName"] = Diff(null, entity.CircuitName),
                ["isActive"] = Diff(null, entity.IsActive),
            });
        await _db.SaveChangesAsync(cancellationToken);
        await _cache.RemoveAsync(CacheKeys.CourtsCatalog, cancellationToken);
        return (ToCircuitDto(entity), null);
    }

    public async Task<(CourtCircuitDto? Circuit, string? Error)> UpdateCircuitAsync(
        Guid courtId,
        Guid circuitId,
        UpdateCourtCircuitRequest request,
        string actorId,
        CancellationToken cancellationToken = default)
    {
        var entity = await _db.CourtCircuits.FirstOrDefaultAsync(
            c => c.Id == circuitId && c.CourtId == courtId,
            cancellationToken);
        if (entity is null) return (null, "الدائرة غير موجودة");

        var circuitNo = request.CircuitNo?.Trim() ?? entity.CircuitNo;
        if (circuitNo.Length is < 1 or > 50) return (null, "رقم الدائرة مطلوب");
        var clash = await _db.CourtCircuits.AnyAsync(
            c => c.CourtId == courtId && c.Id != circuitId && c.CircuitNo == circuitNo,
            cancellationToken);
        if (clash) return (null, "الدائرة مكرّرة في هذه المحكمة");

        var beforeNo = entity.CircuitNo;
        var beforeName = entity.CircuitName;
        var beforeActive = entity.IsActive;

        entity.CircuitNo = circuitNo;
        if (request.CircuitName is not null)
            entity.CircuitName = string.IsNullOrWhiteSpace(request.CircuitName)
                ? null
                : request.CircuitName.Trim();
        if (request.IsActive.HasValue) entity.IsActive = request.IsActive.Value;
        entity.UpdatedBy = actorId;
        entity.UpdatedAtUtc = DateTime.UtcNow;

        var changes = new Dictionary<string, object?>();
        if (!string.Equals(beforeNo, entity.CircuitNo, StringComparison.Ordinal))
            changes["circuitNo"] = Diff(beforeNo, entity.CircuitNo);
        if (!string.Equals(beforeName, entity.CircuitName, StringComparison.Ordinal))
            changes["circuitName"] = Diff(beforeName, entity.CircuitName);
        if (beforeActive != entity.IsActive)
            changes["isActive"] = Diff(beforeActive, entity.IsActive);

        if (changes.Count > 0)
        {
            AddAudit(
                CourtAuditActions.CircuitUpdated,
                CourtAuditEntityTypes.Circuit,
                entity.Id,
                actorId,
                changes);
        }

        await _db.SaveChangesAsync(cancellationToken);
        await _cache.RemoveAsync(CacheKeys.CourtsCatalog, cancellationToken);
        return (ToCircuitDto(entity), null);
    }

    public async Task<(CourtCircuitDto? Circuit, string? Error)> SetCircuitStatusAsync(
        Guid courtId,
        Guid circuitId,
        bool isActive,
        string actorId,
        CancellationToken cancellationToken = default)
    {
        var entity = await _db.CourtCircuits.FirstOrDefaultAsync(
            c => c.Id == circuitId && c.CourtId == courtId,
            cancellationToken);
        if (entity is null) return (null, "الدائرة غير موجودة");
        if (entity.IsActive == isActive)
            return (ToCircuitDto(entity), null);

        var before = entity.IsActive;
        entity.IsActive = isActive;
        entity.UpdatedBy = actorId;
        entity.UpdatedAtUtc = DateTime.UtcNow;
        AddAudit(
            isActive ? CourtAuditActions.CircuitActivated : CourtAuditActions.CircuitDeactivated,
            CourtAuditEntityTypes.Circuit,
            entity.Id,
            actorId,
            new Dictionary<string, object?> { ["isActive"] = Diff(before, isActive) });
        await _db.SaveChangesAsync(cancellationToken);
        await _cache.RemoveAsync(CacheKeys.CourtsCatalog, cancellationToken);
        return (ToCircuitDto(entity), null);
    }

    public async Task<IReadOnlyList<SelectableCourtDto>> ListSelectableAsync(
        string? region,
        string? city,
        CancellationToken cancellationToken = default)
    {
        await EnsureSeededAsync(cancellationToken);
        var q = _db.Courts.AsNoTracking().Where(c => c.IsActive);
        if (!string.IsNullOrWhiteSpace(region))
            q = q.Where(c => c.Region == region.Trim());
        if (!string.IsNullOrWhiteSpace(city))
            q = q.Where(c => c.City == city.Trim());
        return await q
            .OrderBy(c => c.City)
            .ThenBy(c => c.Name)
            .Select(c => new SelectableCourtDto
            {
                Id = c.Id,
                Name = c.Name,
                Region = c.Region,
                City = c.City,
            })
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<SelectableCircuitDto>> ListSelectableCircuitsAsync(
        Guid courtId,
        CancellationToken cancellationToken = default)
    {
        await EnsureSeededAsync(cancellationToken);
        var courtActive = await _db.Courts.AsNoTracking()
            .AnyAsync(c => c.Id == courtId && c.IsActive, cancellationToken);
        if (!courtActive) return [];

        return await _db.CourtCircuits.AsNoTracking()
            .Where(c => c.CourtId == courtId && c.IsActive)
            .OrderBy(c => c.CircuitNo)
            .Select(c => new SelectableCircuitDto
            {
                Id = c.Id,
                CourtId = c.CourtId,
                CircuitNo = c.CircuitNo,
                CircuitName = c.CircuitName,
            })
            .ToListAsync(cancellationToken);
    }

    private static List<string> ParseCircuits(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<List<string>>(json) ?? [];
        }
        catch
        {
            return [];
        }
    }

    private static CourtDto ToDto(Court c, int circuitsCount) => new()
    {
        Id = c.Id,
        Name = c.Name,
        Region = c.Region,
        City = c.City,
        IsActive = c.IsActive,
        CircuitsCount = circuitsCount,
        CreatedBy = c.CreatedBy,
        CreatedAtUtc = c.CreatedAtUtc.ToString("o"),
        UpdatedBy = c.UpdatedBy,
        UpdatedAtUtc = c.UpdatedAtUtc?.ToString("o"),
    };

    private static CourtDetailDto ToDetail(Court c) => new()
    {
        Id = c.Id,
        Name = c.Name,
        Region = c.Region,
        City = c.City,
        IsActive = c.IsActive,
        CircuitsCount = c.Circuits.Count,
        CreatedBy = c.CreatedBy,
        CreatedAtUtc = c.CreatedAtUtc.ToString("o"),
        UpdatedBy = c.UpdatedBy,
        UpdatedAtUtc = c.UpdatedAtUtc?.ToString("o"),
        Circuits = c.Circuits
            .OrderBy(x => x.CircuitNo)
            .Select(ToCircuitDto)
            .ToList(),
    };

    private static CourtCircuitDto ToCircuitDto(CourtCircuit c) => new()
    {
        Id = c.Id,
        CourtId = c.CourtId,
        CircuitNo = c.CircuitNo,
        CircuitName = c.CircuitName,
        IsActive = c.IsActive,
        CreatedBy = c.CreatedBy,
        CreatedAtUtc = c.CreatedAtUtc.ToString("o"),
        UpdatedBy = c.UpdatedBy,
        UpdatedAtUtc = c.UpdatedAtUtc?.ToString("o"),
    };

    private void AddAudit(
        string action,
        string entityType,
        Guid entityId,
        string actorId,
        Dictionary<string, object?> changes)
    {
        _db.CourtAuditLogs.Add(new CourtAuditLog
        {
            Id = Guid.NewGuid(),
            Action = action,
            EntityType = entityType,
            EntityId = entityId,
            ActorId = actorId,
            ChangesJson = JsonSerializer.Serialize(changes, AuditJsonOpts),
            TimestampUtc = DateTime.UtcNow,
        });
    }

    private static object Diff(object? before, object? after) =>
        new { before, after };
}

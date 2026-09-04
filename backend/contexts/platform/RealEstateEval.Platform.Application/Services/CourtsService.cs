using System.Text.Json;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Domain;
using RealEstateEval.Platform.Application.Abstractions;
using RealEstateEval.Platform.Application.Contracts;
using RealEstateEval.Platform.Domain;

namespace RealEstateEval.Platform.Application.Services;

/// <summary>
/// Courts and circuits catalog use case: execution-court seeding, admin CRUD with audit rows,
/// and the selectable lists. Persistence goes through <see cref="ICourtsRepository"/>, so this
/// file holds rules only - no EF (solid-scorecard finding 1).
/// </summary>
public sealed class CourtsService : ICourtsService
{
    private static readonly (string Region, string City, string Name)[] ExecutionCourtSeeds =
    [
        ("الرياض", "الرياض", "محكمة التنفيذ بالرياض"),
        ("مكة المكرمة", "مكة المكرمة", "محكمة التنفيذ بمكة المكرمة"),
        ("مكة المكرمة", "جدة", "محكمة التنفيذ بجدة"),
        ("مكة المكرمة", "الطائف", "محكمة التنفيذ بالطائف"),
        ("المدينة المنورة", "المدينة المنورة", "محكمة التنفيذ بالمدينة المنورة"),
        ("الشرقية", "الدمام", "محكمة التنفيذ بالدمام"),
        ("الشرقية", "الخبر", "محكمة التنفيذ بالخبر"),
        ("الشرقية", "الأحساء", "محكمة التنفيذ بالأحساء"),
        ("القصيم", "بريدة", "محكمة التنفيذ ببريدة"),
        ("عسير", "أبها", "محكمة التنفيذ بأبها"),
        ("تبوك", "تبوك", "محكمة التنفيذ بتبوك"),
        ("حائل", "حائل", "محكمة التنفيذ بحائل"),
        ("جازان", "جازان", "محكمة التنفيذ بجازان"),
        ("الجوف", "سكاكا", "محكمة التنفيذ بسكاكا"),
    ];

    private static readonly string[] ExecutionCircuitNames =
    [
        "دائرة التنفيذ الأولى",
        "دائرة التنفيذ الثانية",
        "دائرة التنفيذ الثالثة",
        "دائرة التنفيذ الرابعة",
        "دائرة التنفيذ الخامسة",
        "دائرة التنفيذ السادسة",
        "دائرة التنفيذ السابعة",
        "دائرة التنفيذ الثامنة",
        "دائرة التنفيذ التاسعة",
        "دائرة التنفيذ العاشرة",
        "دائرة التنفيذ الحادية عشرة",
        "دائرة التنفيذ الثانية عشرة",
        "دائرة التنفيذ الثالثة عشرة",
        "دائرة التنفيذ الرابعة عشرة",
        "دائرة التنفيذ الخامسة عشرة",
        "دائرة التنفيذ السادسة عشرة",
        "دائرة التنفيذ السابعة عشرة",
        "دائرة التنفيذ الثامنة عشرة",
        "دائرة التنفيذ التاسعة عشرة",
        "دائرة التنفيذ العشرون",
        "دائرة التنفيذ الواحدة والعشرون",
        "دائرة التنفيذ الثانية والعشرون",
        "دائرة التنفيذ الثالثة والعشرون",
        "دائرة التنفيذ الرابعة والعشرون",
        "دائرة التنفيذ الخامسة والعشرون",
        "دائرة التنفيذ السادسة والعشرون",
        "دائرة التنفيذ السابعة والعشرون",
        "دائرة التنفيذ الثامنة والعشرون",
        "دائرة التنفيذ التاسعة والعشرون",
        "دائرة التنفيذ الثلاثون",
        "دائرة التنفيذ الواحدة والثلاثون",
        "دائرة التنفيذ الثانية والثلاثون",
        "دائرة التنفيذ الثالثة والثلاثون",
        "دائرة التنفيذ الرابعة والثلاثون",
        "دائرة التنفيذ الخامسة والثلاثون",
    ];

    private readonly ICourtsRepository _repo;
    private readonly IResponseCache _cache;
    private readonly IAuditLogWriter _audit;
    private readonly TimeProvider _time;

    public CourtsService(
        ICourtsRepository repo,
        IResponseCache cache,
        IAuditLogWriter audit,
        TimeProvider? time = null)
    {
        _time = time ?? TimeProvider.System;

        _repo = repo;
        _cache = cache;
        _audit = audit;
    }

    public async Task EnsureSeededAsync(CancellationToken cancellationToken = default)
    {
        if (!await _repo.AnyCourtsAsync(cancellationToken))
        {
            var legacy = await _repo.ListLegacyCatalogAsync(cancellationToken);
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
                    CreatedAtUtc = _time.UtcNow(),
                };
                await _repo.AddCourtAsync(court, cancellationToken);
                var circuits = ParseCircuits(row.CircuitsJson);
                foreach (var circuitNo in circuits)
                {
                    await _repo.AddCircuitAsync(
                        new CourtCircuit
                        {
                            Id = Guid.NewGuid(),
                            CourtId = court.Id,
                            CircuitNo = circuitNo.Trim(),
                            IsActive = true,
                            CreatedBy = "system",
                            CreatedAtUtc = _time.UtcNow(),
                        },
                        cancellationToken);
                }
            }

            if (legacy.Count > 0)
            {
                await _repo.SaveChangesAsync(cancellationToken);
            }
        }

        var courts = (await _repo.ListCourtsWithCircuitsAsync(cancellationToken)).ToList();
        var now = _time.UtcNow();

        foreach (var seed in ExecutionCourtSeeds)
        {
            var court = courts.FirstOrDefault(c =>
                c.Name == seed.Name && c.City == seed.City);
            if (court is null)
            {
                court = new Court
                {
                    Id = Guid.NewGuid(),
                    Name = seed.Name,
                    Region = seed.Region,
                    City = seed.City,
                    IsActive = true,
                    CreatedBy = "system",
                    CreatedAtUtc = now,
                };
                courts.Add(court);
                await _repo.AddCourtAsync(court, cancellationToken);
            }

            for (var index = 0; index < ExecutionCircuitNames.Length; index++)
            {
                var circuitNo = (index + 1).ToString();
                var circuitName = ExecutionCircuitNames[index];
                var legacyName = circuitName.Replace("دائرة التنفيذ ", "الدائرة ");
                var circuit = court.Circuits.FirstOrDefault(c => c.CircuitNo == circuitNo);

                if (circuit is null)
                {
                    circuit = court.Circuits.FirstOrDefault(c =>
                        c.CreatedBy == "system" &&
                        (c.CircuitNo == legacyName || c.CircuitName == circuitName));
                }

                if (circuit is not null)
                {
                    if (circuit.CreatedBy == "system")
                    {
                        circuit.CircuitNo = circuitNo;
                        circuit.CircuitName = circuitName;
                    }
                    continue;
                }

                var newCircuit = new CourtCircuit
                {
                    Id = Guid.NewGuid(),
                    CourtId = court.Id,
                    CircuitNo = circuitNo,
                    CircuitName = circuitName,
                    IsActive = true,
                    CreatedBy = "system",
                    CreatedAtUtc = now,
                };
                court.Circuits.Add(newCircuit);
                await _repo.AddCircuitAsync(newCircuit, cancellationToken);
            }
        }

        if (_repo.HasPendingChanges())
        {
            await _repo.SaveChangesAsync(cancellationToken);
            await _cache.RemoveAsync(CacheKeys.CourtsCatalog, cancellationToken);
        }
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

        var filter = new CourtAdminFilter(search, status, region, city);
        var total = await _repo.CountAdminAsync(filter, cancellationToken);
        var page1 = await _repo.ListAdminPageAsync(
            filter, (page - 1) * limit, limit, cancellationToken);
        var rows = page1.Select(r => ToDto(r.Court, r.CircuitsCount)).ToList();

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
        var court = await _repo.GetCourtWithCircuitsAsync(id, cancellationToken);
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

        var exists = await _repo.CourtNameTakenAsync(name, city, null, cancellationToken);
        if (exists) return (null, "توجد محكمة بنفس الاسم في هذه المدينة");

        var entity = new Court
        {
            Id = Guid.NewGuid(),
            Name = name,
            Region = region,
            City = city,
            IsActive = request.IsActive,
            CreatedBy = actorId,
            CreatedAtUtc = _time.UtcNow(),
        };
        await _repo.AddCourtAsync(entity, cancellationToken);
        await AddAuditAsync(
            CourtAuditActions.CourtCreated,
            CourtAuditEntityTypes.Court,
            entity.Id,
            actorId,
            new Dictionary<string, AuditValueChange>
            {
                ["name"] = Diff(null, entity.Name),
                ["region"] = Diff(null, entity.Region),
                ["city"] = Diff(null, entity.City),
                ["isActive"] = Diff(null, entity.IsActive),
            },
            cancellationToken);
        await _repo.SaveChangesAsync(cancellationToken);
        await _cache.RemoveAsync(CacheKeys.CourtsCatalog, cancellationToken);
        return (ToDto(entity, 0), null);
    }

    public async Task<(CourtDto? Court, string? Error)> UpdateAsync(
        Guid id,
        UpdateCourtRequest request,
        string actorId,
        CancellationToken cancellationToken = default)
    {
        var entity = await _repo.FindCourtWithCircuitsAsync(id, cancellationToken);
        if (entity is null) return (null, "المحكمة غير موجودة");

        var name = request.Name?.Trim() ?? entity.Name;
        var region = request.Region?.Trim() ?? entity.Region;
        var city = request.City?.Trim() ?? entity.City;
        if (name.Length is < 2 or > 150) return (null, "اسم المحكمة مطلوب");
        if (string.IsNullOrWhiteSpace(region)) return (null, "المنطقة غير صحيحة");
        if (string.IsNullOrWhiteSpace(city)) return (null, "المدينة غير صحيحة");

        var clash = await _repo.CourtNameTakenAsync(name, city, id, cancellationToken);
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
        entity.UpdatedAtUtc = _time.UtcNow();

        var changes = new Dictionary<string, AuditValueChange>();
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
            await AddAuditAsync(
                CourtAuditActions.CourtUpdated,
                CourtAuditEntityTypes.Court,
                entity.Id,
                actorId,
                changes,
                cancellationToken);
        }

        await _repo.SaveChangesAsync(cancellationToken);
        await _cache.RemoveAsync(CacheKeys.CourtsCatalog, cancellationToken);
        return (ToDto(entity, entity.Circuits.Count), null);
    }

    public async Task<(CourtDto? Court, string? Error)> SetCourtStatusAsync(
        Guid id,
        bool isActive,
        string actorId,
        CancellationToken cancellationToken = default)
    {
        var entity = await _repo.FindCourtWithCircuitsAsync(id, cancellationToken);
        if (entity is null) return (null, "المحكمة غير موجودة");
        if (entity.IsActive == isActive)
            return (ToDto(entity, entity.Circuits.Count), null);

        var before = entity.IsActive;
        entity.IsActive = isActive;
        entity.UpdatedBy = actorId;
        entity.UpdatedAtUtc = _time.UtcNow();
        await AddAuditAsync(
            isActive ? CourtAuditActions.CourtActivated : CourtAuditActions.CourtDeactivated,
            CourtAuditEntityTypes.Court,
            entity.Id,
            actorId,
            new Dictionary<string, AuditValueChange> { ["isActive"] = Diff(before, isActive) },
            cancellationToken);
        await _repo.SaveChangesAsync(cancellationToken);
        await _cache.RemoveAsync(CacheKeys.CourtsCatalog, cancellationToken);
        return (ToDto(entity, entity.Circuits.Count), null);
    }

    public async Task<(CourtCircuitDto? Circuit, string? Error)> CreateCircuitAsync(
        Guid courtId,
        CreateCourtCircuitRequest request,
        string actorId,
        CancellationToken cancellationToken = default)
    {
        var court = await _repo.FindCourtAsync(courtId, cancellationToken);
        if (court is null) return (null, "المحكمة غير موجودة");
        var circuitNo = request.CircuitNo.Trim();
        if (circuitNo.Length is < 1 or > 50) return (null, "رقم الدائرة مطلوب");

        var exists = await _repo.CircuitNoTakenAsync(courtId, circuitNo, null, cancellationToken);
        if (exists) return (null, "الدائرة مكرّرة في هذه المحكمة");

        var entity = new CourtCircuit
        {
            Id = Guid.NewGuid(),
            CourtId = courtId,
            CircuitNo = circuitNo,
            CircuitName = string.IsNullOrWhiteSpace(request.CircuitName) ? null : request.CircuitName.Trim(),
            IsActive = request.IsActive,
            CreatedBy = actorId,
            CreatedAtUtc = _time.UtcNow(),
        };
        await _repo.AddCircuitAsync(entity, cancellationToken);
        await AddAuditAsync(
            CourtAuditActions.CircuitCreated,
            CourtAuditEntityTypes.Circuit,
            entity.Id,
            actorId,
            new Dictionary<string, AuditValueChange>
            {
                ["courtId"] = Diff(null, entity.CourtId),
                ["circuitNo"] = Diff(null, entity.CircuitNo),
                ["circuitName"] = Diff(null, entity.CircuitName),
                ["isActive"] = Diff(null, entity.IsActive),
            },
            cancellationToken);
        await _repo.SaveChangesAsync(cancellationToken);
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
        var entity = await _repo.FindCircuitAsync(courtId, circuitId, cancellationToken);
        if (entity is null) return (null, "الدائرة غير موجودة");

        var circuitNo = request.CircuitNo?.Trim() ?? entity.CircuitNo;
        if (circuitNo.Length is < 1 or > 50) return (null, "رقم الدائرة مطلوب");
        var clash = await _repo.CircuitNoTakenAsync(
            courtId, circuitNo, circuitId, cancellationToken);
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
        entity.UpdatedAtUtc = _time.UtcNow();

        var changes = new Dictionary<string, AuditValueChange>();
        if (!string.Equals(beforeNo, entity.CircuitNo, StringComparison.Ordinal))
            changes["circuitNo"] = Diff(beforeNo, entity.CircuitNo);
        if (!string.Equals(beforeName, entity.CircuitName, StringComparison.Ordinal))
            changes["circuitName"] = Diff(beforeName, entity.CircuitName);
        if (beforeActive != entity.IsActive)
            changes["isActive"] = Diff(beforeActive, entity.IsActive);

        if (changes.Count > 0)
        {
            await AddAuditAsync(
                CourtAuditActions.CircuitUpdated,
                CourtAuditEntityTypes.Circuit,
                entity.Id,
                actorId,
                changes,
                cancellationToken);
        }

        await _repo.SaveChangesAsync(cancellationToken);
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
        var entity = await _repo.FindCircuitAsync(courtId, circuitId, cancellationToken);
        if (entity is null) return (null, "الدائرة غير موجودة");
        if (entity.IsActive == isActive)
            return (ToCircuitDto(entity), null);

        var before = entity.IsActive;
        entity.IsActive = isActive;
        entity.UpdatedBy = actorId;
        entity.UpdatedAtUtc = _time.UtcNow();
        await AddAuditAsync(
            isActive ? CourtAuditActions.CircuitActivated : CourtAuditActions.CircuitDeactivated,
            CourtAuditEntityTypes.Circuit,
            entity.Id,
            actorId,
            new Dictionary<string, AuditValueChange> { ["isActive"] = Diff(before, isActive) },
            cancellationToken);
        await _repo.SaveChangesAsync(cancellationToken);
        await _cache.RemoveAsync(CacheKeys.CourtsCatalog, cancellationToken);
        return (ToCircuitDto(entity), null);
    }

    public async Task<IReadOnlyList<SelectableCourtDto>> ListSelectableAsync(
        string? region,
        string? city,
        CancellationToken cancellationToken = default)
    {
        await EnsureSeededAsync(cancellationToken);
        var courts = await _repo.ListActiveCourtsAsync(region, city, cancellationToken);
        return courts
            .Select(c => new SelectableCourtDto
            {
                Id = c.Id,
                Name = c.Name,
                Region = c.Region,
                City = c.City,
            })
            .ToList();
    }

    public async Task<IReadOnlyList<SelectableCircuitDto>> ListSelectableCircuitsAsync(
        Guid courtId,
        CancellationToken cancellationToken = default)
    {
        await EnsureSeededAsync(cancellationToken);
        var courtActive = await _repo.IsCourtActiveAsync(courtId, cancellationToken);
        if (!courtActive) return [];

        var circuits = await _repo.ListActiveCircuitsAsync(courtId, cancellationToken);
        return circuits
            .Select(c => new SelectableCircuitDto
            {
                Id = c.Id,
                CourtId = c.CourtId,
                CircuitNo = c.CircuitNo,
                CircuitName = c.CircuitName,
            })
            .ToList();
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

    private Task AddAuditAsync(
        string action,
        string entityType,
        Guid entityId,
        string actorId,
        IReadOnlyDictionary<string, AuditValueChange> changes,
        CancellationToken cancellationToken) =>
        _repo.AppendAuditAsync(
            _audit.CreateFromChanges(
                actorId,
                action,
                entityType,
                entityId.ToString(),
                changes),
            cancellationToken);

    private static AuditValueChange Diff(object? before, object? after) =>
        new(before, after);
}

using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Domain;
using RealEstateEval.Platform.Application.Abstractions;
using RealEstateEval.Platform.Application.Contracts;
using RealEstateEval.Platform.Application.Rules;
using RealEstateEval.Platform.Domain;

namespace RealEstateEval.Platform.Application.Services;

/// <summary>
/// Courts and circuits catalog use case: execution-court seeding, admin CRUD with audit rows,
/// and the selectable lists. Persistence goes through <see cref="ICourtsRepository"/>, so this
/// file holds rules only - no EF (solid-scorecard finding 1). Seeding lives in
/// <c>CourtsService.Seeding.cs</c>, the DTO projections in <c>CourtsService.Mapping.cs</c>,
/// and the pure validation / audit diff shaping in <see cref="CourtCatalogRules"/>.
/// </summary>
public sealed partial class CourtsService : ICourtsService
{
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
        var invalid = CourtCatalogRules.ValidateCourt(name, region, city);
        if (invalid is not null) return (null, invalid);

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
            CourtCatalogRules.CourtCreated(entity),
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
        var invalid = CourtCatalogRules.ValidateCourt(name, region, city);
        if (invalid is not null) return (null, invalid);

        var clash = await _repo.CourtNameTakenAsync(name, city, id, cancellationToken);
        if (clash) return (null, "توجد محكمة بنفس الاسم في هذه المدينة");

        var before = (entity.Name, entity.Region, entity.City, entity.IsActive);

        entity.Name = name;
        entity.Region = region;
        entity.City = city;
        if (request.IsActive.HasValue) entity.IsActive = request.IsActive.Value;
        entity.UpdatedBy = actorId;
        entity.UpdatedAtUtc = _time.UtcNow();

        var changes = CourtCatalogRules.CourtUpdated(before, entity);

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
            CourtCatalogRules.StatusChanged(before, isActive),
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
        var invalid = CourtCatalogRules.ValidateCircuitNo(circuitNo);
        if (invalid is not null) return (null, invalid);

        var exists = await _repo.CircuitNoTakenAsync(courtId, circuitNo, null, cancellationToken);
        if (exists) return (null, "الدائرة مكرّرة في هذه المحكمة");

        var entity = new CourtCircuit
        {
            Id = Guid.NewGuid(),
            CourtId = courtId,
            CircuitNo = circuitNo,
            CircuitName = CourtCatalogRules.NormalizeCircuitName(request.CircuitName),
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
            CourtCatalogRules.CircuitCreated(entity),
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
        var invalid = CourtCatalogRules.ValidateCircuitNo(circuitNo);
        if (invalid is not null) return (null, invalid);
        var clash = await _repo.CircuitNoTakenAsync(
            courtId, circuitNo, circuitId, cancellationToken);
        if (clash) return (null, "الدائرة مكرّرة في هذه المحكمة");

        var before = (entity.CircuitNo, entity.CircuitName, entity.IsActive);

        entity.CircuitNo = circuitNo;
        if (request.CircuitName is not null)
            entity.CircuitName = CourtCatalogRules.NormalizeCircuitName(request.CircuitName);
        if (request.IsActive.HasValue) entity.IsActive = request.IsActive.Value;
        entity.UpdatedBy = actorId;
        entity.UpdatedAtUtc = _time.UtcNow();

        var changes = CourtCatalogRules.CircuitUpdated(before, entity);

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
            CourtCatalogRules.StatusChanged(before, isActive),
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
        return courts.Select(c => ToSelectable(c)).ToList();
    }

    public async Task<IReadOnlyList<SelectableCircuitDto>> ListSelectableCircuitsAsync(
        Guid courtId,
        CancellationToken cancellationToken = default)
    {
        await EnsureSeededAsync(cancellationToken);
        var courtActive = await _repo.IsCourtActiveAsync(courtId, cancellationToken);
        if (!courtActive) return [];

        var circuits = await _repo.ListActiveCircuitsAsync(courtId, cancellationToken);
        return circuits.Select(c => ToSelectable(c)).ToList();
    }

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
}

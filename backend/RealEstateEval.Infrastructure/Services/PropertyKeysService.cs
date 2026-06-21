using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Infrastructure.Services;

public sealed class PropertyKeysService : IPropertyKeysService
{
    private readonly ApplicationDbContext _db;

    public PropertyKeysService(ApplicationDbContext db) => _db = db;

    public async Task<IReadOnlyList<PropertyKeyRecordDto>> ListAsync(
        bool? hasKey,
        CancellationToken cancellationToken = default)
    {
        var query = _db.PropertyKeyRecords.AsNoTracking().AsQueryable();
        if (hasKey is true)
            query = query.Where(x => x.HasKey);
        else if (hasKey is false)
            query = query.Where(x => !x.HasKey);

        var rows = await query.OrderBy(x => x.PoNumber).ThenBy(x => x.PropertyId)
            .ToListAsync(cancellationToken);
        return rows.Select(ToDto).ToList();
    }

    public async Task<PropertyKeyRecordDto?> GetAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var row = await _db.PropertyKeyRecords.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        return row is null ? null : ToDto(row);
    }

    public async Task<PropertyKeyRecordDto?> PatchAsync(
        Guid id,
        UpdatePropertyKeyRequest request,
        CancellationToken cancellationToken = default)
    {
        var row = await _db.PropertyKeyRecords.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (row is null) return null;

        if (request.Key is not null) row.HasKey = request.Key.Value;
        if (!string.IsNullOrWhiteSpace(request.Status))
            row.WorkflowStatus = request.Status.Trim();
        row.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        return ToDto(row);
    }

    private static PropertyKeyRecordDto ToDto(Domain.PropertyKeyRecord row) => new()
    {
        Id = row.Id,
        IdProp = row.PropertyId,
        Po = row.PoNumber,
        Area = row.Area,
        Type = row.PropertyType,
        Key = row.HasKey,
        Specialist = row.Specialist,
        Status = row.WorkflowStatus,
    };
}

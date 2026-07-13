using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
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
        await SyncPropertyKeysFromGovernmentReviewAsync(cancellationToken);

        var query = _db.PropertyKeyRecords.AsNoTracking().AsQueryable();
        if (hasKey is true)
            query = query.Where(x => x.HasKey);
        else if (hasKey is false)
            query = query.Where(x => !x.HasKey);

        var rows = await query
            .OrderByDescending(x => x.UpdatedAtUtc)
            .ThenBy(x => x.PoNumber)
            .ThenBy(x => x.PropertyId)
            .ToListAsync(cancellationToken);

        var poNumbers = rows.Select(r => r.PoNumber.Trim()).Distinct().ToList();
        var properties = poNumbers.Count == 0
            ? []
            : await _db.WorkOrderProperties.AsNoTracking()
                .Include(p => p.WorkOrder)
                .Where(p => p.WorkOrder != null && poNumbers.Contains(p.WorkOrder!.PoNumber))
                .ToListAsync(cancellationToken);

        return rows.Select(row => ToDto(row, properties)).ToList();
    }

    public async Task<PropertyKeyRecordDto?> GetAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var row = await _db.PropertyKeyRecords.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        return row is null ? null : ToDto(row, []);
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
        return ToDto(row, []);
    }

    private static string ResolveDeedStatus(
        PropertyKeyRecord row,
        IReadOnlyList<WorkOrderProperty> properties)
    {
        var po = row.PoNumber.Trim();
        var key = row.PropertyId.Trim();
        var match = properties.FirstOrDefault(p =>
            p.WorkOrder?.PoNumber.Trim().Equals(po, StringComparison.OrdinalIgnoreCase) == true &&
            (string.Equals(p.DeedNumber?.Trim(), key, StringComparison.OrdinalIgnoreCase) ||
             string.Equals(p.Id.ToString(), key, StringComparison.OrdinalIgnoreCase)));
        var status = match?.DeedStatus?.Trim();
        return string.IsNullOrWhiteSpace(status) ? "—" : status;
    }

    private static PropertyKeyRecordDto ToDto(
        PropertyKeyRecord row,
        IReadOnlyList<WorkOrderProperty> properties) => new()
    {
        Id = row.Id,
        IdProp = row.PropertyId,
        Po = row.PoNumber,
        Area = row.Area,
        Type = row.PropertyType,
        Key = row.HasKey,
        Specialist = row.Specialist,
        Status = row.WorkflowStatus,
        DeedStatus = ResolveDeedStatus(row, properties),
    };

    private async Task SyncPropertyKeysFromGovernmentReviewAsync(CancellationToken cancellationToken)
    {
        var govTasks = await _db.WorkflowTasks.AsNoTracking()
            .Where(t => t.Kind == "government-review" && t.PropertyId != null)
            .ToListAsync(cancellationToken);

        var existingRows = await _db.PropertyKeyRecords.ToListAsync(cancellationToken);

        if (govTasks.Count == 0)
        {
            if (existingRows.Count > 0)
            {
                _db.PropertyKeyRecords.RemoveRange(existingRows);
                await _db.SaveChangesAsync(cancellationToken);
            }

            return;
        }

        var taskIds = govTasks.Select(t => t.Id).ToList();
        var submissions = await _db.PartyTaskSubmissions.AsNoTracking()
            .Where(s => s.Kind == "government-review" && taskIds.Contains(s.WorkflowTaskId))
            .ToListAsync(cancellationToken);

        var poNumbers = govTasks.Select(t => t.PoNumber.Trim()).Distinct().ToList();
        var properties = await _db.WorkOrderProperties.AsNoTracking()
            .Include(p => p.WorkOrder)
            .Where(p => p.WorkOrder != null && poNumbers.Contains(p.WorkOrder!.PoNumber))
            .ToListAsync(cancellationToken);

        var propertyById = properties.ToDictionary(p => p.Id);
        var now = DateTime.UtcNow;
        var matchedRowIds = new HashSet<Guid>();

        foreach (var task in govTasks)
        {
            var submission = submissions.FirstOrDefault(s => s.WorkflowTaskId == task.Id);
            if (submission is null) continue;

            var keysStatus = ParseKeysStatus(submission.PayloadJson);
            if (keysStatus is not ("pending" or "received")) continue;

            var propertyId = task.PropertyId!.Value;
            propertyById.TryGetValue(propertyId, out var property);

            var po = task.PoNumber.Trim();
            var deedLabel = FormatDeedLabel(property, task.PropertyOrdinal);

            var existing = existingRows.FirstOrDefault(x =>
                x.PoNumber.Trim().Equals(po, StringComparison.OrdinalIgnoreCase) &&
                (string.Equals(x.PropertyId, deedLabel, StringComparison.OrdinalIgnoreCase) ||
                 string.Equals(x.PropertyId, propertyId.ToString(), StringComparison.OrdinalIgnoreCase)));

            var workflowStatus = ResolveWorkflowStatus(keysStatus, existing?.WorkflowStatus);

            if (existing is null)
            {
                var created = new PropertyKeyRecord
                {
                    Id = Guid.NewGuid(),
                    PropertyId = deedLabel,
                    PoNumber = po,
                    Area = property?.City?.Trim() ?? "",
                    PropertyType = property?.PropertyType?.Trim() ?? "",
                    HasKey = true,
                    Specialist = task.AssigneeName?.Trim() ?? "",
                    WorkflowStatus = workflowStatus,
                    UpdatedAtUtc = now,
                };
                _db.PropertyKeyRecords.Add(created);
                existingRows.Add(created);
                matchedRowIds.Add(created.Id);
            }
            else
            {
                existing.PropertyId = deedLabel;
                existing.Area = property?.City?.Trim() ?? existing.Area;
                existing.PropertyType = property?.PropertyType?.Trim() ?? existing.PropertyType;
                existing.HasKey = true;
                existing.Specialist = task.AssigneeName?.Trim() ?? existing.Specialist;
                if (!string.Equals(existing.WorkflowStatus, "done", StringComparison.OrdinalIgnoreCase))
                    existing.WorkflowStatus = workflowStatus;
                existing.UpdatedAtUtc = now;
                matchedRowIds.Add(existing.Id);
            }
        }

        foreach (var row in existingRows)
        {
            if (!matchedRowIds.Contains(row.Id))
                _db.PropertyKeyRecords.Remove(row);
        }

        await _db.SaveChangesAsync(cancellationToken);
    }

    private static string ResolveWorkflowStatus(string keysStatus, string? existingStatus)
    {
        if (string.Equals(existingStatus, "done", StringComparison.OrdinalIgnoreCase))
            return "done";
        return keysStatus == "received" ? "done" : "progress";
    }

    private static string? ParseKeysStatus(string payloadJson)
    {
        try
        {
            using var doc = JsonDocument.Parse(payloadJson);
            if (!doc.RootElement.TryGetProperty("keysStatus", out var prop)) return null;
            var value = prop.GetString()?.Trim();
            return string.IsNullOrWhiteSpace(value) ? null : value;
        }
        catch
        {
            return null;
        }
    }

    private static string FormatDeedLabel(WorkOrderProperty? property, int propertyOrdinal)
    {
        var deed = property?.DeedNumber?.Trim();
        if (!string.IsNullOrWhiteSpace(deed)) return deed;
        if (propertyOrdinal > 0) return propertyOrdinal.ToString("000");
        return property?.Id.ToString() ?? "—";
    }
}

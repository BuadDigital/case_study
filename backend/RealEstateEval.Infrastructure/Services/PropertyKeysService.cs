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
        await SyncFromEnvelopesAndLegacyAsync(cancellationToken);

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

        // Prefer envelope handoff confirmation when a linked envelope exists.
        if (!string.IsNullOrWhiteSpace(request.Status)
            && string.Equals(request.Status.Trim(), "done", StringComparison.OrdinalIgnoreCase))
        {
            var linked = await FindLinkedEnvelopeAsync(row, cancellationToken);
            if (linked is not null)
            {
                var pending = linked.Handoffs
                    .Where(h => h.Kind == KeyHandoffKinds.Internal
                        && h.Status == KeyHandoffStatuses.PendingConfirm)
                    .OrderByDescending(h => h.CreatedAtUtc)
                    .FirstOrDefault();
                if (pending is not null)
                {
                    pending.Status = KeyHandoffStatuses.Confirmed;
                    pending.ConfirmedAtUtc = DateTime.UtcNow;
                    pending.ConfirmedByName = "compat-patch";
                    linked.Status = KeyEnvelopeStatuses.Assessor;
                    linked.UpdatedAtUtc = DateTime.UtcNow;
                }
            }
        }

        if (request.Key is not null) row.HasKey = request.Key.Value;
        if (!string.IsNullOrWhiteSpace(request.Status))
            row.WorkflowStatus = request.Status.Trim();
        row.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        return ToDto(row, []);
    }

    private async Task<KeyEnvelope?> FindLinkedEnvelopeAsync(
        PropertyKeyRecord row,
        CancellationToken cancellationToken)
    {
        var po = row.PoNumber.Trim();
        var deed = row.PropertyId.Trim();
        var property = await _db.WorkOrderProperties.AsNoTracking()
            .Include(p => p.WorkOrder)
            .FirstOrDefaultAsync(
                p => !p.IsRemoved
                     && p.WorkOrder != null
                     && p.WorkOrder.PoNumber == po
                     && (p.DeedNumber == deed || p.Id.ToString() == deed),
                cancellationToken);
        var requestNumber = property?.RequestNumber?.Trim() ?? "";
        if (requestNumber.Length == 0) return null;

        return await _db.KeyEnvelopes
            .Include(e => e.Handoffs)
            .Where(e => e.RequestNumber == requestNumber)
            .OrderByDescending(e => e.CreatedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);
    }

    private async Task SyncFromEnvelopesAndLegacyAsync(CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var existingRows = await _db.PropertyKeyRecords.ToListAsync(cancellationToken);
        var matchedRowIds = new HashSet<Guid>();

        // 1) Project from envelopes + linked properties / assignments
        var envelopes = await _db.KeyEnvelopes.AsNoTracking()
            .Include(e => e.Assignments)
            .Include(e => e.Handoffs)
            .Where(e => e.ReceiveScenario != KeyReceiveScenarios.Missing
                        || e.Assignments.Count > 0)
            .ToListAsync(cancellationToken);

        var requestNumbers = envelopes
            .Select(e => e.RequestNumber)
            .Where(r => r.Length > 0)
            .Distinct()
            .ToList();

        var linkedProperties = requestNumbers.Count == 0
            ? []
            : await _db.WorkOrderProperties.AsNoTracking()
                .Include(p => p.WorkOrder)
                .Where(p =>
                    !p.IsRemoved
                    && p.RequestNumber != null
                    && requestNumbers.Contains(p.RequestNumber))
                .ToListAsync(cancellationToken);

        var enabledNoKey = await _db.PropertyCourtAccesses.AsNoTracking()
            .Where(a => a.StudyHoldStatus == PropertyCourtAccessStatuses.EnabledNoKey)
            .Select(a => a.PropertyId)
            .ToListAsync(cancellationToken);
        var enabledSet = enabledNoKey.ToHashSet();

        foreach (var envelope in envelopes)
        {
            if (envelope.ReceiveScenario == KeyReceiveScenarios.Missing
                && envelope.Assignments.Count == 0)
                continue;

            var props = linkedProperties
                .Where(p => p.RequestNumber == envelope.RequestNumber)
                .ToList();

            if (props.Count == 0 && envelope.Assignments.Count > 0)
            {
                foreach (var assignment in envelope.Assignments)
                {
                    UpsertProjectedRow(
                        existingRows,
                        matchedRowIds,
                        po: "",
                        deedLabel: assignment.DeedNumber,
                        area: "",
                        propertyType: "",
                        specialist: envelope.CreatedByName,
                        workflowStatus: DeriveStatus(envelope, assignment),
                        now);
                }
                continue;
            }

            foreach (var property in props)
            {
                if (enabledSet.Contains(property.Id)) continue;

                var assignment = envelope.Assignments.FirstOrDefault(a =>
                    a.PropertyId == property.Id
                    || string.Equals(
                        a.DeedNumber,
                        property.DeedNumber,
                        StringComparison.OrdinalIgnoreCase));

                var deedLabel = string.IsNullOrWhiteSpace(property.DeedNumber)
                    ? property.Id.ToString()
                    : property.DeedNumber.Trim();

                UpsertProjectedRow(
                    existingRows,
                    matchedRowIds,
                    po: property.WorkOrder?.PoNumber?.Trim() ?? "",
                    deedLabel: deedLabel,
                    area: property.City?.Trim() ?? "",
                    propertyType: property.PropertyType?.Trim() ?? "",
                    specialist: envelope.CreatedByName,
                    workflowStatus: DeriveStatus(envelope, assignment),
                    now);
            }
        }

        // 2) Legacy fallback from government-review submissions (properties not covered)
        await MergeLegacyGovReviewAsync(existingRows, matchedRowIds, now, cancellationToken);

        foreach (var row in existingRows.ToList())
        {
            if (!matchedRowIds.Contains(row.Id))
                _db.PropertyKeyRecords.Remove(row);
        }

        await _db.SaveChangesAsync(cancellationToken);
    }

    private async Task MergeLegacyGovReviewAsync(
        List<PropertyKeyRecord> existingRows,
        HashSet<Guid> matchedRowIds,
        DateTime now,
        CancellationToken cancellationToken)
    {
        var govTasks = await _db.WorkflowTasks.AsNoTracking()
            .Where(t => t.Kind == "government-review" && t.PropertyId != null)
            .ToListAsync(cancellationToken);
        if (govTasks.Count == 0) return;

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

            // Skip if already projected from an envelope for same PO+deed
            var already = existingRows.Any(x =>
                matchedRowIds.Contains(x.Id)
                && x.PoNumber.Trim().Equals(po, StringComparison.OrdinalIgnoreCase)
                && (string.Equals(x.PropertyId, deedLabel, StringComparison.OrdinalIgnoreCase)
                    || string.Equals(x.PropertyId, propertyId.ToString(), StringComparison.OrdinalIgnoreCase)));
            if (already) continue;

            var workflowStatus = keysStatus == "received" ? "done" : "progress";
            UpsertProjectedRow(
                existingRows,
                matchedRowIds,
                po,
                deedLabel,
                area: property?.City?.Trim() ?? "",
                propertyType: property?.PropertyType?.Trim() ?? "",
                specialist: task.AssigneeName?.Trim() ?? "",
                workflowStatus,
                now);
        }
    }

    private void UpsertProjectedRow(
        List<PropertyKeyRecord> existingRows,
        HashSet<Guid> matchedRowIds,
        string po,
        string deedLabel,
        string area,
        string propertyType,
        string specialist,
        string workflowStatus,
        DateTime now)
    {
        if (deedLabel.Length == 0) return;

        var existing = existingRows.FirstOrDefault(x =>
            (po.Length == 0 || x.PoNumber.Trim().Equals(po, StringComparison.OrdinalIgnoreCase))
            && string.Equals(x.PropertyId, deedLabel, StringComparison.OrdinalIgnoreCase));

        if (existing is null)
        {
            var created = new PropertyKeyRecord
            {
                Id = Guid.NewGuid(),
                PropertyId = deedLabel,
                PoNumber = po,
                Area = area,
                PropertyType = propertyType,
                HasKey = true,
                Specialist = specialist,
                WorkflowStatus = workflowStatus,
                UpdatedAtUtc = now,
            };
            _db.PropertyKeyRecords.Add(created);
            existingRows.Add(created);
            matchedRowIds.Add(created.Id);
            return;
        }

        existing.PropertyId = deedLabel;
        if (po.Length > 0) existing.PoNumber = po;
        existing.Area = area.Length > 0 ? area : existing.Area;
        existing.PropertyType = propertyType.Length > 0 ? propertyType : existing.PropertyType;
        existing.HasKey = true;
        existing.Specialist = specialist.Length > 0 ? specialist : existing.Specialist;
        if (!string.Equals(existing.WorkflowStatus, "done", StringComparison.OrdinalIgnoreCase)
            || string.Equals(workflowStatus, "done", StringComparison.OrdinalIgnoreCase))
            existing.WorkflowStatus = workflowStatus;
        existing.UpdatedAtUtc = now;
        matchedRowIds.Add(existing.Id);
    }

    private static string DeriveStatus(KeyEnvelope envelope, KeyEnvelopeAssignment? assignment)
    {
        if (assignment?.Status == KeyAssignmentStatuses.Matched) return "done";
        if (envelope.Handoffs.Any(h =>
                h.Kind == KeyHandoffKinds.Internal
                && h.Status is KeyHandoffStatuses.Confirmed or KeyHandoffStatuses.Completed))
            return "done";
        if (envelope.Status is KeyEnvelopeStatuses.Assessor or KeyEnvelopeStatuses.External)
            return "done";
        return "progress";
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

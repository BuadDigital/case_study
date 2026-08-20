using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Infrastructure.Services;

public sealed class PropertyKeysService : IPropertyKeysService
{
    private const int MaxListRows = 500;
    private readonly OperationsDbContext _ops;
    private readonly ICaseStudyLookup _caseStudy;
    private readonly TimeProvider _time;

    [ActivatorUtilitiesConstructor]
    public PropertyKeysService(OperationsDbContext ops, ICaseStudyLookup caseStudy,
        TimeProvider? time = null)
    {
        _time = time ?? TimeProvider.System;

        _ops = ops;
        _caseStudy = caseStudy;
    }

    public async Task<IReadOnlyList<PropertyKeyRecordDto>> ListAsync(
        bool? hasKey,
        CancellationToken cancellationToken = default)
    {
        await SyncFromEnvelopesAndLegacyAsync(cancellationToken);

        var query = _ops.PropertyKeyRecords.AsNoTracking().AsQueryable();
        if (hasKey is true)
            query = query.Where(x => x.HasKey);
        else if (hasKey is false)
            query = query.Where(x => !x.HasKey);

        var rows = await query
            .OrderByDescending(x => x.UpdatedAtUtc)
            .ThenBy(x => x.PoNumber)
            .ThenBy(x => x.PropertyId)
            .Take(MaxListRows)
            .ToListAsync(cancellationToken);

        var poNumbers = rows.Select(r => r.PoNumber.Trim()).Distinct().ToList();
        var properties = await _caseStudy.ListPropertiesByPoNumbersAsync(poNumbers, cancellationToken);

        return rows.Select(row => ToDto(row, properties)).ToList();
    }

    public async Task<PropertyKeyRecordDto?> GetAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var row = await _ops.PropertyKeyRecords.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        return row is null ? null : ToDto(row, []);
    }

    public async Task<PropertyKeyRecordDto?> PatchAsync(
        Guid id,
        UpdatePropertyKeyRequest request,
        CancellationToken cancellationToken = default)
    {
        var row = await _ops.PropertyKeyRecords.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (row is null) return null;

 // Prefer envelope handoff confirmation when a linked envelope exists.
        if (!string.IsNullOrWhiteSpace(request.Status)
            && PropertyKeyWorkflowStatuses.IsDone(request.Status.Trim()))
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
                    pending.ConfirmedAtUtc = _time.UtcNow();
                    pending.ConfirmedByName = "compat-patch";
                    linked.Status = KeyEnvelopeStatuses.Assessor;
                    linked.UpdatedAtUtc = _time.UtcNow();
                }
            }
        }

        if (request.Key is not null) row.HasKey = request.Key.Value;
        if (!string.IsNullOrWhiteSpace(request.Status))
            row.WorkflowStatus = request.Status.Trim();
        row.UpdatedAtUtc = _time.UtcNow();
        await _ops.SaveChangesAsync(cancellationToken);
        return ToDto(row, []);
    }

    private async Task<KeyEnvelope?> FindLinkedEnvelopeAsync(
        PropertyKeyRecord row,
        CancellationToken cancellationToken)
    {
        var po = row.PoNumber.Trim();
        var deed = row.PropertyId.Trim();
        var property = await _caseStudy.GetPropertyByPoAndDeedAsync(po, deed, cancellationToken);
        var requestNumber = property?.RequestNumber?.Trim() ?? "";
        if (requestNumber.Length == 0) return null;

        return await _ops.KeyEnvelopes
            .Include(e => e.Handoffs)
            .Where(e => e.RequestNumber == requestNumber)
            .OrderByDescending(e => e.CreatedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);
    }

    private async Task SyncFromEnvelopesAndLegacyAsync(CancellationToken cancellationToken)
    {
        var now = _time.UtcNow();
        var existingRows = await _ops.PropertyKeyRecords.ToListAsync(cancellationToken);
        var matchedRowIds = new HashSet<Guid>();

 // 1) Project from envelopes + linked properties / assignments
        var envelopes = await _ops.KeyEnvelopes.AsNoTracking()
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

        var linkedProperties = await _caseStudy.ListPropertiesByRequestNumbersAsync(
            requestNumbers,
            cancellationToken);

        var enabledNoKey = await _ops.PropertyCourtAccesses.AsNoTracking()
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
                    po: property.PoNumber,
                    deedLabel: deedLabel,
                    area: property.City,
                    propertyType: property.PropertyType,
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
                _ops.PropertyKeyRecords.Remove(row);
        }

        await _ops.SaveChangesAsync(cancellationToken);
    }

    private async Task MergeLegacyGovReviewAsync(
        List<PropertyKeyRecord> existingRows,
        HashSet<Guid> matchedRowIds,
        DateTime now,
        CancellationToken cancellationToken)
    {
        var govRows = await _caseStudy.ListGovReviewKeyStatusesAsync(cancellationToken);
        if (govRows.Count == 0) return;

        foreach (var row in govRows)
        {
            var po = row.PoNumber.Trim();
            var deedLabel = FormatDeedLabel(row.DeedNumber, row.PropertyId, row.PropertyOrdinal);

 // Skip if already projected from an envelope for same PO+deed
            var already = existingRows.Any(x =>
                matchedRowIds.Contains(x.Id)
                && x.PoNumber.Trim().Equals(po, StringComparison.OrdinalIgnoreCase)
                && (string.Equals(x.PropertyId, deedLabel, StringComparison.OrdinalIgnoreCase)
                    || string.Equals(x.PropertyId, row.PropertyId.ToString(), StringComparison.OrdinalIgnoreCase)));
            if (already) continue;

            var workflowStatus = row.KeysStatus == PropertyKeysStatuses.Received
                ? PropertyKeyWorkflowStatuses.Done
                : PropertyKeyWorkflowStatuses.Progress;
            UpsertProjectedRow(
                existingRows,
                matchedRowIds,
                po,
                deedLabel,
                area: row.City,
                propertyType: row.PropertyType,
                specialist: row.AssigneeName,
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
            _ops.PropertyKeyRecords.Add(created);
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
        if (!PropertyKeyWorkflowStatuses.IsDone(existing.WorkflowStatus)
            || PropertyKeyWorkflowStatuses.IsDone(workflowStatus))
            existing.WorkflowStatus = workflowStatus;
        existing.UpdatedAtUtc = now;
        matchedRowIds.Add(existing.Id);
    }

    private static string DeriveStatus(KeyEnvelope envelope, KeyEnvelopeAssignment? assignment)
    {
        if (assignment?.Status == KeyAssignmentStatuses.Matched) return PropertyKeyWorkflowStatuses.Done;
        if (envelope.Handoffs.Any(h =>
                h.Kind == KeyHandoffKinds.Internal
                && h.Status is KeyHandoffStatuses.Confirmed or KeyHandoffStatuses.Completed))
            return PropertyKeyWorkflowStatuses.Done;
        if (envelope.Status is KeyEnvelopeStatuses.Assessor or KeyEnvelopeStatuses.External)
            return PropertyKeyWorkflowStatuses.Done;
        return PropertyKeyWorkflowStatuses.Progress;
    }

    private static string ResolveDeedStatus(
        PropertyKeyRecord row,
        IReadOnlyList<CaseStudyPropertySnapshotDto> properties)
    {
        var po = row.PoNumber.Trim();
        var key = row.PropertyId.Trim();
        var match = properties.FirstOrDefault(p =>
            p.PoNumber.Trim().Equals(po, StringComparison.OrdinalIgnoreCase) &&
            (string.Equals(p.DeedNumber, key, StringComparison.OrdinalIgnoreCase) ||
             string.Equals(p.Id.ToString(), key, StringComparison.OrdinalIgnoreCase)));
        var status = match?.DeedStatus?.Trim();
        return string.IsNullOrWhiteSpace(status) ? "—" : status;
    }

    private static PropertyKeyRecordDto ToDto(
        PropertyKeyRecord row,
        IReadOnlyList<CaseStudyPropertySnapshotDto> properties) => new()
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

    private static string FormatDeedLabel(string? deedNumber, Guid propertyId, int propertyOrdinal)
    {
        var deed = deedNumber?.Trim();
        if (!string.IsNullOrWhiteSpace(deed)) return deed;
        if (propertyOrdinal > 0) return propertyOrdinal.ToString("000");
        return propertyId.ToString();
    }
}

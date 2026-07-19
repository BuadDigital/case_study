using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Infrastructure.Services;

public sealed class PropertyKeyGateResolver : IPropertyKeyGateResolver
{
    private readonly ApplicationDbContext _db;

    public PropertyKeyGateResolver(ApplicationDbContext db) => _db = db;

    public async Task<PropertyKeyGateDto> ResolveAsync(
        Guid? propertyId,
        string? poNumber,
        string? deedNumber,
        string? requestNumber,
        CancellationToken cancellationToken = default)
    {
        WorkOrderProperty? property = null;
        if (propertyId is Guid pid)
        {
            property = await _db.WorkOrderProperties.AsNoTracking()
                .Include(p => p.WorkOrder)
                .FirstOrDefaultAsync(p => p.Id == pid && !p.IsRemoved, cancellationToken);
        }
        else if (!string.IsNullOrWhiteSpace(poNumber) && !string.IsNullOrWhiteSpace(deedNumber))
        {
            var po = poNumber.Trim();
            var deed = deedNumber.Trim();
            property = await _db.WorkOrderProperties.AsNoTracking()
                .Include(p => p.WorkOrder)
                .FirstOrDefaultAsync(
                    p => !p.IsRemoved
                         && p.WorkOrder != null
                         && p.WorkOrder.PoNumber == po
                         && p.DeedNumber == deed,
                    cancellationToken);
        }

        var resolvedPo = property?.WorkOrder?.PoNumber?.Trim()
            ?? poNumber?.Trim()
            ?? "";
        var resolvedDeed = property?.DeedNumber?.Trim()
            ?? deedNumber?.Trim()
            ?? "";
        var resolvedRequest = property?.RequestNumber?.Trim()
            ?? requestNumber?.Trim()
            ?? "";
        var resolvedPropertyId = property?.Id ?? propertyId;

        PropertyCourtAccess? access = null;
        if (resolvedPropertyId is Guid accessPid)
        {
            access = await _db.PropertyCourtAccesses.AsNoTracking()
                .FirstOrDefaultAsync(a => a.PropertyId == accessPid, cancellationToken);
        }

        if (access?.StudyHoldStatus == PropertyCourtAccessStatuses.EnabledNoKey)
        {
            return new PropertyKeyGateDto
            {
                PropertyId = resolvedPropertyId,
                PoNumber = resolvedPo,
                DeedNumber = resolvedDeed,
                RequestNumber = resolvedRequest,
                KeysStatus = "not_required",
                KeyHandedToInspector = "yes",
                KeyAvailable = true,
                Source = "court_access",
                StudyHoldStatus = access.StudyHoldStatus,
            };
        }

        KeyEnvelope? envelope = null;
        if (resolvedRequest.Length > 0)
        {
            envelope = await _db.KeyEnvelopes.AsNoTracking()
                .Include(e => e.Assignments)
                .Include(e => e.Handoffs)
                .Where(e => e.RequestNumber == resolvedRequest)
                .OrderByDescending(e => e.CreatedAtUtc)
                .FirstOrDefaultAsync(cancellationToken);
        }

        if (envelope is null && resolvedDeed.Length > 0)
        {
            var assignment = await _db.KeyEnvelopeAssignments.AsNoTracking()
                .Include(a => a.Envelope)
                .Where(a =>
                    a.DeedNumber == resolvedDeed
                    || (resolvedPropertyId != null && a.PropertyId == resolvedPropertyId))
                .OrderByDescending(a => a.Envelope!.CreatedAtUtc)
                .FirstOrDefaultAsync(cancellationToken);
            envelope = assignment?.Envelope;
            if (envelope is not null)
            {
                envelope = await _db.KeyEnvelopes.AsNoTracking()
                    .Include(e => e.Assignments)
                    .Include(e => e.Handoffs)
                    .FirstOrDefaultAsync(e => e.Id == envelope.Id, cancellationToken);
            }
        }

        if (envelope is not null)
        {
            var assignment = envelope.Assignments.FirstOrDefault(a =>
                (resolvedPropertyId != null && a.PropertyId == resolvedPropertyId)
                || (resolvedDeed.Length > 0
                    && string.Equals(a.DeedNumber, resolvedDeed, StringComparison.OrdinalIgnoreCase)));

            var pendingHandoff = envelope.Handoffs
                .Where(h => h.Kind == KeyHandoffKinds.Internal
                    && h.Status == KeyHandoffStatuses.PendingConfirm)
                .OrderByDescending(h => h.CreatedAtUtc)
                .FirstOrDefault();

            var handed = envelope.Status is KeyEnvelopeStatuses.Assessor or KeyEnvelopeStatuses.External
                || envelope.Handoffs.Any(h =>
                    h.Kind == KeyHandoffKinds.Internal
                    && h.Status is KeyHandoffStatuses.Confirmed or KeyHandoffStatuses.Completed);

            var keysStatus = envelope.ReceiveScenario == KeyReceiveScenarios.Missing
                ? "pending"
                : envelope.ReceiveScenario == KeyReceiveScenarios.Court
                    || envelope.ReceiveScenario == KeyReceiveScenarios.ThirdParty
                    ? "received"
                    : "pending";

            if (assignment?.Status == KeyAssignmentStatuses.Matched)
                handed = true;

            var available =
                access?.StudyHoldStatus == PropertyCourtAccessStatuses.EnabledNoKey
                || handed
                || assignment?.Status == KeyAssignmentStatuses.Matched
                || keysStatus == "not_required";

            return new PropertyKeyGateDto
            {
                PropertyId = resolvedPropertyId,
                PoNumber = resolvedPo,
                DeedNumber = resolvedDeed,
                RequestNumber = envelope.RequestNumber,
                KeysStatus = keysStatus,
                KeyHandedToInspector = handed ? "yes" : (pendingHandoff is not null ? "no" : ""),
                KeyAvailable = available,
                Source = "envelope",
                EnvelopeId = envelope.Id,
                AssignmentId = assignment?.Id,
                AssignmentStatus = assignment?.Status,
                PendingHandoffId = pendingHandoff?.Id,
                StudyHoldStatus = access?.StudyHoldStatus ?? PropertyCourtAccessStatuses.None,
                EnvelopeMissingWarning = false,
            };
        }

        // Legacy fallback: government-review submission keysStatus
        if (resolvedPropertyId is Guid legacyPid && resolvedPo.Length > 0)
        {
            var govTask = await _db.WorkflowTasks.AsNoTracking()
                .Where(t =>
                    t.Kind == "government-review"
                    && t.PropertyId == legacyPid
                    && t.PoNumber == resolvedPo)
                .OrderByDescending(t => t.CreatedAtUtc)
                .FirstOrDefaultAsync(cancellationToken);

            if (govTask is not null)
            {
                var submission = await _db.PartyTaskSubmissions.AsNoTracking()
                    .FirstOrDefaultAsync(
                        s => s.Kind == "government-review" && s.WorkflowTaskId == govTask.Id,
                        cancellationToken);
                if (submission is not null)
                {
                    var (keysStatus, handed) = ParseLegacy(submission.PayloadJson);
                    var available =
                        handed == "yes"
                        || keysStatus is "received" or "not_required";
                    return new PropertyKeyGateDto
                    {
                        PropertyId = resolvedPropertyId,
                        PoNumber = resolvedPo,
                        DeedNumber = resolvedDeed,
                        RequestNumber = resolvedRequest,
                        KeysStatus = keysStatus,
                        KeyHandedToInspector = handed,
                        KeyAvailable = available,
                        Source = "legacy",
                        StudyHoldStatus = access?.StudyHoldStatus ?? PropertyCourtAccessStatuses.None,
                        EnvelopeMissingWarning =
                            keysStatus == "received" && resolvedRequest.Length > 0,
                    };
                }
            }
        }

        return new PropertyKeyGateDto
        {
            PropertyId = resolvedPropertyId,
            PoNumber = resolvedPo,
            DeedNumber = resolvedDeed,
            RequestNumber = resolvedRequest,
            Source = "none",
            StudyHoldStatus = access?.StudyHoldStatus ?? PropertyCourtAccessStatuses.None,
            EnvelopeMissingWarning = false,
        };
    }

    private static (string KeysStatus, string Handed) ParseLegacy(string payloadJson)
    {
        try
        {
            using var doc = System.Text.Json.JsonDocument.Parse(payloadJson);
            var root = doc.RootElement;
            var keys = root.TryGetProperty("keysStatus", out var ks)
                ? ks.GetString()?.Trim() ?? ""
                : "";
            var handed = root.TryGetProperty("keyHandedToInspector", out var kh)
                ? kh.GetString()?.Trim() ?? ""
                : "";
            return (keys, handed);
        }
        catch
        {
            return ("", "");
        }
    }
}

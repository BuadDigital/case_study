using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Infrastructure.Services;

public sealed class PropertyKeyGateResolver : IPropertyKeyGateResolver
{
    private readonly OperationsDbContext _ops;
    private readonly ICaseStudyLookup _caseStudy;

    [ActivatorUtilitiesConstructor]
    public PropertyKeyGateResolver(OperationsDbContext ops, ICaseStudyLookup caseStudy)
    {
        _ops = ops;
        _caseStudy = caseStudy;
    }

    public async Task<PropertyKeyGateDto> ResolveAsync(
        Guid? propertyId,
        string? poNumber,
        string? deedNumber,
        string? requestNumber,
        CancellationToken cancellationToken = default)
    {
        CaseStudyPropertySnapshotDto? property = null;
        if (propertyId is Guid pid)
            property = await _caseStudy.GetPropertyAsync(pid, cancellationToken);
        else if (!string.IsNullOrWhiteSpace(poNumber) && !string.IsNullOrWhiteSpace(deedNumber))
        {
            property = await _caseStudy.GetPropertyByPoAndDeedAsync(
                poNumber,
                deedNumber,
                cancellationToken);
        }

        var resolvedPo = property?.PoNumber
            ?? poNumber?.Trim()
            ?? "";
        var resolvedDeed = property?.DeedNumber
            ?? deedNumber?.Trim()
            ?? "";
        var resolvedRequest = property?.RequestNumber
            ?? requestNumber?.Trim()
            ?? "";
        var resolvedPropertyId = property?.Id ?? propertyId;

        PropertyCourtAccess? access = null;
        if (resolvedPropertyId is Guid accessPid)
        {
            access = await _ops.PropertyCourtAccesses.AsNoTracking()
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
                KeysStatus = PropertyKeysStatuses.NotRequired,
                KeyHandedToInspector = PropertyKeyHandedValues.Yes,
                KeyAvailable = true,
                Source = PropertyKeyGateSources.CourtAccess,
                StudyHoldStatus = access.StudyHoldStatus,
            };
        }

        KeyEnvelope? envelope = null;
        if (resolvedRequest.Length > 0)
        {
            envelope = await _ops.KeyEnvelopes.AsNoTracking()
                .Include(e => e.Assignments)
                .Include(e => e.Handoffs)
                .Where(e => e.RequestNumber == resolvedRequest)
                .OrderByDescending(e => e.CreatedAtUtc)
                .FirstOrDefaultAsync(cancellationToken);
        }

        if (envelope is null && resolvedDeed.Length > 0)
        {
            var assignment = await _ops.KeyEnvelopeAssignments.AsNoTracking()
                .Include(a => a.Envelope)
                .Where(a =>
                    a.DeedNumber == resolvedDeed
                    || (resolvedPropertyId != null && a.PropertyId == resolvedPropertyId))
                .OrderByDescending(a => a.Envelope!.CreatedAtUtc)
                .FirstOrDefaultAsync(cancellationToken);
            envelope = assignment?.Envelope;
            if (envelope is not null)
            {
                envelope = await _ops.KeyEnvelopes.AsNoTracking()
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

            var keysStatus = envelope.ReceiveScenario is KeyReceiveScenarios.Court
                or KeyReceiveScenarios.ThirdParty
                ? PropertyKeysStatuses.Received
                : PropertyKeysStatuses.Pending;

            if (assignment?.Status == KeyAssignmentStatuses.Matched)
                handed = true;

            var available =
                access?.StudyHoldStatus == PropertyCourtAccessStatuses.EnabledNoKey
                || handed
                || assignment?.Status == KeyAssignmentStatuses.Matched
                || keysStatus == PropertyKeysStatuses.NotRequired;

            return new PropertyKeyGateDto
            {
                PropertyId = resolvedPropertyId,
                PoNumber = resolvedPo,
                DeedNumber = resolvedDeed,
                RequestNumber = envelope.RequestNumber,
                KeysStatus = keysStatus,
                KeyHandedToInspector = handed
                    ? PropertyKeyHandedValues.Yes
                    : (pendingHandoff is not null ? PropertyKeyHandedValues.No : ""),
                KeyAvailable = available,
                Source = PropertyKeyGateSources.Envelope,
                EnvelopeId = envelope.Id,
                AssignmentId = assignment?.Id,
                AssignmentStatus = assignment?.Status,
                PendingHandoffId = pendingHandoff?.Id,
                StudyHoldStatus = access?.StudyHoldStatus ?? PropertyCourtAccessStatuses.None,
                EnvelopeMissingWarning = false,
            };
        }

        return new PropertyKeyGateDto
        {
            PropertyId = resolvedPropertyId,
            PoNumber = resolvedPo,
            DeedNumber = resolvedDeed,
            RequestNumber = resolvedRequest,
            Source = PropertyKeyGateSources.None,
            StudyHoldStatus = access?.StudyHoldStatus ?? PropertyCourtAccessStatuses.None,
            EnvelopeMissingWarning = false,
        };
    }
}

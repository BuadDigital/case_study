using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Operations.Application.Abstractions;
using RealEstateEval.Operations.Infrastructure.Data.Contexts;
using RealEstateEval.Operations.Application.Contracts;
using RealEstateEval.Operations.Domain;

namespace RealEstateEval.Operations.Infrastructure.Services;

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
            // The deed as typed plus its normalised Latin / Arabic-Indic forms (DeedNumberRules), so an
            // envelope saved as "١٢٣٤٥٦" is found for "123456"; the SQL filter stays index-friendly.
            var deedForms = DeedNumberRules.MatchCandidates(resolvedDeed);
            var assignment = await _ops.KeyEnvelopeAssignments.AsNoTracking()
                .Include(a => a.Envelope)
                .Where(a =>
                    deedForms.Contains(a.DeedNumber)
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
                    && DeedNumberRules.EqualsNormalized(a.DeedNumber, resolvedDeed)));

            var pendingHandoff = envelope.Handoffs
                .Where(h => h.Kind == KeyHandoffKinds.Internal
                    && h.Status == KeyHandoffStatuses.PendingConfirm)
                .OrderByDescending(h => h.CreatedAtUtc)
                .FirstOrDefault();

            // Custody (decision 2026-10-20): the key reads as handed when the envelope is with a
            // system user or this deed's own key is kept by one. Which user is the deed's inspector
            // is for the screen to compare — the holder is exposed beside the flag.
            var keyWithUser = assignment?.KeyLocation == KeyLocations.WithUser;
            var handed = envelope.HolderKind == KeyHolderKinds.InternalUser || keyWithUser;

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
                EnvelopeHolderKind = envelope.HolderKind,
                EnvelopeHolderUserId = envelope.HolderUserId,
                EnvelopeHolderLabel = envelope.HolderLabel,
                KeyLocation = assignment?.KeyLocation,
                KeyHolderUserId = assignment?.KeyHolderUserId,
                KeyHolderLabel = assignment?.KeyHolderLabel,
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

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

    /// <summary>The key gate of one deed: are its keys in, handed to an inspector, and available for the visit.</summary>
    /// <remarks>
    /// How it works: 1) finds the deed through Case Study (by id, or PO + deed number); 2) court access
    /// «enabled without a key» answers at once (not required, available); 3) finds the envelope by
    /// request number, else by an assignment on the deed (normalised deed forms) or property id;
    /// 4) picks this deed's assignment and the latest pending internal handoff; 5) handed = the envelope
    /// is held by an internal_user, or this deed's key is with_user, or the trial matched; 6) returns
    /// the flags plus the envelope holder and the deed's key place / holder.
    /// Edge cases (custody, decision 2026-10-20): handed used to come from the envelope status
    /// (assessor / external) or any internal handoff ever confirmed; it now follows the current holder.
    /// Operations cannot see case-study tasks, so whether the holder is THIS deed's inspector is decided
    /// on the client — an envelope held by another deed's inspector reads «الظرف عند … (معاين صك آخر)».
    /// </remarks>
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

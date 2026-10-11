using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Services;

/// <summary>
/// Inspection Limitations (Decision 24 + Q-7): Packaged by Inspector, feeding m18/m21 alarms
/// The compound reservation text is within Special Assumptions.
/// </summary>
public sealed class InspectionLimitsService : IInspectionLimitsService
{
    private readonly IInspectionLimitsRepository db;

    public InspectionLimitsService(IInspectionLimitsRepository db) => this.db = db;

    public async Task<InspectionLimitsDto?> GetAsync(
        string poNumber,
        Guid propertyId,
        CancellationToken cancellationToken = default)
    {
        var prop = await LoadAsync(poNumber, propertyId, track: false, cancellationToken);
        return prop is null ? null : ToDto(prop);
    }

    public async Task<(InspectionLimitsDto? Result, Dictionary<string, string>? Errors)> SaveAsync(
        string poNumber,
        Guid propertyId,
        SaveInspectionLimitsRequest request,
        CancellationToken cancellationToken = default)
    {
        var units = (request.UninspectedUnits ?? [])
            .Select(u => new UninspectedUnitEntry(u.Count, (u.Reason ?? "").Trim()))
            .ToList();

        var errors = InspectionLimitsRules.Validate(
            request.InspectionScopeKey,
            request.InspectionRestrictionReason,
            units);
        if (errors.Count > 0) return (null, errors);

        var prop = await LoadAsync(poNumber, propertyId, track: true, cancellationToken);
        if (prop is null)
            return (null, new Dictionary<string, string> { ["_"] = "العقار غير موجود" });

        var scope = request.InspectionScopeKey.Trim().ToLowerInvariant();

 // Changing the domain drops the previous Q-7 certification — the certification is tied to a specific domain.
        if (!string.Equals(prop.InspectionScopeKey, scope, StringComparison.Ordinal))
        {
            prop.RemoteInspectionApprovedBy = null;
            prop.RemoteInspectionApprovedAtUtc = null;
        }

        prop.InspectionScopeKey = scope;
        prop.InspectionRestrictionReason = string.IsNullOrWhiteSpace(request.InspectionRestrictionReason)
            ? null
            : request.InspectionRestrictionReason.Trim();
        prop.UninspectedUnitsJson = InspectionLimitsRules.SerializeUnits(units);

        await db.SaveChangesAsync(cancellationToken);
        return (ToDto(prop), null);
    }

    private Task<WorkOrderProperty?> LoadAsync(
        string poNumber,
        Guid propertyId,
        bool track,
        CancellationToken cancellationToken) =>
        db.GetPropertyAsync(poNumber, propertyId, track, cancellationToken);

    private static InspectionLimitsDto ToDto(WorkOrderProperty prop)
    {
        var units = InspectionLimitsRules.ParseUnits(prop.UninspectedUnitsJson);
        return new InspectionLimitsDto
        {
            PropertyId = prop.Id,
            InspectionScopeKey = prop.InspectionScopeKey,
            InspectionScopeLabelAr = InspectionScopeKeys.LabelAr(prop.InspectionScopeKey),
            InspectionRestrictionReason = prop.InspectionRestrictionReason,
            UninspectedUnits = units
                .Select(u => new UninspectedUnitEntryDto { Count = u.Count, Reason = u.Reason })
                .ToList(),
            TotalUninspectedUnits = InspectionLimitsRules.TotalUninspectedUnits(units),
            ReservationTextAr = InspectionLimitsRules.ComposeReservationTextAr(
                prop.InspectionScopeKey,
                prop.InspectionRestrictionReason,
                units),
            RemoteInspectionApprovedBy = prop.RemoteInspectionApprovedBy,
            RemoteInspectionApprovedAtUtc = prop.RemoteInspectionApprovedAtUtc?.ToString("o"),
            RemoteInspectionApproved = prop.RemoteInspectionApprovedAtUtc is not null,
        };
    }
}

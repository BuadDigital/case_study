using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Infrastructure.Services;

/// <summary>
/// حدود المعاينة (القرار 24 + ق-7): يعبّئها المعاين، وتغذي تنبيهي m18/m21
/// ونص التحفّظ المركّب ضمن الافتراضات الخاصة.
/// </summary>
public sealed class InspectionLimitsService(
    CaseStudyDbContext db,
    PlatformDbContext platformDb,
    IAuditLogWriter audit) : IInspectionLimitsService
{
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

 // تغيير النطاق يُسقط اعتماد ق-7 السابق — الاعتماد مربوط بنطاق بعينه.
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

    public async Task<(InspectionLimitsDto? Result, string? Error)> ApproveRemoteAsync(
        string poNumber,
        Guid propertyId,
        string actorId,
        CancellationToken cancellationToken = default)
    {
        var prop = await LoadAsync(poNumber, propertyId, track: true, cancellationToken);
        if (prop is null) return (null, "العقار غير موجود");

        if (!string.Equals(
                prop.InspectionScopeKey,
                InspectionScopeKeys.Desktop,
                StringComparison.Ordinal))
        {
            return (null, "الاعتماد يخص نطاق «مكتبية عن بُعد» فقط (ق-7)");
        }

        if (prop.RemoteInspectionApprovedAtUtc is not null)
            return (ToDto(prop), null);

        prop.RemoteInspectionApprovedBy = string.IsNullOrWhiteSpace(actorId) ? "unknown" : actorId;
        prop.RemoteInspectionApprovedAtUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);

 // ق-7: اعتماد مسجَّل في التدقيق.
        platformDb.AuditLogs.Add(audit.Create(
            actorId: prop.RemoteInspectionApprovedBy!,
            action: "inspection.remote-scope.approved",
            entityType: "WorkOrderProperty",
            entityId: propertyId.ToString("D"),
            before: null,
            after: new
            {
                scope = prop.InspectionScopeKey,
                approvedAtUtc = prop.RemoteInspectionApprovedAtUtc,
            }));
        await platformDb.SaveChangesAsync(cancellationToken);

        return (ToDto(prop), null);
    }

    private async Task<WorkOrderProperty?> LoadAsync(
        string poNumber,
        Guid propertyId,
        bool track,
        CancellationToken cancellationToken)
    {
        var po = IWorkOrderLoader.NormalizePo(poNumber);
        var query = track
            ? db.WorkOrderProperties.AsQueryable()
            : db.WorkOrderProperties.AsNoTracking();
        return await query
            .Include(p => p.WorkOrder)
            .FirstOrDefaultAsync(
                p => p.Id == propertyId && p.WorkOrder!.PoNumber == po,
                cancellationToken);
    }

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

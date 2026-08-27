using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Infrastructure.Services;

/// <summary>
/// حدود المعاينة (القرار 24 + ق-7): يعبّئها المعاين، وتغذي تنبيهي m18/m21
/// ونص التحفّظ المركّب ضمن الافتراضات الخاصة.
/// </summary>
public sealed class InspectionLimitsService : IInspectionLimitsService
{
    private readonly ICaseStudyRepository db;
    private readonly IAuditLogWriter audit;
    private readonly IAuditLogAppend _auditLog;
    private readonly TimeProvider _time;

    // A8: the PlatformDbContext convenience ctor is gone — compose PlatformAuditLogAppend
    // explicitly where needed (tests); DI uses the interface ctor below.

    [ActivatorUtilitiesConstructor]
    public InspectionLimitsService(
        ICaseStudyRepository db,
        IAuditLogWriter audit,
        IAuditLogAppend auditLog,
        TimeProvider? time = null)
    {
        _time = time ?? TimeProvider.System;

        this.db = db;
        this.audit = audit;
        _auditLog = auditLog;
    }
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
        prop.RemoteInspectionApprovedAtUtc = _time.UtcNow();
        await db.SaveChangesAsync(cancellationToken);

 // ق-7: اعتماد مسجَّل في التدقيق.
        await _auditLog.AppendAsync(audit.Create(
            actorId: prop.RemoteInspectionApprovedBy!,
            action: "inspection.remote-scope.approved",
            entityType: "WorkOrderProperty",
            entityId: propertyId.ToString("D"),
            before: null,
            after: new
            {
                scope = prop.InspectionScopeKey,
                approvedAtUtc = prop.RemoteInspectionApprovedAtUtc,
            }), cancellationToken);

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

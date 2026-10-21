using Microsoft.Extensions.Logging;
using RealEstateEval.Shared.Contracts;
using RealEstateEval.CaseStudy.Application.Mapping;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Services;

/// <summary>
/// Work-order façade: header lifecycle + create. Reads and property mutates live on collaborators.
/// </summary>
public partial class WorkOrderService : IWorkOrderService
{
    private readonly IWorkOrderRepository _db;
    private readonly IPropertyTimelineService _timeline;
    private readonly INotificationService _notifications;
    private readonly INotificationRecipientResolver _recipients;
    private readonly IWorkOrderLoader _loader;
    private readonly IWorkOrderQuery _query;
    private readonly IWorkOrderPropertyCommands _properties;
    private readonly IOrganizationSettingsService? _organizationSettings;
    private readonly ILogger<WorkOrderService>? _logger;
    private readonly TimeProvider _time;

    public WorkOrderService(
        IWorkOrderRepository db,
        IPropertyTimelineService timeline,
        INotificationService notifications,
        INotificationRecipientResolver recipients,
        IWorkOrderLoader loader,
        IWorkOrderQuery query,
        IWorkOrderPropertyCommands properties,
        IOrganizationSettingsService? organizationSettings = null,
        TimeProvider? time = null,
        ILogger<WorkOrderService>? logger = null)
    {
        _time = time ?? TimeProvider.System;

        _db = db;
        _timeline = timeline;
        _notifications = notifications;
        _recipients = recipients;
        _loader = loader;
        _query = query;
        _properties = properties;
        _organizationSettings = organizationSettings;
        _logger = logger;
    }

    public Task<IReadOnlyList<WorkOrderListItemDto>> ListAsync(
        PermissionsDto? actor = null,
        CancellationToken cancellationToken = default) =>
        _query.ListAsync(actor, cancellationToken);

    public Task<PagedResultDto<WorkOrderListItemDto>> ListPagedAsync(
        int? page,
        int? pageSize,
        PermissionsDto? actor = null,
        CancellationToken cancellationToken = default) =>
        _query.ListPagedAsync(page, pageSize, actor, cancellationToken);

    public Task<IReadOnlyList<WorkOrderListItemDto>> ListAsync(
        WorkOrderListQuery query,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default) =>
        _query.ListAsync(query, actor, cancellationToken);

    public Task<PagedResultDto<WorkOrderListItemDto>> ListPagedAsync(
        WorkOrderListQuery query,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default) =>
        _query.ListPagedAsync(query, actor, cancellationToken);

    public Task<WorkOrderListCountsDto> CountsAsync(
        WorkOrderListQuery query,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default) =>
        _query.CountsAsync(query, actor, cancellationToken);

    public Task<IReadOnlyList<WorkOrderDto>> ListDetailsAsync(
        PermissionsDto? actor = null,
        CancellationToken cancellationToken = default) =>
        _query.ListDetailsAsync(actor, cancellationToken);

    public Task<IReadOnlyList<PropertyListItemDto>> ListPropertyListItemsAsync(
        PermissionsDto? actor = null,
        CancellationToken cancellationToken = default) =>
        _query.ListPropertyListItemsAsync(actor, cancellationToken);

    public Task<WorkOrderDto?> GetByPoNumberAsync(
        string poNumber,
        PermissionsDto? actor = null,
        CancellationToken cancellationToken = default) =>
        _query.GetByPoNumberAsync(poNumber, actor, cancellationToken);

    public Task<bool> ExistsAsync(string poNumber, CancellationToken cancellationToken) =>
        _query.ExistsAsync(poNumber, cancellationToken);

    public Task<PriorDeedRegistrationDto?> FindPriorDeedAsync(
        string deedNumber,
        string? excludePoNumber,
        CancellationToken cancellationToken,
        Guid? excludePropertyId = null) =>
        _query.FindPriorDeedAsync(deedNumber, excludePoNumber, cancellationToken, excludePropertyId);

    public Task<IReadOnlyList<PriorDeedRegistrationDto>> ListPriorDeedsAsync(
        string deedNumber,
        string? excludePoNumber,
        CancellationToken cancellationToken,
        Guid? excludePropertyId = null,
        int take = 20) =>
        _query.ListPriorDeedsAsync(deedNumber, excludePoNumber, cancellationToken, excludePropertyId, take);

    public Task<IReadOnlyList<PendingBoursePropertyDto>> ListPendingBourseAsync(
        CancellationToken cancellationToken) =>
        _query.ListPendingBourseAsync(cancellationToken);

    public async Task<(WorkOrderDto? Result, Dictionary<string, string>? Errors)> CreateAsync(
        CreateWorkOrderRequest request,
        CancellationToken cancellationToken)
    {
        var headerErrors = WorkOrderValidator.ValidateHeader(request);
        if (headerErrors.Count > 0) return (null, headerErrors);

        var clientError = await RequireActiveClientAsync(request.ClientId, cancellationToken);
        if (clientError is not null) return (null, clientError);

        var po = IWorkOrderLoader.NormalizePo(request.PoNumber);
        if (await ExistsAsync(po, cancellationToken))
            return (null, new Dictionary<string, string> { ["poNumber"] = "رقم PO مسجّل مسبقاً" });

        if (!AssignmentTypeLabels.TryParseLabel(request.AssignmentType, out var assignmentType))
            return (null, new Dictionary<string, string> { ["assignmentType"] = "نوع الإسناد غير صالح" });

        var promulgation = DateOnly.Parse(request.PromulgationDate);

        var seenDeeds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var prop in request.Properties)
        {
            var deed = prop.DeedNumber.Trim();
            if (string.IsNullOrEmpty(deed)) continue;
            // "123456", "123-456" and "١٢٣٤٥٦" are one deed.
            var deedKey = DeedNumberRules.Normalize(deed);
            if (deedKey.Length > 0 && !seenDeeds.Add(deedKey))
            {
                return (null, new Dictionary<string, string>
                {
                    ["deedNumber"] = "رقم الصك مسجّل مسبقاً في هذا أمر العمل",
                });
            }

            var propErrors = WorkOrderValidator.ValidatePropertyEnfath(
                prop,
                assignmentType,
                null,
                (_, _) => false,
                SeedClientIds.ClientFieldPolicyForClient(request.ClientId, request.ReportUserClientIds));
            if (propErrors.Count > 0) return (null, propErrors);
        }

        var workOrder = new WorkOrder
        {
            Id = Guid.NewGuid(),
            PoNumber = po,
            AssignmentType = assignmentType,
            PromulgationDate = promulgation,
            ReceivedFromEnfathAt = promulgation,
            ReceivedFromEnfathTime = request.ReceivedFromEnfathTime?.Trim(),
            AssignmentSpecialist = IWorkOrderLoader.NormalizeOptionalText(request.AssignmentSpecialist),
            AssignmentSpecialistEmail = IWorkOrderLoader.NormalizeOptionalText(request.AssignmentSpecialistEmail),
            ExpectedPropertyCount = request.ExpectedPropertyCount,
            PropertiesRegion = IWorkOrderLoader.NormalizeOptionalText(request.PropertiesRegion),
            WorkOrderDescription = IWorkOrderLoader.NormalizeOptionalText(request.WorkOrderDescription),
            ClientId = request.ClientId,
            ReportUserClientIdsJson = WorkOrderReportUsers.Serialize(request.ReportUserClientIds),
            ValuationPurposeKey = NormalizeValuationKey(request.ValuationPurposeKey),
            BasisOfValueKey = NormalizeValuationKey(request.BasisOfValueKey),
            ValuePremiseKey = NormalizeValuationKey(request.ValuePremiseKey),
            DueDateAt = BusinessDueDateCalculator.Compute(
                promulgation,
                request.ReceivedFromEnfathTime,
                await ResolveBusinessDaysAsync(assignmentType, cancellationToken)),
            CreatedAtUtc = _time.UtcNow(),
        };

        foreach (var propDto in request.Properties)
        {
            propDto.Id = null;
            var mappedProperty = _properties.MapPropertyEnfath(propDto, workOrder.Id, forInsert: true);
            // Decision 2026-10-19: every deed opens its own draft transaction (D- number); the
            // official PR reference comes at the first report approval, never at intake.
            var now = _time.UtcNow();
            var (draftNumber, referenceError) =
                await _db.AllocateTransactionDraftNumberAsync(now, cancellationToken);
            if (referenceError is not null)
                return (null, new Dictionary<string, string> { ["_"] = referenceError });
            mappedProperty.Transaction = Transaction.CreateDraft(draftNumber!, now);
            mappedProperty.TransactionId = mappedProperty.Transaction.Id;
            workOrder.Properties.Add(mappedProperty);
        }

        _db.AddWorkOrder(workOrder);
        await _db.SaveChangesAsync(cancellationToken);

        // The due date is not an event that happened: it lives in the «مواعيد مهمة» card, not on the timeline.
        var timelineEvents = workOrder.Properties.Select(prop => EnfathReceivedEvent(workOrder, prop.Id)).ToList();
        await _timeline.RecordManyAsync(timelineEvents, cancellationToken);
        await NotifySpecialistAssignedIfChangedAsync(
            po,
            previousEmail: null,
            newEmail: workOrder.AssignmentSpecialistEmail,
            cancellationToken);
        await NotifyCdoWorkOrderCreatedAsync(po, workOrder.Properties.Count, cancellationToken);

        var loaded = await _loader.LoadAsync(po, cancellationToken, asNoTracking: true);
        return (loaded is null
            ? null
            : await _query.WithResolvedSpecialistAsync(WorkOrderMapper.ToDto(loaded), cancellationToken), null);
    }

    public async Task<(WorkOrderDto? Result, Dictionary<string, string>? Errors)> UpdateHeaderAsync(
        string poNumber,
        UpdateWorkOrderHeaderRequest request,
        CancellationToken cancellationToken)
    {
        var entity = await _loader.LoadAsync(poNumber, cancellationToken);
        if (entity is null) return (null, new Dictionary<string, string> { ["_"] = "أمر العمل غير موجود" });

        var errors = WorkOrderValidator.ValidateUpdateHeader(request);
        if (errors.Count > 0) return (null, errors);

        var clientError = await RequireActiveClientAsync(request.ClientId, cancellationToken);
        if (clientError is not null) return (null, clientError);

        if (!AssignmentTypeLabels.TryParseLabel(request.AssignmentType, out var assignmentType))
            return (null, new Dictionary<string, string> { ["assignmentType"] = "نوع الإسناد غير صالح" });

        if (WorkOrderValidator.RequiresAssignmentDecree(assignmentType))
        {
            var missingDecree = entity.Properties.Any(p =>
                !WorkOrderMapper.HasStoredFileNames(p.AssignmentDocFileName));
            if (missingDecree)
                return (null, new Dictionary<string, string>
                {
                    ["assignmentType"] = "مسار التنفيذ يتطلب قرار إسناد لكل عقار",
                });
        }

        var promulgation = DateOnly.Parse(request.PromulgationDate);
        var previousSpecialistEmail = entity.AssignmentSpecialistEmail;

        entity.AssignmentType = assignmentType;
        entity.PromulgationDate = promulgation;
        entity.ReceivedFromEnfathAt = promulgation;
        entity.ReceivedFromEnfathTime = request.ReceivedFromEnfathTime?.Trim();
        entity.AssignmentSpecialist = IWorkOrderLoader.NormalizeOptionalText(request.AssignmentSpecialist);
        entity.AssignmentSpecialistEmail = IWorkOrderLoader.NormalizeOptionalText(request.AssignmentSpecialistEmail);
        entity.ExpectedPropertyCount = request.ExpectedPropertyCount;
        entity.PropertiesRegion = IWorkOrderLoader.NormalizeOptionalText(request.PropertiesRegion);
        entity.WorkOrderDescription = IWorkOrderLoader.NormalizeOptionalText(request.WorkOrderDescription);
        entity.ClientId = request.ClientId;
        entity.ReportUserClientIdsJson = WorkOrderReportUsers.Serialize(request.ReportUserClientIds);
        entity.ValuationPurposeKey = NormalizeValuationKey(request.ValuationPurposeKey);
        entity.BasisOfValueKey = NormalizeValuationKey(request.BasisOfValueKey);
        entity.ValuePremiseKey = NormalizeValuationKey(request.ValuePremiseKey);
 // DueDateAt is the SLA snapshot taken when Enfath first hands us the work order. Editing
 // header facts later must not move the deadline of work that is already in progress.

        await _db.SaveChangesAsync(cancellationToken);
        await NotifySpecialistAssignedIfChangedAsync(
            entity.PoNumber,
            previousSpecialistEmail,
            entity.AssignmentSpecialistEmail,
            cancellationToken);
        return (await _query.WithResolvedSpecialistAsync(WorkOrderMapper.ToDto(entity), cancellationToken), null);
    }

    public async Task<(bool Ok, string? Error)> DeleteAsync(
        string poNumber,
        CancellationToken cancellationToken)
    {
        var entity = await _loader.LoadAsync(poNumber, cancellationToken);
        if (entity is null) return (false, "أمر العمل غير موجود");

        var n = IWorkOrderLoader.NormalizePo(poNumber);
        await _db.DeleteWorkOrderCascadeAsync(entity, n, cancellationToken);
        return (true, null);
    }

    public Task<(bool Ok, string? Error)> CancelAsync(
        string poNumber,
        CancellationToken cancellationToken) =>
        SetLifecycleStatusAsync(
            poNumber,
            WorkOrderLifecycleStatus.Cancelled,
            "أمر العمل ملغى مسبقاً",
            cancellationToken);

    public Task<(bool Ok, string? Error)> StopAsync(
        string poNumber,
        CancellationToken cancellationToken) =>
        SetLifecycleStatusAsync(
            poNumber,
            WorkOrderLifecycleStatus.Stopped,
            "أمر العمل متوقف مسبقاً",
            cancellationToken);

    public Task<(WorkOrderPropertyDto? Result, Dictionary<string, string>? Errors)> AddPropertyAsync(
        string poNumber,
        WorkOrderPropertyDto property,
        CancellationToken cancellationToken,
        bool softDraft = false) =>
        _properties.AddPropertyAsync(poNumber, property, cancellationToken, softDraft);

    public Task<(WorkOrderPropertyDto? Result, Dictionary<string, string>? Errors)> UpdatePropertyAsync(
        string poNumber,
        Guid propertyId,
        WorkOrderPropertyDto property,
        CancellationToken cancellationToken,
        bool softDraft = false,
        string? actorName = null) =>
        _properties.UpdatePropertyAsync(poNumber, propertyId, property, cancellationToken, softDraft, actorName);


    public Task<(WorkOrderPropertyDto? Result, Dictionary<string, string>? Errors)> UpdateSpecialistReportExtrasAsync(
        string poNumber,
        Guid propertyId,
        string? specialistReportExtrasJson,
        CancellationToken cancellationToken,
        PartySubmissionActor? actor = null) =>
        _properties.UpdateSpecialistReportExtrasAsync(
            poNumber,
            propertyId,
            specialistReportExtrasJson,
            cancellationToken,
            actor);

    public Task<(WorkOrderPropertyDto? Result, Dictionary<string, string>? Errors)> CompleteBourseDataAsync(
        string poNumber,
        Guid propertyId,
        UpdatePropertyBourseRequest request,
        CancellationToken cancellationToken,
        string? actorName = null) =>
        _properties.CompleteBourseDataAsync(poNumber, propertyId, request, cancellationToken, actorName);

    public Task<(bool Ok, string? Error)> DeletePropertyAsync(
        string poNumber,
        Guid propertyId,
        string reason,
        CancellationToken cancellationToken) =>
        _properties.DeletePropertyAsync(poNumber, propertyId, reason, cancellationToken);

    private async Task<(bool Ok, string? Error)> SetLifecycleStatusAsync(
        string poNumber,
        string lifecycleStatus,
        string alreadyAppliedMessage,
        CancellationToken cancellationToken)
    {
        var entity = await _loader.LoadAsync(poNumber, cancellationToken);
        if (entity is null) return (false, "أمر العمل غير موجود");

        if (string.Equals(entity.LifecycleStatus, lifecycleStatus, StringComparison.Ordinal))
            return (false, alreadyAppliedMessage);

        if (lifecycleStatus == WorkOrderLifecycleStatus.Stopped
            && entity.LifecycleStatus == WorkOrderLifecycleStatus.Cancelled)
        {
            return (false, "لا يمكن إيقاف أمر عمل ملغى");
        }

        entity.LifecycleStatus = lifecycleStatus;
        await _db.SaveChangesAsync(cancellationToken);

        // Party queues do not clear themselves — without this the inspector, office and
        // appraiser keep working a transaction that is no longer live.
        await NotifyPartiesLifecycleStoppedAsync(entity.PoNumber, lifecycleStatus, cancellationToken);
        return (true, null);
    }

    private async Task<Dictionary<string, string>?> RequireActiveClientAsync(
        Guid clientId,
        CancellationToken cancellationToken)
    {
        if (clientId == Guid.Empty)
            return new Dictionary<string, string> { ["clientId"] = "العميل مطلوب" };

        var active = await _db.HasActiveClientAsync(clientId, cancellationToken);
        if (!active)
            return new Dictionary<string, string> { ["clientId"] = "العميل غير موجود أو غير نشط" };

        return null;
    }

    private async Task<int> ResolveBusinessDaysAsync(
        AssignmentType assignmentType,
        CancellationToken cancellationToken)
    {
        if (_organizationSettings is null)
            return AssignmentTypeRules.BusinessDaysRequired(assignmentType);

        try
        {
            var settings = await _organizationSettings.GetAsync(cancellationToken);
            return AssignmentTypeRules.BusinessDaysRequired(
                assignmentType,
                settings.Sla.DefaultBusinessDays,
                settings.Sla.PrivateSectorBusinessDays);
        }
        catch (Exception ex)
        {
            // Intake must not block on settings, but a silent fallback hides a wrong deadline.
            _logger?.LogWarning(
                ex,
                "Organization settings unavailable; work-order due date for {AssignmentType} falls back to the built-in {Days} business days.",
                assignmentType,
                AssignmentTypeRules.BusinessDaysRequired(assignmentType));
            return AssignmentTypeRules.BusinessDaysRequired(assignmentType);
        }
    }

    private static string? NormalizeValuationKey(string? value)
    {
        var trimmed = value?.Trim().ToLowerInvariant();
        return string.IsNullOrEmpty(trimmed) ? null : trimmed;
    }

    /// <summary>
    /// The instant the order was received from Enfaz: its date plus the received time when the order carries
    /// one (Riyadh time, UTC+3), otherwise the date alone at midnight UTC (shown on the timeline as a date only).
    /// </summary>
    internal static PropertyTimelineRecordRequest EnfathReceivedEvent(WorkOrder workOrder, Guid propertyId) =>
        new(
            workOrder.PoNumber,
            propertyId,
            "enfath",
            "استلام أمر العمل من إنفاذ",
            string.IsNullOrWhiteSpace(workOrder.AssignmentSpecialist)
                ? null
                : $"أخصائي الإسناد: {workOrder.AssignmentSpecialist.Trim()}",
            PropertyTimelineTones.Done,
            ReceivedFromEnfathInstant(workOrder.ReceivedFromEnfathAt, workOrder.ReceivedFromEnfathTime));

    internal static DateTime ReceivedFromEnfathInstant(DateOnly date, string? receivedTime)
    {
        if (TimeOnly.TryParse(receivedTime?.Trim(), out var time))
        {
            var riyadh = date.ToDateTime(time, DateTimeKind.Unspecified);
            return DateTime.SpecifyKind(riyadh.AddHours(-3), DateTimeKind.Utc);
        }

        return date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
    }
}

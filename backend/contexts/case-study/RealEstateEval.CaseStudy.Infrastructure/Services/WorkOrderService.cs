using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Notifications;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Infrastructure.Services;

/// <summary>
/// Work-order façade: header lifecycle + create. Reads and property mutates live on collaborators.
/// </summary>
public class WorkOrderService : IWorkOrderService
{
    private readonly ICaseStudyRepository _db;
    private readonly IPropertyTimelineService _timeline;
    private readonly INotificationService _notifications;
    private readonly NotificationRecipientResolver _recipients;
    private readonly IWorkOrderLoader _loader;
    private readonly IWorkOrderQuery _query;
    private readonly IWorkOrderPropertyCommands _properties;
    private readonly IOrganizationSettingsService? _organizationSettings;
    private readonly TimeProvider _time;

    public WorkOrderService(
        ICaseStudyRepository db,
        IPropertyTimelineService timeline,
        INotificationService notifications,
        NotificationRecipientResolver recipients,
        IWorkOrderLoader loader,
        IWorkOrderQuery query,
        IWorkOrderPropertyCommands properties,
        IOrganizationSettingsService? organizationSettings = null,
        TimeProvider? time = null)
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

        var seenDeeds = new HashSet<string>(StringComparer.Ordinal);
        foreach (var prop in request.Properties)
        {
            var deed = prop.DeedNumber.Trim();
            if (string.IsNullOrEmpty(deed)) continue;
            if (!seenDeeds.Add(deed))
            {
                return (null, new Dictionary<string, string>
                {
                    ["deedNumber"] = "رقم الصك مسجّل مسبقاً في هذا أمر العمل",
                });
            }

            var propErrors = WorkOrderValidator.ValidatePropertyEnfath(
                prop,
                assignmentType,
                po,
                null,
                (_, _) => false);
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
 // Numbering workshop (decision items 2 and 5): transaction reference number assigned on intake.
            var (transactionReference, referenceError) =
                await ReferenceSequenceAllocator.AllocateYearlyAsync(
                    _db.Database,
                    _db.ReferenceSequences,
                    _db.SaveChangesAsync,
                    DatabaseSchemas.CaseStudy,
                    ReferenceNumbering.Transaction,
                    _time.UtcNow(),
                    cancellationToken);
            if (referenceError is not null)
                return (null, new Dictionary<string, string> { ["_"] = referenceError });
            mappedProperty.ReferenceNumber = transactionReference;
            workOrder.Properties.Add(mappedProperty);
        }

        _db.WorkOrders.Add(workOrder);
        await _db.SaveChangesAsync(cancellationToken);

        var enfathAt = workOrder.ReceivedFromEnfathAt.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var specialistDetail = string.IsNullOrWhiteSpace(workOrder.AssignmentSpecialist)
            ? null
            : $"أخصائي الإسناد: {workOrder.AssignmentSpecialist.Trim()}";
        var dueAt = workOrder.DueDateAt.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var timelineEvents = workOrder.Properties.SelectMany(prop => new[]
        {
            new PropertyTimelineRecordRequest(
                po,
                prop.Id,
                "enfath",
                "استلام من إنفاذ",
                specialistDetail,
                PropertyTimelineTones.Done,
                enfathAt),
            new PropertyTimelineRecordRequest(
                po,
                prop.Id,
                "due",
                "موعد الاستحقاق",
                null,
                PropertyTimelineTones.Muted,
                dueAt),
        }).ToList();
        await _timeline.RecordManyAsync(timelineEvents, cancellationToken);
        await NotifySpecialistAssignedIfChangedAsync(
            po,
            previousEmail: null,
            newEmail: workOrder.AssignmentSpecialistEmail,
            cancellationToken);

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
        var tasks = await _db.WorkflowTasks
            .Where(t => t.PoNumber == n)
            .ToListAsync(cancellationToken);
        if (tasks.Count > 0)
        {
            var taskIds = tasks.Select(t => t.Id).ToList();
            var forms = await _db.CaseStudyForms
                .Where(f => f.PoNumber == n || taskIds.Contains(f.TaskId))
                .ToListAsync(cancellationToken);
            if (forms.Count > 0)
                _db.CaseStudyForms.RemoveRange(forms);
            var partySubs = await _db.PartyTaskSubmissions
                .Where(s => s.PoNumber == n || taskIds.Contains(s.WorkflowTaskId))
                .ToListAsync(cancellationToken);
            if (partySubs.Count > 0)
            {
                var inspectionTaskIds = partySubs
                    .Where(s => s.Kind == WorkflowTaskKindValues.FieldInspection)
                    .Select(s => s.WorkflowTaskId)
                    .ToList();
                if (inspectionTaskIds.Count > 0)
                {
                    var workspaces = await _db.FieldInspectionWorkspaces
                        .Where(w => inspectionTaskIds.Contains(w.WorkflowTaskId))
                        .ToListAsync(cancellationToken);
                    if (workspaces.Count > 0)
                        _db.FieldInspectionWorkspaces.RemoveRange(workspaces);
                }

                _db.PartyTaskSubmissions.RemoveRange(partySubs);
            }
            _db.WorkflowTasks.RemoveRange(tasks);
        }
        else
        {
            var forms = await _db.CaseStudyForms
                .Where(f => f.PoNumber == n)
                .ToListAsync(cancellationToken);
            if (forms.Count > 0)
                _db.CaseStudyForms.RemoveRange(forms);
        }

        _db.WorkOrders.Remove(entity);
        await _db.PropertyTimelineEntries
            .Where(e => e.PoNumber == n)
            .ExecuteDeleteAsync(cancellationToken);
        await _db.SaveChangesAsync(cancellationToken);
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
        CancellationToken cancellationToken) =>
        _properties.AddPropertyAsync(poNumber, property, cancellationToken);

    public Task<(WorkOrderPropertyDto? Result, Dictionary<string, string>? Errors)> UpdatePropertyAsync(
        string poNumber,
        Guid propertyId,
        WorkOrderPropertyDto property,
        CancellationToken cancellationToken) =>
        _properties.UpdatePropertyAsync(poNumber, propertyId, property, cancellationToken);

    public Task<(WorkOrderPropertyDto? Result, Dictionary<string, string>? Errors)> UpdateLocationMapUrlAsync(
        string poNumber,
        Guid propertyId,
        string? locationMapUrl,
        CancellationToken cancellationToken) =>
        _properties.UpdateLocationMapUrlAsync(poNumber, propertyId, locationMapUrl, cancellationToken);

    public Task<(WorkOrderPropertyDto? Result, Dictionary<string, string>? Errors)> UpdateSpecialistReportExtrasAsync(
        string poNumber,
        Guid propertyId,
        string? specialistReportExtrasJson,
        CancellationToken cancellationToken) =>
        _properties.UpdateSpecialistReportExtrasAsync(
            poNumber,
            propertyId,
            specialistReportExtrasJson,
            cancellationToken);

    public Task<(WorkOrderPropertyDto? Result, Dictionary<string, string>? Errors)> CompleteBourseDataAsync(
        string poNumber,
        Guid propertyId,
        UpdatePropertyBourseRequest request,
        CancellationToken cancellationToken) =>
        _properties.CompleteBourseDataAsync(poNumber, propertyId, request, cancellationToken);

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
        return (true, null);
    }

    private async Task<Dictionary<string, string>?> RequireActiveClientAsync(
        Guid clientId,
        CancellationToken cancellationToken)
    {
        if (clientId == Guid.Empty)
            return new Dictionary<string, string> { ["clientId"] = "العميل مطلوب" };

        var active = await _db.Clients.AsNoTracking()
            .AnyAsync(c => c.Id == clientId && c.IsActive, cancellationToken);
        if (!active)
            return new Dictionary<string, string> { ["clientId"] = "العميل غير موجود أو غير نشط" };

        return null;
    }

    private async Task NotifySpecialistAssignedIfChangedAsync(
        string poNumber,
        string? previousEmail,
        string? newEmail,
        CancellationToken cancellationToken)
    {
        var next = newEmail?.Trim() ?? "";
        if (next.Length == 0) return;

        var previous = previousEmail?.Trim() ?? "";
        if (string.Equals(previous, next, StringComparison.OrdinalIgnoreCase))
            return;

        var userId = await _recipients.ResolveUserIdForEmailAsync(next, cancellationToken);
        if (userId is null) return;

        var po = poNumber.Trim();
        await _notifications.CreateForUserAsync(
            userId,
            new CreateUserNotificationRequest
            {
                Title = "معاملة جديدة بانتظارك",
                Body = $"أُسند إليك أمر العمل {po}.",
                Tone = "info",
                Href = $"/po/{Uri.EscapeDataString(po)}/property",
                Category = "workflow",
                EntityType = "work-order",
                EntityId = po,
                SourceEvent = $"work-order-assigned:{po}:{userId}",
            },
            cancellationToken);
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
        catch
        {
            return AssignmentTypeRules.BusinessDaysRequired(assignmentType);
        }
    }
}

using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using System.Text.Json;

namespace RealEstateEval.Infrastructure.Services;

public class WorkOrderService : IWorkOrderService
{
    private const string CaseStudyPropertyKind = "case-study-property";

    private readonly ApplicationDbContext _db;
    private readonly IPropertyTimelineService _timeline;
    private readonly IFailureService _failures;
    private readonly DatabaseOptions _dbOptions;

    public WorkOrderService(
        ApplicationDbContext db,
        IPropertyTimelineService timeline,
        IFailureService failures,
        IOptions<DatabaseOptions>? dbOptions = null)
    {
        _db = db;
        _timeline = timeline;
        _failures = failures;
        _dbOptions = dbOptions?.Value ?? new DatabaseOptions();
    }

    public async Task<IReadOnlyList<WorkOrderListItemDto>> ListAsync(CancellationToken cancellationToken)
    {
        var (_, take, _, _) = NpgsqlConfiguration.ResolveListPaging(null, null, _dbOptions);
        return await BuildListItemsAsync(null, take, cancellationToken);
    }

    public async Task<PagedResultDto<WorkOrderListItemDto>> ListPagedAsync(
        int? page,
        int? pageSize,
        CancellationToken cancellationToken)
    {
        var (skip, take, resolvedPage, _) = NpgsqlConfiguration.ResolveListPaging(
            page,
            pageSize,
            _dbOptions);
        var total = await _db.WorkOrders.CountAsync(cancellationToken);
        var items = await BuildListItemsAsync(skip, take, cancellationToken);

        return new PagedResultDto<WorkOrderListItemDto>
        {
            Items = items,
            TotalCount = total,
            Page = resolvedPage,
            PageSize = take,
        };
    }

    private async Task<IReadOnlyList<WorkOrderListItemDto>> BuildListItemsAsync(
        int? skip,
        int? take,
        CancellationToken cancellationToken)
    {
        IQueryable<WorkOrder> query = _db.WorkOrders
            .AsNoTracking()
            .OrderByDescending(w => w.CreatedAtUtc);

        if (skip is > 0)
            query = query.Skip(skip.Value);
        if (take is > 0)
            query = query.Take(take.Value);

        var orders = await query
            .Include(w => w.Properties)
            .ToListAsync(cancellationToken);
        if (orders.Count == 0)
            return [];

        var poNumbers = orders.Select(w => w.PoNumber.Trim()).Distinct().ToList();
        var propertyIds = orders.SelectMany(w => w.Properties.Select(p => p.Id)).ToList();

        var caseStudyTasks = propertyIds.Count == 0
            ? []
            : await _db.WorkflowTasks
                .AsNoTracking()
                .Where(t => poNumbers.Contains(t.PoNumber)
                    && t.Kind == CaseStudyPropertyKind
                    && t.PropertyId != null
                    && propertyIds.Contains(t.PropertyId.Value))
                .ToListAsync(cancellationToken);

        var studiedByProperty = caseStudyTasks
            .Where(t => t.PropertyId.HasValue)
            .GroupBy(t => t.PropertyId!.Value)
            .ToDictionary(
                g => g.Key,
                g => g.Any(t =>
                    t.Status == WorkflowTaskStatus.Completed
                    || string.Equals(t.Phase, "done", StringComparison.Ordinal)));

        var billedPos = poNumbers.Count == 0
            ? new HashSet<string>(StringComparer.Ordinal)
            : (await _db.PoEnfazInvoices.AsNoTracking()
                .Where(i => poNumbers.Contains(i.PoNumber))
                .Select(i => i.PoNumber)
                .ToListAsync(cancellationToken))
                .Select(p => p.Trim())
                .ToHashSet(StringComparer.Ordinal);

        return orders
            .Select(w => WorkOrderMapper.ToListItem(
                w,
                studiedByProperty,
                billedPos.Contains(w.PoNumber.Trim())))
            .ToList();
    }

    public async Task<IReadOnlyList<WorkOrderDto>> ListDetailsAsync(
        CancellationToken cancellationToken)
    {
        var list = await _db.WorkOrders
            .AsNoTracking()
            .Include(w => w.Properties)
            .ThenInclude(p => p.Contacts)
            .OrderByDescending(w => w.CreatedAtUtc)
            .ToListAsync(cancellationToken);
        return list.Select(WorkOrderMapper.ToDto).ToList();
    }

    public async Task<IReadOnlyList<PropertyListItemDto>> ListPropertyListItemsAsync(
        CancellationToken cancellationToken)
    {
        var list = await _db.WorkOrders
            .AsNoTracking()
            .Include(w => w.Properties)
            .ThenInclude(p => p.Contacts)
            .OrderByDescending(w => w.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        var approvedFailures = await _db.PropertyFailures
            .AsNoTracking()
            .Where(f => f.Status == PropertyFailureStatus.Approved)
            .Select(f => new { f.PoNumber, f.PropertyId })
            .ToListAsync(cancellationToken);

        var failureKeys = approvedFailures
            .Select(f => $"{f.PoNumber.Trim()}|{f.PropertyId.Trim()}")
            .ToHashSet(StringComparer.Ordinal);

        var propertyIds = list.SelectMany(w => w.Properties.Select(p => p.Id)).ToList();
        var poNumbers = list.Select(w => w.PoNumber.Trim()).Distinct().ToList();
        var tasks = propertyIds.Count == 0
            ? []
            : await _db.WorkflowTasks
                .AsNoTracking()
                .Where(t => poNumbers.Contains(t.PoNumber)
                    && t.PropertyId != null
                    && propertyIds.Contains(t.PropertyId.Value))
                .ToListAsync(cancellationToken);

        var tasksByProperty = tasks
            .Where(t => t.PropertyId.HasValue)
            .GroupBy(t => t.PropertyId!.Value)
            .ToDictionary(
                g => g.Key,
                g => (IReadOnlyList<WorkflowTask>)g.ToList());

        return PropertyListRowBuilder.Build(list, failureKeys, tasksByProperty);
    }

    public async Task<WorkOrderDto?> GetByPoNumberAsync(
        string poNumber,
        CancellationToken cancellationToken)
    {
        var entity = await LoadWorkOrderTrackedAsync(poNumber, cancellationToken, asNoTracking: true);
        return entity is null ? null : WorkOrderMapper.ToDto(entity);
    }

    public Task<bool> ExistsAsync(string poNumber, CancellationToken cancellationToken) =>
        _db.WorkOrders.AnyAsync(
            w => w.PoNumber == NormalizePo(poNumber),
            cancellationToken);

    public async Task<PriorDeedRegistrationDto?> FindPriorDeedAsync(
        string deedNumber,
        string? excludePoNumber,
        CancellationToken cancellationToken,
        Guid? excludePropertyId = null)
    {
        var n = deedNumber.Trim();
        if (n.Length == 0) return null;

        var exclude = string.IsNullOrWhiteSpace(excludePoNumber)
            ? null
            : NormalizePo(excludePoNumber);

        var hit = await _db.WorkOrderProperties
            .AsNoTracking()
            .Include(p => p.WorkOrder)
            .Include(p => p.Contacts)
            .Where(p =>
                !p.IsRemoved &&
                p.IdentifierType == PropertyIdentifierType.Deed &&
                p.DeedNumber == n &&
                (excludePropertyId == null || p.Id != excludePropertyId.Value) &&
                (exclude == null || p.WorkOrder!.PoNumber != exclude))
            .OrderByDescending(p => p.WorkOrder!.CreatedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);

        return hit is null || hit.WorkOrder is null
            ? null
            : WorkOrderMapper.ToPriorDeedDto(hit, hit.WorkOrder.PoNumber);
    }

    public async Task<IReadOnlyList<PendingBoursePropertyDto>> ListPendingBourseAsync(
        CancellationToken cancellationToken)
    {
        // Only properties whose case-study task is currently in the bourse phase.
        // After revert to enfath, BourseDataCompleted stays false — without the phase
        // check the row would incorrectly remain on استعلام البورصة.
        var list = await _db.WorkOrderProperties
            .AsNoTracking()
            .Include(p => p.WorkOrder)
            .Where(p => !p.IsRemoved && !p.BourseDataCompleted && p.WorkOrder != null)
            .Where(p => _db.WorkflowTasks.Any(t =>
                t.PropertyId == p.Id
                && t.Kind == CaseStudyPropertyKind
                && t.ParentTaskId == null
                && t.Phase == "bourse"))
            .OrderByDescending(p => p.WorkOrder!.CreatedAtUtc)
            .ThenByDescending(p => p.WorkOrder!.ReceivedFromEnfathAt)
            .ThenBy(p => p.WorkOrder!.PoNumber)
            .ThenBy(p => p.DeedNumber)
            .ToListAsync(cancellationToken);

        return list.Select(WorkOrderMapper.ToPendingBourse).ToList();
    }

    public async Task<(WorkOrderDto? Result, Dictionary<string, string>? Errors)> CreateAsync(
        CreateWorkOrderRequest request,
        CancellationToken cancellationToken)
    {
        var headerErrors = WorkOrderValidator.ValidateHeader(request);
        if (headerErrors.Count > 0) return (null, headerErrors);

        var po = NormalizePo(request.PoNumber);
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
            AssignmentSpecialist = NormalizeOptionalText(request.AssignmentSpecialist),
            AssignmentSpecialistEmail = NormalizeOptionalText(request.AssignmentSpecialistEmail),
            ExpectedPropertyCount = request.ExpectedPropertyCount,
            PropertiesRegion = NormalizeOptionalText(request.PropertiesRegion),
            WorkOrderDescription = NormalizeOptionalText(request.WorkOrderDescription),
            DueDateAt = BusinessDueDateCalculator.Compute(promulgation, request.ReceivedFromEnfathTime),
            CreatedAtUtc = DateTime.UtcNow,
        };

        foreach (var propDto in request.Properties)
        {
            propDto.Id = null;
            workOrder.Properties.Add(MapPropertyEnfath(propDto, workOrder.Id, forInsert: true));
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
                "done",
                enfathAt),
            new PropertyTimelineRecordRequest(
                po,
                prop.Id,
                "due",
                "موعد الاستحقاق",
                null,
                "muted",
                dueAt),
        }).ToList();
        await _timeline.RecordManyAsync(timelineEvents, cancellationToken);

        var loaded = await LoadWorkOrderTrackedAsync(po, cancellationToken, asNoTracking: true);
        return (loaded is null ? null : WorkOrderMapper.ToDto(loaded), null);
    }

    public async Task<(WorkOrderDto? Result, Dictionary<string, string>? Errors)> UpdateHeaderAsync(
        string poNumber,
        UpdateWorkOrderHeaderRequest request,
        CancellationToken cancellationToken)
    {
        var entity = await LoadWorkOrderTrackedAsync(poNumber, cancellationToken);
        if (entity is null) return (null, new Dictionary<string, string> { ["_"] = "أمر العمل غير موجود" });

        var errors = WorkOrderValidator.ValidateUpdateHeader(request);
        if (errors.Count > 0) return (null, errors);

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

        entity.AssignmentType = assignmentType;
        entity.PromulgationDate = promulgation;
        entity.ReceivedFromEnfathAt = promulgation;
        entity.ReceivedFromEnfathTime = request.ReceivedFromEnfathTime?.Trim();
        entity.AssignmentSpecialist = NormalizeOptionalText(request.AssignmentSpecialist);
        entity.AssignmentSpecialistEmail = NormalizeOptionalText(request.AssignmentSpecialistEmail);
        entity.ExpectedPropertyCount = request.ExpectedPropertyCount;
        entity.PropertiesRegion = NormalizeOptionalText(request.PropertiesRegion);
        entity.WorkOrderDescription = NormalizeOptionalText(request.WorkOrderDescription);
        entity.DueDateAt = BusinessDueDateCalculator.Compute(promulgation, request.ReceivedFromEnfathTime);

        await _db.SaveChangesAsync(cancellationToken);
        return (WorkOrderMapper.ToDto(entity), null);
    }

    public async Task<(bool Ok, string? Error)> DeleteAsync(
        string poNumber,
        CancellationToken cancellationToken)
    {
        var entity = await LoadWorkOrderTrackedAsync(poNumber, cancellationToken);
        if (entity is null) return (false, "أمر العمل غير موجود");

        var n = NormalizePo(poNumber);
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
                    .Where(s => s.Kind == "field-inspection")
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

    private async Task<(bool Ok, string? Error)> SetLifecycleStatusAsync(
        string poNumber,
        string lifecycleStatus,
        string alreadyAppliedMessage,
        CancellationToken cancellationToken)
    {
        var entity = await LoadWorkOrderTrackedAsync(poNumber, cancellationToken);
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

    public async Task<(WorkOrderPropertyDto? Result, Dictionary<string, string>? Errors)> AddPropertyAsync(
        string poNumber,
        WorkOrderPropertyDto property,
        CancellationToken cancellationToken)
    {
        var entity = await LoadWorkOrderTrackedAsync(poNumber, cancellationToken);
        if (entity is null) return (null, new Dictionary<string, string> { ["_"] = "أمر العمل غير موجود" });

        var errors = WorkOrderValidator.ValidatePropertyEnfath(
            property,
            entity.AssignmentType,
            entity.PoNumber,
            null,
            (deed, _) => entity.Properties.Any(p =>
                !p.IsRemoved && p.DeedNumber.Trim() == deed.Trim()));
        if (errors.Count > 0) return (null, errors);

        // Never trust client ids on insert — draft ids make EF emit UPDATE and fail with 0 rows.
        property.Id = null;

        var mapped = MapPropertyEnfath(property, entity.Id, forInsert: true);
        _db.WorkOrderProperties.Add(mapped);
        await _db.SaveChangesAsync(cancellationToken);
        return (WorkOrderMapper.ToPropertyDto(mapped), null);
    }

    public async Task<(WorkOrderPropertyDto? Result, Dictionary<string, string>? Errors)> UpdatePropertyAsync(
        string poNumber,
        Guid propertyId,
        WorkOrderPropertyDto property,
        CancellationToken cancellationToken)
    {
        var entity = await LoadWorkOrderTrackedAsync(poNumber, cancellationToken);
        if (entity is null) return (null, new Dictionary<string, string> { ["_"] = "أمر العمل غير موجود" });

        var existing = entity.Properties.FirstOrDefault(p => p.Id == propertyId);
        if (existing is null) return (null, new Dictionary<string, string> { ["_"] = "العقار غير موجود" });
        if (existing.IsRemoved)
            return (null, new Dictionary<string, string> { ["_"] = "لا يمكن تعديل عقار محذوف" });

        var previousLocationMapUrl = existing.LocationMapUrl;

        if (property.BourseDataCompleted)
        {
            var enfathErrors = WorkOrderValidator.ValidatePropertyEnfath(
                property,
                entity.AssignmentType,
                entity.PoNumber,
                propertyId,
                (deed, excludeId) =>
                    entity.Properties.Any(p =>
                        !p.IsRemoved &&
                        p.DeedNumber.Trim() == deed.Trim() && p.Id != excludeId));
            var bourseErrors = WorkOrderValidator.ValidatePropertyBourse(new UpdatePropertyBourseRequest
            {
                City = property.City,
                District = property.District,
                Classification = property.Classification,
                PropertyType = property.PropertyType,
                Area = property.Area,
                DeedStatus = property.DeedStatus,
                RestrictionsPresent = property.RestrictionsPresent,
                RestrictionType = property.RestrictionType,
                RestrictionOtherReason = property.RestrictionOtherReason,
                BoundariesAvailability = property.BoundariesAvailability,
                BoundariesExternalDocName = property.BoundariesExternalDocName,
            });
            var errors = enfathErrors.Concat(bourseErrors)
                .GroupBy(kv => kv.Key)
                .ToDictionary(g => g.Key, g => g.First().Value);
            if (errors.Count > 0) return (null, errors);
            ApplyPropertyEnfath(existing, property);
            ApplyPropertyBourse(existing, property);
            existing.BourseDataCompleted = true;
            existing.BourseCompletedAtUtc = DateTime.UtcNow;
        }
        else
        {
            var errors = WorkOrderValidator.ValidatePropertyEnfath(
                property,
                entity.AssignmentType,
                entity.PoNumber,
                propertyId,
                (deed, excludeId) =>
                    entity.Properties.Any(p =>
                        !p.IsRemoved &&
                        p.DeedNumber.Trim() == deed.Trim() && p.Id != excludeId));
            if (errors.Count > 0) return (null, errors);
            ApplyPropertyEnfath(existing, property);
        }

        // Never mix contact DELETE/INSERT with property UPDATE in one SaveChanges —
        // EF/Npgsql rewrites collection replaces into DELETE+UPDATE and throws
        // DbUpdateConcurrencyException (0 rows). Detach contacts, save scalars, then
        // rewrite contacts with ExecuteDelete + insert.
        DetachTrackedContacts(existing);

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
            await RewritePropertyContactsAsync(existing.Id, property.Contacts, cancellationToken);
        }
        catch (DbUpdateConcurrencyException ex)
        {
            var kinds = string.Join(", ",
                ex.Entries.Select(e => e.Metadata.ClrType.Name + ":" + e.State));
            return (null, new Dictionary<string, string>
            {
                ["_"] = string.IsNullOrEmpty(kinds)
                    ? "تعذّر حفظ العقار — أعد تحميل الصفحة وحاول مرة أخرى"
                    : $"تعذّر حفظ العقار ({kinds}) — أعد تحميل الصفحة وحاول مرة أخرى",
            });
        }
        await ApplyDocumentarySideEffectsAfterPropertySaveAsync(
            entity,
            existing,
            previousLocationMapUrl,
            cancellationToken);

        var saved = await _db.WorkOrderProperties
            .AsNoTracking()
            .Include(p => p.Contacts)
            .FirstAsync(p => p.Id == propertyId, cancellationToken);
        return (WorkOrderMapper.ToPropertyDto(saved), null);
    }

    public async Task<(WorkOrderPropertyDto? Result, Dictionary<string, string>? Errors)> UpdateLocationMapUrlAsync(
        string poNumber,
        Guid propertyId,
        string? locationMapUrl,
        CancellationToken cancellationToken)
    {
        var entity = await LoadWorkOrderTrackedAsync(poNumber, cancellationToken);
        if (entity is null) return (null, new Dictionary<string, string> { ["_"] = "أمر العمل غير موجود" });

        var existing = entity.Properties.FirstOrDefault(p => p.Id == propertyId);
        if (existing is null) return (null, new Dictionary<string, string> { ["_"] = "العقار غير موجود" });
        if (existing.IsRemoved)
            return (null, new Dictionary<string, string> { ["_"] = "لا يمكن تعديل عقار محذوف" });

        var trimmed = locationMapUrl?.Trim() ?? "";
        if (!string.IsNullOrEmpty(trimmed) && !DocumentaryWorkflowRules.HasLocationMapUrl(trimmed))
        {
            return (null, new Dictionary<string, string>
            {
                ["locationMapUrl"] = "رابط الموقع يجب أن يبدأ بـ http:// أو https://",
            });
        }

        var previousLocationMapUrl = existing.LocationMapUrl;
        existing.LocationMapUrl = string.IsNullOrEmpty(trimmed) ? null : trimmed;

        await _db.SaveChangesAsync(cancellationToken);
        await ApplyDocumentarySideEffectsAfterPropertySaveAsync(
            entity,
            existing,
            previousLocationMapUrl,
            cancellationToken);
        return (WorkOrderMapper.ToPropertyDto(existing), null);
    }

    public async Task<(WorkOrderPropertyDto? Result, Dictionary<string, string>? Errors)> CompleteBourseDataAsync(
        string poNumber,
        Guid propertyId,
        UpdatePropertyBourseRequest request,
        CancellationToken cancellationToken)
    {
        var entity = await LoadWorkOrderTrackedAsync(poNumber, cancellationToken);
        if (entity is null) return (null, new Dictionary<string, string> { ["_"] = "أمر العمل غير موجود" });

        var existing = entity.Properties.FirstOrDefault(p => p.Id == propertyId);
        if (existing is null) return (null, new Dictionary<string, string> { ["_"] = "العقار غير موجود" });
        if (existing.IsRemoved)
            return (null, new Dictionary<string, string> { ["_"] = "لا يمكن تعديل عقار محذوف" });

        var errors = WorkOrderValidator.ValidatePropertyBourse(request);
        if (errors.Count > 0) return (null, errors);

        existing.City = request.City.Trim();
        existing.District = request.District.Trim();
        existing.Classification = request.Classification.Trim();
        existing.PropertyType = request.PropertyType.Trim();
        existing.Area = request.Area?.Trim();
        existing.DeedStatus = request.DeedStatus?.Trim();
        existing.RestrictionsPresent = request.RestrictionsPresent?.Trim();
        existing.RestrictionType = NormalizeRestrictionType(request.RestrictionsPresent, request.RestrictionType);
        existing.RestrictionOtherReason = NormalizeRestrictionOtherReason(
            request.RestrictionsPresent,
            request.RestrictionType,
            request.RestrictionOtherReason);
        existing.BoundariesAvailability = request.BoundariesAvailability?.Trim();
        existing.BoundariesExternalDocName = request.BoundariesExternalDocName?.Trim();
        existing.NorthBoundary = NormalizeOptionalText(request.NorthBoundary);
        existing.NorthBoundaryLengthM = NormalizeOptionalText(request.NorthBoundaryLengthM);
        existing.SouthBoundary = NormalizeOptionalText(request.SouthBoundary);
        existing.SouthBoundaryLengthM = NormalizeOptionalText(request.SouthBoundaryLengthM);
        existing.EastBoundary = NormalizeOptionalText(request.EastBoundary);
        existing.EastBoundaryLengthM = NormalizeOptionalText(request.EastBoundaryLengthM);
        existing.WestBoundary = NormalizeOptionalText(request.WestBoundary);
        existing.WestBoundaryLengthM = NormalizeOptionalText(request.WestBoundaryLengthM);
        existing.BourseDataCompleted = true;
        var bourseNow = DateTime.UtcNow;
        existing.BourseCompletedAtUtc = bourseNow;

        await _db.SaveChangesAsync(cancellationToken);

        if (DocumentaryWorkflowRules.BoundariesUnavailable(existing.BoundariesAvailability))
        {
            await _failures.EnsureSystemInternalFailureAsync(
                NormalizePo(poNumber),
                propertyId.ToString(),
                existing.DeedNumber,
                "unknown-boundaries",
                "عدم معرفة حدود العقار",
                "توفر الحدود = غير متوفرة حسب استعلام البورصة.",
                entity.AssignmentSpecialist ?? "النظام",
                cancellationToken);
        }

        var location = string.Join(
            " · ",
            new[] { existing.City, existing.District }
                .Where(s => !string.IsNullOrWhiteSpace(s))
                .Select(s => s.Trim()));
        await _timeline.RecordAsync(
            NormalizePo(poNumber),
            propertyId,
            "property-bourse",
            "بيانات البورصة للعقار",
            string.IsNullOrEmpty(location) ? null : location,
            "done",
            bourseNow,
            cancellationToken);

        return (WorkOrderMapper.ToPropertyDto(existing), null);
    }

    public async Task<(bool Ok, string? Error)> DeletePropertyAsync(
        string poNumber,
        Guid propertyId,
        string reason,
        CancellationToken cancellationToken)
    {
        var trimmedReason = (reason ?? "").Trim();
        if (trimmedReason.Length == 0)
            return (false, "سبب الحذف مطلوب");
        if (trimmedReason.Length > 500)
            return (false, "سبب الحذف طويل جداً");

        var entity = await LoadWorkOrderTrackedAsync(poNumber, cancellationToken);
        if (entity is null) return (false, "أمر العمل غير موجود");

        var prop = entity.Properties.FirstOrDefault(p => p.Id == propertyId);
        if (prop is null) return (false, "العقار غير موجود");
        if (prop.IsRemoved) return (false, "العقار محذوف مسبقاً");

        prop.IsRemoved = true;
        prop.RemovalReason = trimmedReason;
        prop.RemovedAtUtc = DateTime.UtcNow;
        entity.ExpectedPropertyCount = Math.Max(1, entity.ExpectedPropertyCount - 1);

        await _db.SaveChangesAsync(cancellationToken);
        return (true, null);
    }

    private async Task<WorkOrder?> LoadWorkOrderTrackedAsync(
        string poNumber,
        CancellationToken cancellationToken,
        bool asNoTracking = false)
    {
        var po = NormalizePo(poNumber);
        IQueryable<WorkOrder> q = _db.WorkOrders
            .Include(w => w.Properties)
            .ThenInclude(p => p.Contacts);

        if (asNoTracking) q = q.AsNoTracking();

        return await q.FirstOrDefaultAsync(w => w.PoNumber == po, cancellationToken);
    }

    private static string NormalizePo(string poNumber) => poNumber.Trim();

    private static string? NormalizeOptionalText(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string? NormalizeRestrictionType(string? present, string? type)
    {
        if (!string.Equals(present?.Trim(), "yes", StringComparison.OrdinalIgnoreCase))
            return null;
        return NormalizeOptionalText(type)?.ToLowerInvariant();
    }

    private static string? NormalizeRestrictionOtherReason(
        string? present,
        string? type,
        string? reason)
    {
        if (!string.Equals(present?.Trim(), "yes", StringComparison.OrdinalIgnoreCase))
            return null;
        if (!string.Equals(type?.Trim(), "other", StringComparison.OrdinalIgnoreCase))
            return null;
        return NormalizeOptionalText(reason);
    }

    private WorkOrderProperty MapPropertyEnfath(
        WorkOrderPropertyDto dto,
        Guid workOrderId,
        bool forInsert)
    {
        var entity = new WorkOrderProperty
        {
            Id = forInsert ? Guid.NewGuid() : (dto.Id ?? Guid.NewGuid()),
            WorkOrderId = workOrderId,
            BourseDataCompleted = false,
        };
        ApplyPropertyEnfath(entity, dto);
        ReplacePropertyContacts(entity, dto.Contacts, clearExisting: false);
        return entity;
    }

    private static void ApplyPropertyEnfath(
        WorkOrderProperty entity,
        WorkOrderPropertyDto dto)
    {
        PropertyIdentifierTypeLabels.TryParseApiValue(dto.IdentifierType, out var idType);
        entity.IdentifierType = idType;

        if (idType == PropertyIdentifierType.BourseInquiry &&
            string.IsNullOrWhiteSpace(dto.DeedNumber))
        {
            entity.DeedNumber = $"INQ-{entity.Id.ToString("N")[..8].ToUpperInvariant()}";
        }
        else
        {
            entity.DeedNumber = dto.DeedNumber.Trim();
        }

        entity.RequestNumber = dto.RequestNumber?.Trim();
        entity.AssignmentMandateNumber = dto.AssignmentMandateNumber?.Trim();
        entity.AssignmentMandateDate = dto.AssignmentMandateDate?.Trim();
        entity.DeedDate = dto.DeedDate?.Trim();
        entity.OwnerName = dto.OwnerName?.Trim();
        entity.AssignmentDocFileName = WorkOrderMapper.SerializeFileNameList(dto.AssignmentDocFileNames);
        entity.DelegationLetterFileName = WorkOrderMapper.SerializeFileNameList(dto.DelegationLetterFileNames);
        entity.OtherDocumentFileNames = WorkOrderMapper.SerializeFileNameList(dto.OtherDocumentFileNames);
        entity.RealEstateRegFileName = dto.RealEstateRegFileName?.Trim();
        entity.CourtId = dto.CourtId;
        entity.CircuitId = dto.CircuitId;
        entity.Court = dto.Court?.Trim();
        entity.Circuit = dto.Circuit?.Trim();
        entity.District = dto.District?.Trim() ?? "";
        entity.Classification = dto.Classification?.Trim() ?? "";
        entity.PropertyType = dto.PropertyType?.Trim() ?? "";
        entity.DeedStatus = dto.DeedStatus?.Trim();
        entity.Area = dto.Area?.Trim();
        entity.PlanNumber = NormalizeOptionalText(dto.PlanNumber);
        entity.PlotNumber = NormalizeOptionalText(dto.PlotNumber);
        entity.LocationMapUrl = NormalizeOptionalText(dto.LocationMapUrl);
    }

    private void DetachTrackedContacts(WorkOrderProperty entity)
    {
        foreach (var contact in entity.Contacts.ToList())
            _db.Entry(contact).State = EntityState.Detached;
        entity.Contacts.Clear();
    }

    private async Task RewritePropertyContactsAsync(
        Guid propertyId,
        IEnumerable<PropertyContactDto> contacts,
        CancellationToken cancellationToken)
    {
        await _db.PropertyContacts
            .Where(c => c.PropertyId == propertyId)
            .ExecuteDeleteAsync(cancellationToken);

        foreach (var entry in _db.ChangeTracker.Entries<PropertyContact>()
                     .Where(e => e.Entity.PropertyId == propertyId)
                     .ToList())
        {
            entry.State = EntityState.Detached;
        }

        var order = 0;
        var rows = contacts
            .Where(c => !string.IsNullOrWhiteSpace(c.Phone) || !string.IsNullOrWhiteSpace(c.Role))
            .Select(c => new PropertyContact
            {
                Id = Guid.NewGuid(),
                PropertyId = propertyId,
                Name = (c.Name ?? "").Trim(),
                Role = (c.Role ?? "").Trim(),
                Phone = (c.Phone ?? "").Trim(),
                SortOrder = order++,
            })
            .ToList();

        if (rows.Count == 0) return;

        _db.PropertyContacts.AddRange(rows);
        await _db.SaveChangesAsync(cancellationToken);
    }

    private static void ReplacePropertyContacts(
        WorkOrderProperty entity,
        IEnumerable<PropertyContactDto> contacts,
        bool clearExisting)
    {
        if (clearExisting)
            entity.Contacts.Clear();

        var order = 0;
        foreach (var c in contacts.Where(c =>
                     !string.IsNullOrWhiteSpace(c.Phone) || !string.IsNullOrWhiteSpace(c.Role)))
        {
            entity.Contacts.Add(new PropertyContact
            {
                Id = Guid.NewGuid(),
                PropertyId = entity.Id,
                Name = c.Name.Trim(),
                Role = c.Role.Trim(),
                Phone = c.Phone.Trim(),
                SortOrder = order++,
            });
        }
    }

    private static void ApplyPropertyBourse(WorkOrderProperty entity, WorkOrderPropertyDto dto)
    {
        entity.City = dto.City.Trim();
        entity.District = dto.District.Trim();
        entity.Classification = dto.Classification.Trim();
        entity.PropertyType = dto.PropertyType.Trim();
        entity.Area = dto.Area?.Trim();
        entity.DeedStatus = dto.DeedStatus?.Trim();
        entity.RestrictionsPresent = dto.RestrictionsPresent?.Trim();
        entity.RestrictionType = NormalizeRestrictionType(dto.RestrictionsPresent, dto.RestrictionType);
        entity.RestrictionOtherReason = NormalizeRestrictionOtherReason(
            dto.RestrictionsPresent,
            dto.RestrictionType,
            dto.RestrictionOtherReason);
        entity.BoundariesAvailability = dto.BoundariesAvailability?.Trim();
        entity.BoundariesExternalDocName = dto.BoundariesExternalDocName?.Trim();
        entity.NorthBoundary = NormalizeOptionalText(dto.NorthBoundary);
        entity.NorthBoundaryLengthM = NormalizeOptionalText(dto.NorthBoundaryLengthM);
        entity.SouthBoundary = NormalizeOptionalText(dto.SouthBoundary);
        entity.SouthBoundaryLengthM = NormalizeOptionalText(dto.SouthBoundaryLengthM);
        entity.EastBoundary = NormalizeOptionalText(dto.EastBoundary);
        entity.EastBoundaryLengthM = NormalizeOptionalText(dto.EastBoundaryLengthM);
        entity.WestBoundary = NormalizeOptionalText(dto.WestBoundary);
        entity.WestBoundaryLengthM = NormalizeOptionalText(dto.WestBoundaryLengthM);
    }

    private async Task ApplyDocumentarySideEffectsAfterPropertySaveAsync(
        WorkOrder workOrder,
        WorkOrderProperty property,
        string? previousLocationMapUrl,
        CancellationToken cancellationToken)
    {
        var specialist = workOrder.AssignmentSpecialist ?? DocumentaryWorkflowRules.SystemRaiserRole;
        var propertyId = property.Id.ToString();

        if (DocumentaryWorkflowRules.BoundariesUnavailable(property.BoundariesAvailability)
            && property.BourseDataCompleted)
        {
            await _failures.EnsureSystemInternalFailureAsync(
                workOrder.PoNumber,
                propertyId,
                property.DeedNumber,
                "unknown-boundaries",
                "عدم معرفة حدود العقار",
                "توفر الحدود = غير متوفرة حسب استعلام البورصة.",
                specialist,
                cancellationToken);
        }

        var hadUrl = DocumentaryWorkflowRules.HasLocationMapUrl(previousLocationMapUrl);
        var hasUrl = DocumentaryWorkflowRules.HasLocationMapUrl(property.LocationMapUrl);
        var informal = DocumentaryWorkflowRules.IsInformalSettlement(
            property.PlanNumber,
            property.PlotNumber);

        if (informal && hadUrl && !hasUrl)
        {
            await _failures.EnsureSystemInternalFailureAsync(
                workOrder.PoNumber,
                propertyId,
                property.DeedNumber,
                "unknown-location",
                "عدم معرفة موقع العقار",
                "تم مسح رابط موقع الخريطة لعقار في منطقة عشوائية.",
                specialist,
                cancellationToken);
        }

        if (hasUrl)
        {
            await ResolveSystemLocationFailuresAsync(
                workOrder.PoNumber,
                propertyId,
                cancellationToken);
        }
    }

    private async Task ResolveSystemLocationFailuresAsync(
        string poNumber,
        string propertyId,
        CancellationToken cancellationToken)
    {
        var active = await _db.PropertyFailures
            .Where(f =>
                f.PoNumber == poNumber
                && f.PropertyId == propertyId
                && f.ProblemTypeId == "unknown-location"
                && f.RaisedByRole == DocumentaryWorkflowRules.SystemRaiserRole
                && PropertyFailureStatus.Active.Contains(f.Status))
            .Select(f => f.Id)
            .ToListAsync(cancellationToken);

        foreach (var id in active)
        {
            await _failures.ResolveAsync(
                id,
                new ResolveFailureRequest
                {
                    ResolutionReason = "تم تزويد رابط موقع الخريطة.",
                    ContinueInstructions = "يمكن استئناف العمل على العقار.",
                },
                cancellationToken);
        }
    }
}

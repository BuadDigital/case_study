using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using System.Text.Json;

namespace RealEstateEval.Infrastructure.Services;

public class WorkOrderService : IWorkOrderService
{
    private readonly ApplicationDbContext _db;
    private readonly IPropertyTimelineService _timeline;

    public WorkOrderService(
        ApplicationDbContext db,
        IPropertyTimelineService timeline)
    {
        _db = db;
        _timeline = timeline;
    }

    public async Task<IReadOnlyList<WorkOrderListItemDto>> ListAsync(CancellationToken cancellationToken)
    {
        var list = await _db.WorkOrders
            .AsNoTracking()
            .Include(w => w.Properties)
            .OrderByDescending(w => w.CreatedAtUtc)
            .ToListAsync(cancellationToken);
        return list.Select(WorkOrderMapper.ToListItem).ToList();
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

        return PropertyListRowBuilder.Build(list, failureKeys);
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
        CancellationToken cancellationToken)
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
                p.IdentifierType == PropertyIdentifierType.Deed &&
                p.DeedNumber == n &&
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
        var list = await _db.WorkOrderProperties
            .AsNoTracking()
            .Include(p => p.WorkOrder)
            .Where(p => !p.BourseDataCompleted && p.WorkOrder != null)
            .OrderBy(p => p.WorkOrder!.DueDateAt)
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
        foreach (var prop in workOrder.Properties)
        {
            await _timeline.RecordAsync(
                po,
                prop.Id,
                "enfath",
                "استلام من إنفاذ",
                specialistDetail,
                "done",
                enfathAt,
                cancellationToken);
            await _timeline.RecordAsync(
                po,
                prop.Id,
                "due",
                "موعد الاستحقاق",
                null,
                "muted",
                workOrder.DueDateAt.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc),
                cancellationToken);
        }

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
                string.IsNullOrWhiteSpace(p.AssignmentDocFileName));
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
            (deed, _) => entity.Properties.Any(p => p.DeedNumber.Trim() == deed.Trim()));
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

        if (property.BourseDataCompleted)
        {
            var enfathErrors = WorkOrderValidator.ValidatePropertyEnfath(
                property,
                entity.AssignmentType,
                entity.PoNumber,
                propertyId,
                (deed, excludeId) =>
                    entity.Properties.Any(p =>
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
                BoundariesAvailability = property.BoundariesAvailability,
                BoundariesExternalDocName = property.BoundariesExternalDocName,
                BuildLicenseNumber = property.BuildLicenseNumber,
                SubdivisionRecordNumber = property.SubdivisionRecordNumber,
            });
            var errors = enfathErrors.Concat(bourseErrors)
                .GroupBy(kv => kv.Key)
                .ToDictionary(g => g.Key, g => g.First().Value);
            if (errors.Count > 0) return (null, errors);
            ApplyPropertyEnfath(existing, property, forInsert: false);
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
                        p.DeedNumber.Trim() == deed.Trim() && p.Id != excludeId));
            if (errors.Count > 0) return (null, errors);
            ApplyPropertyEnfath(existing, property, forInsert: false);
        }

        await _db.SaveChangesAsync(cancellationToken);
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

        var errors = WorkOrderValidator.ValidatePropertyBourse(request);
        if (errors.Count > 0) return (null, errors);

        existing.City = request.City.Trim();
        existing.District = request.District.Trim();
        existing.Classification = request.Classification.Trim();
        existing.PropertyType = request.PropertyType.Trim();
        existing.Area = request.Area?.Trim();
        existing.DeedStatus = request.DeedStatus?.Trim();
        existing.RestrictionsPresent = request.RestrictionsPresent?.Trim();
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
        existing.BuildLicenseNumber = NormalizeOptionalText(request.BuildLicenseNumber);
        existing.SubdivisionRecordNumber = NormalizeOptionalText(request.SubdivisionRecordNumber);
        existing.BourseDataCompleted = true;
        var bourseNow = DateTime.UtcNow;
        existing.BourseCompletedAtUtc = bourseNow;

        await _db.SaveChangesAsync(cancellationToken);

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
        CancellationToken cancellationToken)
    {
        var entity = await LoadWorkOrderTrackedAsync(poNumber, cancellationToken);
        if (entity is null) return (false, "أمر العمل غير موجود");

        var prop = entity.Properties.FirstOrDefault(p => p.Id == propertyId);
        if (prop is null) return (false, "العقار غير موجود");

        _db.WorkOrderProperties.Remove(prop);
        await _db.PropertyTimelineEntries
            .Where(e => e.PoNumber == NormalizePo(poNumber) && e.PropertyId == propertyId)
            .ExecuteDeleteAsync(cancellationToken);
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

    private static WorkOrderProperty MapPropertyEnfath(
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
        ApplyPropertyEnfath(entity, dto, forInsert);
        return entity;
    }

    private static void ApplyPropertyEnfath(
        WorkOrderProperty entity,
        WorkOrderPropertyDto dto,
        bool forInsert)
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

        entity.TaskNumber = dto.TaskNumber?.Trim();
        entity.DeedDate = dto.DeedDate?.Trim();
        entity.OwnerName = dto.OwnerName?.Trim();
        entity.AssignmentDocFileName = dto.AssignmentDocFileName?.Trim();
        entity.DelegationLetterFileName = dto.DelegationLetterFileName?.Trim();
        entity.OtherDocumentFileNames = dto.OtherDocumentFileNames.Count > 0
            ? JsonSerializer.Serialize(dto.OtherDocumentFileNames)
            : null;
        entity.RealEstateRegFileName = dto.RealEstateRegFileName?.Trim();
        entity.Court = dto.Court?.Trim();
        entity.Circuit = dto.Circuit?.Trim();
        entity.District = dto.District?.Trim() ?? "";
        entity.Classification = dto.Classification?.Trim() ?? "";
        entity.PropertyType = dto.PropertyType?.Trim() ?? "";
        entity.DeedStatus = dto.DeedStatus?.Trim();
        entity.Area = dto.Area?.Trim();

        if (!forInsert)
            entity.Contacts.Clear();

        var order = 0;
        foreach (var c in dto.Contacts.Where(c =>
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
        entity.BoundariesAvailability = dto.BoundariesAvailability?.Trim();
        entity.BoundariesExternalDocName = dto.BoundariesExternalDocName?.Trim();
        entity.BuildLicenseNumber = NormalizeOptionalText(dto.BuildLicenseNumber);
        entity.SubdivisionRecordNumber = NormalizeOptionalText(dto.SubdivisionRecordNumber);
    }
}

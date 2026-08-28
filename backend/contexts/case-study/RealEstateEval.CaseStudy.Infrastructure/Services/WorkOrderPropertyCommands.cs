using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.Failures.Application.Abstractions;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.Failures.Application.Contracts;

namespace RealEstateEval.CaseStudy.Infrastructure.Services;

public sealed class WorkOrderPropertyCommands : IWorkOrderPropertyCommands
{
    private readonly ICaseStudyRepository _db;
    private readonly IFailureLookup _failureLookup;
    private readonly IUserLabelLookup _labels;
    private readonly IWorkOrderLoader _loader;
    private readonly IPropertyTimelineService _timeline;
    private readonly IFailureService _failures;
    private readonly TimeProvider _time;

    [ActivatorUtilitiesConstructor]
    public WorkOrderPropertyCommands(
        ICaseStudyRepository db,
        IFailureLookup failureLookup,
        IUserLabelLookup labels,
        IWorkOrderLoader loader,
        IPropertyTimelineService timeline,
        IFailureService failures,
        TimeProvider? time = null)
    {
        _time = time ?? TimeProvider.System;

        _db = db;
        _failureLookup = failureLookup;
        _labels = labels;
        _loader = loader;
        _timeline = timeline;
        _failures = failures;
    }

    public async Task<(WorkOrderPropertyDto? Result, Dictionary<string, string>? Errors)> AddPropertyAsync(
        string poNumber,
        WorkOrderPropertyDto property,
        CancellationToken cancellationToken)
    {
        var entity = await _loader.LoadAsync(poNumber, cancellationToken);
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
 // ورشة الترقيم (بندا البتّ 2 و5): الرقم المرجعي للمعاملة يُخصَّص عند الإضافة.
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
        mapped.ReferenceNumber = transactionReference;
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
        var entity = await _loader.LoadAsync(poNumber, cancellationToken);
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
                Region = property.Region,
                RegionId = property.RegionId,
                CityId = property.CityId,
                District = property.District,
                Classification = property.Classification,
                PropertyType = property.PropertyType,
                Area = property.Area,
                DeedStatus = property.DeedStatus,
                BourseDeedImageFileName = property.BourseDeedImageFileName,
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
            existing.BourseCompletedAtUtc = _time.UtcNow();
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
        var entity = await _loader.LoadAsync(poNumber, cancellationToken);
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
        var entity = await _loader.LoadAsync(poNumber, cancellationToken);
        if (entity is null) return (null, new Dictionary<string, string> { ["_"] = "أمر العمل غير موجود" });

        var existing = entity.Properties.FirstOrDefault(p => p.Id == propertyId);
        if (existing is null) return (null, new Dictionary<string, string> { ["_"] = "العقار غير موجود" });
        if (existing.IsRemoved)
            return (null, new Dictionary<string, string> { ["_"] = "لا يمكن تعديل عقار محذوف" });

        var errors = WorkOrderValidator.ValidatePropertyBourse(request);
        if (errors.Count > 0) return (null, errors);

        existing.City = request.City.Trim();
        existing.Region = request.Region?.Trim();
        existing.RegionId = request.RegionId;
        existing.CityId = request.CityId;
        existing.District = request.District.Trim();
        existing.Classification = request.Classification.Trim();
        existing.PropertyType = request.PropertyType.Trim();
        existing.Area = request.Area?.Trim();
        existing.DeedStatus = request.DeedStatus?.Trim();
        existing.BourseDeedImageFileName = request.BourseDeedImageFileName?.Trim();
        existing.RestrictionsPresent = request.RestrictionsPresent?.Trim();
        existing.RestrictionType = NormalizeRestrictionType(request.RestrictionsPresent, request.RestrictionType);
        existing.RestrictionOtherReason = NormalizeRestrictionOtherReason(
            request.RestrictionsPresent,
            request.RestrictionType,
            request.RestrictionOtherReason);

 // owners+shares from the transcription; ownership type is editable-derived.
        if (request.Owners is not null)
        {
            var owners = request.Owners
                .Select(o => new DeedOwner(o.Name?.Trim() ?? "", o.SharePct))
                .Where(o => !string.IsNullOrWhiteSpace(o.Name))
                .ToList();
            if (OwnershipTypeRules.ValidateOwners(owners) is { } ownersError)
                return (null, new Dictionary<string, string> { ["owners"] = ownersError });
            existing.DeedOwnersJson = OwnershipTypeRules.SerializeOwners(owners);
            if (owners.Count > 0)
                existing.OwnerName = owners[0].Name;
        }

        if (request.OwnershipTypeIsManual)
        {
            if (!OwnershipTypes.IsKnown(request.OwnershipType))
                return (null, new Dictionary<string, string> { ["ownershipType"] = "نوع ملكية غير معروف" });
            existing.OwnershipType = request.OwnershipType!.Trim().ToLowerInvariant();
            existing.OwnershipTypeIsManual = true;
        }
        else
        {
            existing.OwnershipType = null;
            existing.OwnershipTypeIsManual = false;
        }

        existing.BoundariesAvailability = request.BoundariesAvailability?.Trim();
        existing.BoundariesExternalDocName = request.BoundariesExternalDocName?.Trim();
        existing.NorthBoundary = IWorkOrderLoader.NormalizeOptionalText(request.NorthBoundary);
        existing.NorthBoundaryLengthM = IWorkOrderLoader.NormalizeOptionalText(request.NorthBoundaryLengthM);
        existing.NorthBoundaryType = NormalizeBoundaryType(request.NorthBoundaryType);
        existing.NorthFacadeFinishing = IWorkOrderLoader.NormalizeOptionalText(request.NorthFacadeFinishing);
        existing.SouthBoundary = IWorkOrderLoader.NormalizeOptionalText(request.SouthBoundary);
        existing.SouthBoundaryLengthM = IWorkOrderLoader.NormalizeOptionalText(request.SouthBoundaryLengthM);
        existing.SouthBoundaryType = NormalizeBoundaryType(request.SouthBoundaryType);
        existing.SouthFacadeFinishing = IWorkOrderLoader.NormalizeOptionalText(request.SouthFacadeFinishing);
        existing.EastBoundary = IWorkOrderLoader.NormalizeOptionalText(request.EastBoundary);
        existing.EastBoundaryLengthM = IWorkOrderLoader.NormalizeOptionalText(request.EastBoundaryLengthM);
        existing.EastBoundaryType = NormalizeBoundaryType(request.EastBoundaryType);
        existing.EastFacadeFinishing = IWorkOrderLoader.NormalizeOptionalText(request.EastFacadeFinishing);
        existing.WestBoundary = IWorkOrderLoader.NormalizeOptionalText(request.WestBoundary);
        existing.WestBoundaryLengthM = IWorkOrderLoader.NormalizeOptionalText(request.WestBoundaryLengthM);
        existing.WestBoundaryType = NormalizeBoundaryType(request.WestBoundaryType);
        existing.WestFacadeFinishing = IWorkOrderLoader.NormalizeOptionalText(request.WestFacadeFinishing);
        var bourseNow = _time.UtcNow();
        var boundariesUnavailable = DocumentaryWorkflowRules.BoundariesUnavailable(
            existing.BoundariesAvailability);
        if (!boundariesUnavailable)
        {
            existing.BourseDataCompleted = true;
            existing.BourseCompletedAtUtc = bourseNow;
        }

        await _db.SaveChangesAsync(cancellationToken);

        if (boundariesUnavailable)
        {
            var specialist = await _labels.ResolveAsync(
                entity.AssignmentSpecialist ?? DocumentaryWorkflowRules.SystemRaiserRole,
                cancellationToken);
            await _failures.EnsureSystemInternalFailureAsync(
                IWorkOrderLoader.NormalizePo(poNumber),
                propertyId.ToString(),
                existing.DeedNumber,
                "unknown-boundaries",
                "عدم معرفة حدود العقار",
                "توفر الحدود = غير متوفرة حسب استعلام البورصة.",
                specialist,
                cancellationToken);
        }

        var location = string.Join(
            " · ",
            new[] { existing.City, existing.District }
                .Where(s => !string.IsNullOrWhiteSpace(s))
                .Select(s => s.Trim()));
        await _timeline.RecordAsync(
            IWorkOrderLoader.NormalizePo(poNumber),
            propertyId,
            "property-bourse",
            "بيانات البورصة للعقار",
            string.IsNullOrEmpty(location) ? null : location,
            PropertyTimelineTones.Done,
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

        var entity = await _loader.LoadAsync(poNumber, cancellationToken);
        if (entity is null) return (false, "أمر العمل غير موجود");

        var prop = entity.Properties.FirstOrDefault(p => p.Id == propertyId);
        if (prop is null) return (false, "العقار غير موجود");
        if (prop.IsRemoved) return (false, "العقار محذوف مسبقاً");

        prop.IsRemoved = true;
        prop.RemovalReason = trimmedReason;
        prop.RemovedAtUtc = _time.UtcNow();
        entity.ExpectedPropertyCount = Math.Max(1, entity.ExpectedPropertyCount - 1);

        await _db.SaveChangesAsync(cancellationToken);
        return (true, null);
    }

    public WorkOrderProperty MapPropertyEnfath(
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

    private static string? NormalizeRestrictionType(string? present, string? type)
    {
        if (!string.Equals(present?.Trim(), "yes", StringComparison.OrdinalIgnoreCase))
            return null;
        if (string.IsNullOrWhiteSpace(type)) return null;
        var seen = new HashSet<string>(StringComparer.Ordinal);
        var parts = new List<string>();
        foreach (var raw in type.Split([',', '،'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            var v = raw.ToLowerInvariant();
            if (v is not ("mortgaged" or "seized" or "suspended" or "other")) continue;
            if (!seen.Add(v)) continue;
            parts.Add(v);
        }
        return parts.Count == 0 ? null : string.Join(",", parts);
    }

    private static string? NormalizeRestrictionOtherReason(
        string? present,
        string? type,
        string? reason)
    {
        if (!string.Equals(present?.Trim(), "yes", StringComparison.OrdinalIgnoreCase))
            return null;
        var types = (type ?? "")
            .Split([',', '،'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(t => t.ToLowerInvariant());
        if (!types.Contains("other"))
            return null;
        return IWorkOrderLoader.NormalizeOptionalText(reason);
    }

    private static void ApplyPropertyEnfath(
        WorkOrderProperty entity,
        WorkOrderPropertyDto dto)
    {
        PropertyIdentifierTypeLabels.TryParseApiValue(dto.IdentifierType, out var idType);
        entity.IdentifierType = idType;

 // suggestion from the identifier; the valuer's explicit choice wins.
        entity.DeedKind =
            !string.IsNullOrWhiteSpace(dto.DeedKind)
            && DeedKindLabels.TryParseApiValue(dto.DeedKind, out var deedKind)
                ? deedKind
                : DeedKindLabels.SuggestFromIdentifier(idType);

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
        entity.HasRequestNumber = dto.HasRequestNumber;
        entity.AssignmentMandateNumber = dto.AssignmentMandateNumber?.Trim();
        entity.AssignmentMandateDate = dto.AssignmentMandateDate?.Trim();
        entity.DeedDate = dto.DeedDate?.Trim();
        entity.RealEstateRegNumber = dto.RealEstateRegNumber?.Trim();
        entity.RealEstateRegDate = dto.RealEstateRegDate?.Trim();
        entity.OwnerName = dto.OwnerName?.Trim();
        entity.AssignmentDocFileName = WorkOrderMapper.SerializeFileNameList(dto.AssignmentDocFileNames);
        entity.DelegationLetterFileName = WorkOrderMapper.SerializeFileNameList(dto.DelegationLetterFileNames);
        entity.OtherDocumentFileNames = WorkOrderMapper.SerializeFileNameList(dto.OtherDocumentFileNames);
        entity.RealEstateRegFileName = dto.RealEstateRegFileName?.Trim();
        entity.DeedOwnershipFileName = dto.DeedOwnershipFileName?.Trim();
        entity.BourseDeedImageFileName = dto.BourseDeedImageFileName?.Trim();
        entity.CourtId = dto.CourtId;
        entity.CircuitId = dto.CircuitId;
        entity.RegionId = dto.RegionId;
        entity.CityId = dto.CityId;
        entity.Court = dto.Court?.Trim();
        entity.Circuit = dto.Circuit?.Trim();
        entity.Region = dto.Region?.Trim();
        entity.District = dto.District?.Trim() ?? "";
        entity.Classification = dto.Classification?.Trim() ?? "";
        entity.PropertyType = dto.PropertyType?.Trim() ?? "";
        entity.DeedStatus = dto.DeedStatus?.Trim();
        entity.Area = dto.Area?.Trim();
        entity.PlanNumber = IWorkOrderLoader.NormalizeOptionalText(dto.PlanNumber);
        entity.PlanName = IWorkOrderLoader.NormalizeOptionalText(dto.PlanName);
        entity.PlotNumber = IWorkOrderLoader.NormalizeOptionalText(dto.PlotNumber);
        entity.BlockNumber = IWorkOrderLoader.NormalizeOptionalText(dto.BlockNumber);
        entity.LocationMapUrl = IWorkOrderLoader.NormalizeOptionalText(dto.LocationMapUrl);
        entity.PartitionMinutesNumber = IWorkOrderLoader.NormalizeOptionalText(dto.PartitionMinutesNumber);
        entity.PartitionMinutesDate = IWorkOrderLoader.NormalizeOptionalText(dto.PartitionMinutesDate);
        entity.FinishingType = NormalizeFinishingType(dto.FinishingType);
        entity.FinishingStructure = NormalizeFinishingStructure(dto.FinishingStructure);
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
        entity.Region = dto.Region?.Trim();
        entity.RegionId = dto.RegionId;
        entity.CityId = dto.CityId;
        entity.District = dto.District.Trim();
        entity.Classification = dto.Classification.Trim();
        entity.PropertyType = dto.PropertyType.Trim();
        entity.Area = dto.Area?.Trim();
        entity.DeedStatus = dto.DeedStatus?.Trim();
        entity.BourseDeedImageFileName = dto.BourseDeedImageFileName?.Trim();
        entity.RestrictionsPresent = dto.RestrictionsPresent?.Trim();
        entity.RestrictionType = NormalizeRestrictionType(dto.RestrictionsPresent, dto.RestrictionType);
        entity.RestrictionOtherReason = NormalizeRestrictionOtherReason(
            dto.RestrictionsPresent,
            dto.RestrictionType,
            dto.RestrictionOtherReason);
        entity.BoundariesAvailability = dto.BoundariesAvailability?.Trim();
        entity.BoundariesExternalDocName = dto.BoundariesExternalDocName?.Trim();
        entity.NorthBoundary = IWorkOrderLoader.NormalizeOptionalText(dto.NorthBoundary);
        entity.NorthBoundaryLengthM = IWorkOrderLoader.NormalizeOptionalText(dto.NorthBoundaryLengthM);
        entity.NorthBoundaryType = NormalizeBoundaryType(dto.NorthBoundaryType);
        entity.NorthFacadeFinishing = IWorkOrderLoader.NormalizeOptionalText(dto.NorthFacadeFinishing);
        entity.SouthBoundary = IWorkOrderLoader.NormalizeOptionalText(dto.SouthBoundary);
        entity.SouthBoundaryLengthM = IWorkOrderLoader.NormalizeOptionalText(dto.SouthBoundaryLengthM);
        entity.SouthBoundaryType = NormalizeBoundaryType(dto.SouthBoundaryType);
        entity.SouthFacadeFinishing = IWorkOrderLoader.NormalizeOptionalText(dto.SouthFacadeFinishing);
        entity.EastBoundary = IWorkOrderLoader.NormalizeOptionalText(dto.EastBoundary);
        entity.EastBoundaryLengthM = IWorkOrderLoader.NormalizeOptionalText(dto.EastBoundaryLengthM);
        entity.EastBoundaryType = NormalizeBoundaryType(dto.EastBoundaryType);
        entity.EastFacadeFinishing = IWorkOrderLoader.NormalizeOptionalText(dto.EastFacadeFinishing);
        entity.WestBoundary = IWorkOrderLoader.NormalizeOptionalText(dto.WestBoundary);
        entity.WestBoundaryLengthM = IWorkOrderLoader.NormalizeOptionalText(dto.WestBoundaryLengthM);
        entity.WestBoundaryType = NormalizeBoundaryType(dto.WestBoundaryType);
        entity.WestFacadeFinishing = IWorkOrderLoader.NormalizeOptionalText(dto.WestFacadeFinishing);
    }

    private static string? NormalizeBoundaryType(string? value)
    {
        var t = IWorkOrderLoader.NormalizeOptionalText(value);
        if (t is null) return null;
        return PropertyBoundaryTypes.IsKnown(t) ? t.Trim().ToLowerInvariant() : t;
    }

    private static string? NormalizeFinishingType(string? value)
    {
        var t = IWorkOrderLoader.NormalizeOptionalText(value);
        if (t is null) return null;
        return PropertyFinishingTypes.IsKnown(t) ? t.Trim().ToLowerInvariant() : t;
    }

    private static string? NormalizeFinishingStructure(string? value)
    {
        var t = IWorkOrderLoader.NormalizeOptionalText(value);
        if (t is null) return null;
        return PropertyFinishingStructures.IsKnown(t) ? t.Trim().ToLowerInvariant() : t;
    }

    private async Task ApplyDocumentarySideEffectsAfterPropertySaveAsync(
        WorkOrder workOrder,
        WorkOrderProperty property,
        string? previousLocationMapUrl,
        CancellationToken cancellationToken)
    {
            var specialist = await _labels.ResolveAsync(
            workOrder.AssignmentSpecialist ?? DocumentaryWorkflowRules.SystemRaiserRole,
            cancellationToken);
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
        var active = await _failureLookup.ListActiveIdsByProblemAsync(
            poNumber,
            propertyId,
            "unknown-location",
            DocumentaryWorkflowRules.SystemRaiserRole,
            cancellationToken);

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

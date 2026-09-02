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
        if (entity is null) return (null, WorkOrderPropertyWriteRules.WorkOrderNotFound());

        var errors = WorkOrderValidator.ValidatePropertyEnfath(
            property,
            entity.AssignmentType,
            entity.PoNumber,
            null,
            WorkOrderPropertyWriteRules.DeedTakenProbe(entity));
        if (errors.Count > 0) return (null, errors);

 // Never trust client ids on insert — draft ids make EF emit UPDATE and fail with 0 rows.
        property.Id = null;

        var mapped = MapPropertyEnfath(property, entity.Id, forInsert: true);
 // Numbering workshop (decision items 2 and 5): transaction reference number assigned on add.
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
        if (entity is null) return (null, WorkOrderPropertyWriteRules.WorkOrderNotFound());

        var notEditable = WorkOrderPropertyWriteRules.FindEditableProperty(
            entity,
            propertyId,
            out var existing);
        if (notEditable is not null) return (null, notEditable);

        var previousLocationMapUrl = existing!.LocationMapUrl;

        var enfathErrors = WorkOrderValidator.ValidatePropertyEnfath(
            property,
            entity.AssignmentType,
            entity.PoNumber,
            propertyId,
            WorkOrderPropertyWriteRules.DeedTakenProbe(entity));

        if (property.BourseDataCompleted)
        {
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
            var errors = WorkOrderPropertyWriteRules.MergeErrors(enfathErrors, bourseErrors);
            if (errors.Count > 0) return (null, errors);
            WorkOrderPropertyWriteRules.ApplyPropertyEnfath(existing, property);
            WorkOrderPropertyWriteRules.ApplyPropertyBourse(existing, property);
            existing.BourseDataCompleted = true;
            existing.BourseCompletedAtUtc = _time.UtcNow();
        }
        else
        {
            if (enfathErrors.Count > 0) return (null, enfathErrors);
            WorkOrderPropertyWriteRules.ApplyPropertyEnfath(existing, property);
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
            return (null, WorkOrderPropertyWriteRules.ConcurrencyErrors(kinds));
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
        if (entity is null) return (null, WorkOrderPropertyWriteRules.WorkOrderNotFound());

        var notEditable = WorkOrderPropertyWriteRules.FindEditableProperty(
            entity,
            propertyId,
            out var existing);
        if (notEditable is not null) return (null, notEditable);

        var (urlErrors, url) = WorkOrderPropertyWriteRules.ValidateLocationMapUrl(locationMapUrl);
        if (urlErrors is not null) return (null, urlErrors);

        var previousLocationMapUrl = existing!.LocationMapUrl;
        existing.LocationMapUrl = url;

        await _db.SaveChangesAsync(cancellationToken);
        await ApplyDocumentarySideEffectsAfterPropertySaveAsync(
            entity,
            existing,
            previousLocationMapUrl,
            cancellationToken);
        return (WorkOrderMapper.ToPropertyDto(existing), null);
    }

    public async Task<(WorkOrderPropertyDto? Result, Dictionary<string, string>? Errors)> UpdateSpecialistReportExtrasAsync(
        string poNumber,
        Guid propertyId,
        string? specialistReportExtrasJson,
        CancellationToken cancellationToken)
    {
        var entity = await _loader.LoadAsync(poNumber, cancellationToken);
        if (entity is null) return (null, WorkOrderPropertyWriteRules.WorkOrderNotFound());

        var notEditable = WorkOrderPropertyWriteRules.FindEditableProperty(
            entity,
            propertyId,
            out var existing);
        if (notEditable is not null) return (null, notEditable);

        var (extrasErrors, extras) = WorkOrderPropertyWriteRules.ValidateSpecialistReportExtras(
            specialistReportExtrasJson);
        if (extrasErrors is not null) return (null, extrasErrors);
        existing!.SpecialistReportExtrasJson = extras;

        await _db.SaveChangesAsync(cancellationToken);
        return (WorkOrderMapper.ToPropertyDto(existing), null);
    }

    public async Task<(WorkOrderPropertyDto? Result, Dictionary<string, string>? Errors)> CompleteBourseDataAsync(
        string poNumber,
        Guid propertyId,
        UpdatePropertyBourseRequest request,
        CancellationToken cancellationToken)
    {
        var entity = await _loader.LoadAsync(poNumber, cancellationToken);
        if (entity is null) return (null, WorkOrderPropertyWriteRules.WorkOrderNotFound());

        var notEditable = WorkOrderPropertyWriteRules.FindEditableProperty(
            entity,
            propertyId,
            out var existing);
        if (notEditable is not null) return (null, notEditable);

        var errors = WorkOrderValidator.ValidatePropertyBourse(request);
        if (errors.Count > 0) return (null, errors);

        var bourseNow = _time.UtcNow();
        var (applyErrors, boundariesUnavailable) = WorkOrderPropertyWriteRules.ApplyBourseRequest(
            existing!,
            request,
            bourseNow);
        if (applyErrors is not null) return (null, applyErrors);

        await _db.SaveChangesAsync(cancellationToken);

        if (boundariesUnavailable)
        {
            var specialist = await _labels.ResolveAsync(
                entity.AssignmentSpecialist ?? DocumentaryWorkflowRules.SystemRaiserRole,
                cancellationToken);
            await _failures.EnsureSystemInternalFailureAsync(
                IWorkOrderLoader.NormalizePo(poNumber),
                propertyId.ToString(),
                existing!.DeedNumber,
                "unknown-boundaries",
                "عدم معرفة حدود العقار",
                "توفر الحدود = غير متوفرة حسب استعلام البورصة.",
                specialist,
                cancellationToken);
        }

        await _timeline.RecordAsync(
            IWorkOrderLoader.NormalizePo(poNumber),
            propertyId,
            "property-bourse",
            "بيانات البورصة للعقار",
            WorkOrderPropertyWriteRules.BourseTimelineLocation(existing!.City, existing.District),
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
        var (reasonError, trimmedReason) = WorkOrderPropertyWriteRules.ValidateDeleteReason(reason);
        if (reasonError is not null) return (false, reasonError);

        var entity = await _loader.LoadAsync(poNumber, cancellationToken);
        if (entity is null) return (false, "أمر العمل غير موجود");

        var prop = entity.Properties.FirstOrDefault(p => p.Id == propertyId);
        if (prop is null) return (false, "العقار غير موجود");
        if (prop.IsRemoved) return (false, "العقار محذوف مسبقاً");

        prop.IsRemoved = true;
        prop.RemovalReason = trimmedReason;
        prop.RemovedAtUtc = _time.UtcNow();
        entity.ExpectedPropertyCount = WorkOrderPropertyWriteRules.ExpectedCountAfterRemoval(
            entity.ExpectedPropertyCount);

        await _db.SaveChangesAsync(cancellationToken);
        return (true, null);
    }

    public WorkOrderProperty MapPropertyEnfath(
        WorkOrderPropertyDto dto,
        Guid workOrderId,
        bool forInsert) =>
        WorkOrderPropertyWriteRules.NewPropertyFromEnfath(dto, workOrderId, forInsert);

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

        var rows = WorkOrderPropertyWriteRules.BuildContacts(propertyId, contacts);
        if (rows.Count == 0) return;

        _db.PropertyContacts.AddRange(rows);
        await _db.SaveChangesAsync(cancellationToken);
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

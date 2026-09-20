using RealEstateEval.CaseStudy.Application.Mapping;
using Microsoft.Extensions.DependencyInjection;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Application.Rules;

namespace RealEstateEval.CaseStudy.Application.Services;

public sealed class WorkOrderPropertyCommands : IWorkOrderPropertyCommands
{
    private readonly IWorkOrderPropertyRepository _db;
    private readonly ICaseStudyFailureGate _failureGate;
    private readonly IUserLabelLookup _labels;
    private readonly IWorkOrderLoader _loader;
    private readonly IPropertyTimelineService _timeline;
    private readonly INotificationService _notifications;
    private readonly INotificationRecipientResolver _recipients;
    private readonly TimeProvider _time;

    [ActivatorUtilitiesConstructor]
    public WorkOrderPropertyCommands(
        IWorkOrderPropertyRepository db,
        ICaseStudyFailureGate failureGate,
        IUserLabelLookup labels,
        IWorkOrderLoader loader,
        IPropertyTimelineService timeline,
        INotificationService notifications,
        INotificationRecipientResolver recipients,
        TimeProvider? time = null)
    {
        _time = time ?? TimeProvider.System;

        _db = db;
        _failureGate = failureGate;
        _labels = labels;
        _loader = loader;
        _timeline = timeline;
        _notifications = notifications;
        _recipients = recipients;
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
            WorkOrderPropertyWriteRules.DeedTakenProbe(entity),
            SeedClientIds.ClientFieldPolicyForClient(
                entity.ClientId,
                WorkOrderReportUsers.Parse(entity.ReportUserClientIdsJson)));
        if (errors.Count > 0) return (null, errors);

 // Never trust client ids on insert — draft ids make EF emit UPDATE and fail with 0 rows.
        property.Id = null;

        var mapped = MapPropertyEnfath(property, entity.Id, forInsert: true);
 // Numbering workshop (decision items 2 and 5): transaction reference number assigned on add.
        var (transactionReference, referenceError) =
            await _db.AllocateTransactionReferenceAsync(_time.UtcNow(), cancellationToken);
        if (referenceError is not null)
            return (null, new Dictionary<string, string> { ["_"] = referenceError });
        mapped.ReferenceNumber = transactionReference;
        _db.AddProperty(mapped);
        await _db.SaveChangesAsync(cancellationToken);
        return (WorkOrderMapper.ToPropertyDto(mapped), null);
    }

    public async Task<(WorkOrderPropertyDto? Result, Dictionary<string, string>? Errors)> UpdatePropertyAsync(
        string poNumber,
        Guid propertyId,
        WorkOrderPropertyDto property,
        CancellationToken cancellationToken,
        bool softDraft = false)
    {
        var entity = await _loader.LoadAsync(poNumber, cancellationToken);
        if (entity is null) return (null, WorkOrderPropertyWriteRules.WorkOrderNotFound());

        var notEditable = WorkOrderPropertyWriteRules.FindEditableProperty(
            entity,
            propertyId,
            out var existing);
        if (notEditable is not null) return (null, notEditable);

        var previousLocationMapUrl = existing!.LocationMapUrl;
        // Recorded once, only for the plain حفظ (not autosave, not the bourse-complete
        // save — that path already writes its own "بيانات البورصة للعقار" row).
        var recordEnfathCompletion = false;

        if (softDraft)
        {
            // Field autosave: persist mid-edit without required-field gates and without
            // completing البورصة. Explicit save / bourse complete still validate fully.
            WorkOrderPropertyWriteRules.ApplyPropertyEnfath(existing, property);
            WorkOrderPropertyWriteRules.ApplyPropertyBourseDraft(existing, property);
        }
        else
        {
            var enfathErrors = WorkOrderValidator.ValidatePropertyEnfath(
                property,
                entity.AssignmentType,
                entity.PoNumber,
                propertyId,
                WorkOrderPropertyWriteRules.DeedTakenProbe(entity),
                SeedClientIds.ClientFieldPolicyForClient(
                    entity.ClientId,
                    WorkOrderReportUsers.Parse(entity.ReportUserClientIdsJson)));

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
                }, WorkOrderValidator.CompactRegisteredTitleBourse(
                    property.IdentifierType,
                    property.RealEstateRegNumber));
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
                recordEnfathCompletion = true;
            }
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
        catch (PersistenceConcurrencyException ex)
        {
            return (null, WorkOrderPropertyWriteRules.ConcurrencyErrors(ex.ConflictingEntries));
        }
        await ApplyDocumentarySideEffectsAfterPropertySaveAsync(
            entity,
            existing,
            previousLocationMapUrl,
            cancellationToken);

        if (recordEnfathCompletion)
        {
            var po = IWorkOrderLoader.NormalizePo(poNumber);
            // EventKey dedupes at the DB level — later re-saves of the same property
            // silently no-op here instead of piling up repeat rows.
            await _timeline.RecordAsync(
                po,
                propertyId,
                "property-enfath",
                "إتمام البيانات الأولية",
                null,
                PropertyTimelineTones.Done,
                _time.UtcNow(),
                cancellationToken);
            var deedRef = existing.DeedNumber.Trim();
            await NotifyCdoPropertyMilestoneAsync(
                po,
                propertyId,
                "إتمام البيانات الأولية",
                deedRef.Length > 0
                    ? $"اكتملت البيانات الأولية للعقار على الصك {deedRef} — أمر العمل {po}."
                    : $"اكتملت البيانات الأولية لعقار على أمر العمل {po}.",
                $"property-enfath-completed:{propertyId:N}",
                cancellationToken);
        }

        var saved = await _db.GetSavedPropertyWithContactsAsync(propertyId, cancellationToken);
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

        var extrasErrors = SpecialistReportExtrasRules.ApplyFromWireJson(
            existing!,
            specialistReportExtrasJson);
        if (extrasErrors is not null) return (null, extrasErrors);

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

        var errors = WorkOrderValidator.ValidatePropertyBourse(
            request,
            WorkOrderValidator.CompactRegisteredTitleBourse(
                PropertyIdentifierTypeLabels.ToApiValue(existing!.IdentifierType),
                existing.RealEstateRegNumber));
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
            await _failureGate.EnsureSystemFailureAsync(
                IWorkOrderLoader.NormalizePo(poNumber),
                propertyId.ToString(),
                existing!.DeedNumber,
                "unknown-boundaries",
                "عدم معرفة حدود العقار",
                "توفر الحدود = غير متوفرة حسب استعلام البورصة.",
                specialist,
                cancellationToken);
        }

        var bourseNormPo = IWorkOrderLoader.NormalizePo(poNumber);
        await _timeline.RecordAsync(
            bourseNormPo,
            propertyId,
            "property-bourse",
            "بيانات البورصة للعقار",
            WorkOrderPropertyWriteRules.BourseTimelineLocation(existing!.City, existing.District),
            PropertyTimelineTones.Done,
            bourseNow,
            cancellationToken);
        var bourseDeedRef = existing.DeedNumber.Trim();
        await NotifyCdoPropertyMilestoneAsync(
            bourseNormPo,
            propertyId,
            "اكتمل استعلام البورصة",
            bourseDeedRef.Length > 0
                ? $"اكتمل استعلام البورصة للعقار على الصك {bourseDeedRef} — أمر العمل {bourseNormPo}."
                : $"اكتمل استعلام البورصة لعقار على أمر العمل {bourseNormPo}.",
            $"property-bourse-completed:{propertyId:N}",
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
        _db.DetachContacts(entity.Contacts.ToList());
        entity.Contacts.Clear();
    }

    /// <summary>CDO / super-admin oversight feed — same broadcast shape wherever a property
    /// milestone (إنفاذ save, بورصة completion) finishes here.</summary>
    private async Task NotifyCdoPropertyMilestoneAsync(
        string poNumber,
        Guid propertyId,
        string title,
        string body,
        string sourceEvent,
        CancellationToken cancellationToken)
    {
        var cdoUserIds = await _recipients.ResolveUserIdsWithPrototypeRoleAsync(
            "cdo",
            cancellationToken);
        if (cdoUserIds.Count == 0) return;

        await _notifications.CreateForUsersAsync(
            cdoUserIds,
            new CreateUserNotificationRequest
            {
                Title = title,
                Body = body,
                Tone = "info",
                Href = $"/po/{Uri.EscapeDataString(poNumber)}/property/{propertyId:D}",
                Category = "workflow",
                EntityType = "property",
                EntityId = propertyId.ToString(),
                SourceEvent = sourceEvent,
            },
            cancellationToken);
    }

    private async Task RewritePropertyContactsAsync(
        Guid propertyId,
        IEnumerable<PropertyContactDto> contacts,
        CancellationToken cancellationToken)
    {
        var rows = WorkOrderPropertyWriteRules.BuildContacts(propertyId, contacts);
        await _db.ReplaceContactsAsync(propertyId, rows, cancellationToken);
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
            await _failureGate.EnsureSystemFailureAsync(
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
            await _failureGate.EnsureSystemFailureAsync(
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

    private Task ResolveSystemLocationFailuresAsync(
        string poNumber,
        string propertyId,
        CancellationToken cancellationToken) =>
        _failureGate.ResolveSystemFailuresAsync(
            poNumber,
            propertyId,
            "unknown-location",
            DocumentaryWorkflowRules.SystemRaiserRole,
            "تم تزويد رابط موقع الخريطة.",
            "يمكن استئناف العمل على العقار.",
            cancellationToken);
}

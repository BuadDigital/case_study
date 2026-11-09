using RealEstateEval.CaseStudy.Application.Contracts;
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
    private readonly IAuditLogWriter? _audit;
    private readonly IAuditLogAppend? _auditLog;

    [ActivatorUtilitiesConstructor]
    public WorkOrderPropertyCommands(
        IWorkOrderPropertyRepository db,
        ICaseStudyFailureGate failureGate,
        IUserLabelLookup labels,
        IWorkOrderLoader loader,
        IPropertyTimelineService timeline,
        INotificationService notifications,
        INotificationRecipientResolver recipients,
        TimeProvider? time = null,
        IAuditLogWriter? audit = null,
        IAuditLogAppend? auditLog = null)
    {
        _time = time ?? TimeProvider.System;
        _audit = audit;
        _auditLog = auditLog;

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
        CancellationToken cancellationToken,
        bool softDraft = false,
        string? actorName = null)
    {
        var entity = await _loader.LoadAsync(poNumber, cancellationToken);
        if (entity is null) return (null, WorkOrderPropertyWriteRules.WorkOrderNotFound());

        var phoneErrors = WorkOrderValidator.ValidateContactPhoneLengths(property.Contacts);
        if (phoneErrors.Count > 0) return (null, phoneErrors);

        // A slot opened by the specialist becomes a real property at once
        // (draft, no gate) so its documents are stored under the real id from the first upload;
        // the explicit حفظ validates fully, as before.
        if (!softDraft)
        {
            var errors = WorkOrderValidator.ValidatePropertyEnfath(
                property,
                entity.AssignmentType,
                null,
                WorkOrderPropertyWriteRules.DeedTakenProbe(entity),
                SeedClientIds.ClientFieldPolicyForClient(
                    entity.ClientId,
                    WorkOrderReportUsers.Parse(entity.ReportUserClientIdsJson)));
            if (errors.Count > 0) return (null, errors);
        }

 // Never trust client ids on insert — draft ids make EF emit UPDATE and fail with 0 rows.
        property.Id = null;

        var mapped = MapPropertyEnfath(property, entity.Id, forInsert: true);
        // A deed added later opens its own transaction as well. An opened slot (softDraft) has no
        // number yet; a full save here (the offline insert-on-save path) is the first full save of the
        // initial data, so the deed takes its PR number now (ruling 2026-11-08).
        var now = _time.UtcNow();
        mapped.Transaction = Transaction.Create(now);
        mapped.TransactionId = mapped.Transaction.Id;
        mapped.Transaction.Properties.Add(mapped);
        if (!softDraft && await NumberDeedAsync(mapped, now, cancellationToken) is { } numberError)
            return (null, numberError);
        _db.AddProperty(mapped);
        await _db.SaveChangesAsync(cancellationToken);
        // A property registered after the PO was created (the usual path) starts its timeline with the Enfaz receipt.
        await _timeline.RecordManyAsync([WorkOrderService.EnfathReceivedEvent(entity, mapped.Id, actorName)], cancellationToken);
        return (WorkOrderMapper.ToPropertyDto(mapped), null);
    }

    /// <summary>
    /// Draws the deed's PR number at its first full save of the initial data (ruling 2026-11-08); null
    /// when numbered (or already numbered), else the error dictionary to hand back.
    /// </summary>
    /// <remarks>
    /// How it works: a deed that already has a number is left alone; otherwise draws the next yearly
    /// PR-{YY}-{seq} and stores it with <see cref="WorkOrderProperty.AssignReferenceNumber"/>, which also
    /// refreshes the property number on the loaded transaction (single → the deed's number).
    /// Edge cases: a later save never re-draws; a counter error stops the save with an Arabic reason, so
    /// a fully saved deed is never left without its number. The number is drawn before the save — a save
    /// that then fails leaves a gap, which the ruling accepts.
    /// </remarks>
    private async Task<Dictionary<string, string>?> NumberDeedAsync(
        WorkOrderProperty deed,
        DateTime nowUtc,
        CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(deed.ReferenceNumber)) return null;
        var (number, error) = await _db.AllocateDeedReferenceAsync(nowUtc, cancellationToken);
        if (error is not null || string.IsNullOrWhiteSpace(number))
            return new Dictionary<string, string> { ["_"] = error ?? "تعذّر تخصيص رقم المعاملة." };
        deed.AssignReferenceNumber(number, nowUtc);
        return null;
    }

    /// <summary>
    /// The review lock on the deed's transaction (Omar 2026-11-05), as the error dictionary to hand
    /// back, or null when the actor may write.
    /// </summary>
    /// <remarks>
    /// How it works: `WorkOrderPropertyWriteRules.ReviewLockError` on the deed's loaded transaction.
    /// Edge cases: a call without an actor (an internal writer) is not locked; a deed not yet in a
    /// transaction is with the study.
    /// </remarks>
    private static Dictionary<string, string>? ReviewLocked(WorkOrderProperty property, PartySubmissionActor? actor)
    {
        if (actor is null) return null;
        var error = WorkOrderPropertyWriteRules.ReviewLockError(property.Transaction, actor.Staff);
        return error is null ? null : new Dictionary<string, string> { ["_"] = error };
    }

    public async Task<(WorkOrderPropertyDto? Result, Dictionary<string, string>? Errors)> UpdatePropertyAsync(
        string poNumber,
        Guid propertyId,
        WorkOrderPropertyDto property,
        CancellationToken cancellationToken,
        bool softDraft = false,
        string? actorName = null,
        PartySubmissionActor? changeActor = null)
    {
        var entity = await _loader.LoadAsync(poNumber, cancellationToken);
        if (entity is null) return (null, WorkOrderPropertyWriteRules.WorkOrderNotFound());

        var notEditable = WorkOrderPropertyWriteRules.FindEditableProperty(
            entity,
            propertyId,
            out var existing);
        if (notEditable is not null) return (null, notEditable);
        if (ReviewLocked(existing!, changeActor) is { } locked) return (null, locked);
        var beforeEdit = WorkOrderMapper.ToPropertyDto(existing!);

        // Checked on the autosave path too: a phone list wider than the column failed the whole save with a 500.
        var phoneErrors = WorkOrderValidator.ValidateContactPhoneLengths(property.Contacts);
        if (phoneErrors.Count > 0) return (null, phoneErrors);

        var previousLocationMapUrl = existing!.LocationMapUrl;
        // Recorded once, only for the plain حفظ (not autosave, not the bourse-complete
        // save — that path already writes its own "بيانات البورصة للعقار" row).
        var recordEnfathCompletion = false;

        if (softDraft)
        {
            // Field autosave: persist mid-edit without required-field gates and without
            // completing البورصة. Explicit save / bourse complete still validate fully.
            // A stale draft never blanks a completed bourse (PO-175824, 2026-11-04).
            WorkOrderPropertyWriteRules.KeepCompletedBourseOnDraft(existing, property);
            WorkOrderPropertyWriteRules.ApplyPropertyEnfath(existing, property);
            WorkOrderPropertyWriteRules.ApplyPropertyBourseDraft(existing, property);
        }
        else
        {
            var enfathErrors = WorkOrderValidator.ValidatePropertyEnfath(
                property,
                entity.AssignmentType,
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
                    property.RealEstateRegNumber),
                    // A bourse completed before «القيود» became required (A→Z 2026-11-02 #64) still saves.
                    requireRestrictionsAnswer: !existing.BourseDataCompleted);
                var errors = WorkOrderPropertyWriteRules.MergeErrors(enfathErrors, bourseErrors);
                if (errors.Count > 0) return (null, errors);
                WorkOrderPropertyWriteRules.ApplyPropertyEnfath(existing, property);
                WorkOrderPropertyWriteRules.ApplyPropertyBourse(existing, property);
                existing.BourseDataCompleted = true;
                existing.BourseCompletedAtUtc = _time.UtcNow();
                existing.BourseCompletedByName = WorkOrderPropertyWriteRules.NormalizeActorName(actorName);
            }
            else
            {
                if (enfathErrors.Count > 0) return (null, enfathErrors);
                WorkOrderPropertyWriteRules.ApplyPropertyEnfath(existing, property);
                recordEnfathCompletion = true;
            }

            // Both branches passed the full initial-data check: the first one numbers the deed.
            if (await NumberDeedAsync(existing, _time.UtcNow(), cancellationToken) is { } numberError)
                return (null, numberError);
        }

 // Never mix contact DELETE/INSERT with property UPDATE in one SaveChanges —
 // EF/Npgsql rewrites collection replaces into DELETE+UPDATE and throws
 // DbUpdateConcurrencyException (0 rows). Detach contacts, save scalars, then
 // rewrite contacts with ExecuteDelete + insert.
        DetachTrackedContacts(existing);

        try
        {
            // One transaction: a failing contact insert used to leave the property saved and its
            // contacts already deleted (2026-10-28).
            await _db.ExecuteInTransactionAsync(async ct =>
            {
                await _db.SaveChangesAsync(ct);
                await RewritePropertyContactsAsync(existing.Id, property.Contacts, ct);
            }, cancellationToken);
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
                WorkOrderPropertyWriteRules.PrimaryDataTimelineDetail(actorName),
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
        var savedDto = WorkOrderMapper.ToPropertyDto(saved);
        await AppendFieldChangesAsync(beforeEdit, savedDto, changeActor, actorName, softDraft, cancellationToken);
        return (savedDto, null);
    }

    /// <summary>
    /// Writes the field change log of one property save (ruling 2026-11-02: everyone who may edit
    /// property data leaves a trail for oversight).
    /// </summary>
    /// <remarks>
    /// How it works: diffs the property before the save against the saved one
    /// (<see cref="PropertyFieldChangeRules.Diff"/>) and appends one audit row — before/after of each
    /// changed field, plus the actor's role and case-specialist sub-roles in the after-side.
    /// Edge cases: nothing changed (an autosave that rewrote the same values) → no row; no audit
    /// ports (tests, tools) → no row; the row is best effort and never fails the save, which is
    /// already committed.
    /// </remarks>
    private async Task AppendFieldChangesAsync(
        WorkOrderPropertyDto before,
        WorkOrderPropertyDto after,
        PartySubmissionActor? actor,
        string? actorName,
        bool autosave,
        CancellationToken cancellationToken)
    {
        if (_audit is null || _auditLog is null || after.Id is not Guid propertyId) return;
        var changes = PropertyFieldChangeRules.Diff(before, after);
        if (changes.Count == 0) return;

        try
        {
            await _auditLog.AppendAsync(_audit.Create(
                actorId: string.IsNullOrWhiteSpace(actor?.UserId) ? "unknown" : actor.UserId.Trim(),
                action: PropertyFieldChangeRules.AuditAction,
                entityType: PropertyFieldChangeRules.AuditEntityType,
                entityId: propertyId.ToString("D"),
                before: changes.ToDictionary(c => c.Key, c => c.Value.Before),
                after: new
                {
                    fields = changes.ToDictionary(c => c.Key, c => c.Value.After),
                    actorName = actor?.DisplayName ?? actorName,
                    actorRole = actor?.PrototypeRole,
                    actorSubRoles = actor?.SubRoles ?? [],
                    autosave,
                }), cancellationToken);
        }
        catch (Exception)
        {
            // Best effort: the property save is committed; a lost audit row must not undo it.
        }
    }


    public async Task<(WorkOrderPropertyDto? Result, Dictionary<string, string>? Errors)> UpdateSpecialistReportExtrasAsync(
        string poNumber,
        Guid propertyId,
        string? specialistReportExtrasJson,
        CancellationToken cancellationToken,
        PartySubmissionActor? actor = null)
    {
        var entity = await _loader.LoadAsync(poNumber, cancellationToken);
        if (entity is null) return (null, WorkOrderPropertyWriteRules.WorkOrderNotFound());

        var notEditable = WorkOrderPropertyWriteRules.FindEditableProperty(
            entity,
            propertyId,
            out var existing);
        if (notEditable is not null) return (null, notEditable);
        if (ReviewLocked(existing!, actor) is { } reviewLocked) return (null, reviewLocked);

        var previousExtras = SpecialistReportExtrasRules.ToWireJson(existing!);
        var extrasErrors = SpecialistReportExtrasRules.ApplyFromWireJson(
            existing!,
            specialistReportExtrasJson);
        if (extrasErrors is not null) return (null, extrasErrors);
        existing!.SpecialistReportExtrasProvenanceJson = PartyFieldProvenance.Stamp(
            existing.SpecialistReportExtrasProvenanceJson,
            previousExtras,
            SpecialistReportExtrasRules.ToWireJson(existing) ?? "{}",
            actor,
            _time.UtcNow());

        await _db.SaveChangesAsync(cancellationToken);
        return (WorkOrderMapper.ToPropertyDto(existing), null);
    }

    public async Task<(WorkOrderPropertyDto? Result, Dictionary<string, string>? Errors)> CompleteBourseDataAsync(
        string poNumber,
        Guid propertyId,
        UpdatePropertyBourseRequest request,
        CancellationToken cancellationToken,
        string? actorName = null,
        PartySubmissionActor? changeActor = null)
    {
        var entity = await _loader.LoadAsync(poNumber, cancellationToken);
        if (entity is null) return (null, WorkOrderPropertyWriteRules.WorkOrderNotFound());

        var notEditable = WorkOrderPropertyWriteRules.FindEditableProperty(
            entity,
            propertyId,
            out var existing);
        if (notEditable is not null) return (null, notEditable);
        if (ReviewLocked(existing!, changeActor) is { } reviewLocked) return (null, reviewLocked);
        var beforeBourse = WorkOrderMapper.ToPropertyDto(existing!);

        var errors = WorkOrderValidator.ValidatePropertyBourse(
            request,
            WorkOrderValidator.CompactRegisteredTitleBourse(
                PropertyIdentifierTypeLabels.ToApiValue(existing!.IdentifierType),
                existing.RealEstateRegNumber));
        if (errors.Count > 0) return (null, errors);

        var bourseNow = _time.UtcNow();
        var bourseWasCompleted = existing.BourseDataCompleted;
        var applyErrors = WorkOrderPropertyWriteRules.ApplyBourseRequest(
            existing!,
            request,
            bourseNow,
            actorName);
        if (applyErrors is not null) return (null, applyErrors);

        await _db.SaveChangesAsync(cancellationToken);
        // The first completion is the bourse's own entry (its timeline row says so); a re-save edits it.
        if (bourseWasCompleted)
        {
            await AppendFieldChangesAsync(
                beforeBourse,
                WorkOrderMapper.ToPropertyDto(existing),
                changeActor,
                actorName,
                autosave: false,
                cancellationToken);
        }

        // «توفر الحدود = غير متوفرة» is a valid bourse answer, not a failure: nothing is raised for it.
        var bourseNormPo = IWorkOrderLoader.NormalizePo(poNumber);
        // One milestone per COMPLETION: a re-save of a completed bourse adds nothing, a bourse redone after a
        // revert adds a new row (a bourse that answers «الحدود غير متوفرة» completes like any other).
        if (existing!.BourseDataCompleted && !bourseWasCompleted)
        {
            await _timeline.RecordAsync(
                bourseNormPo,
                propertyId,
                $"property-bourse:{bourseNow.Ticks}",
                "إتمام استعلام البورصة",
                WorkOrderPropertyWriteRules.BourseTimelineDetail(
                    existing.City, existing.District, existing.BourseCompletedByName),
                PropertyTimelineTones.Done,
                bourseNow,
                cancellationToken);
        }
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

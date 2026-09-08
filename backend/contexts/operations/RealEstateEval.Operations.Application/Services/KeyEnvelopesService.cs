using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Operations.Application.Abstractions;
using RealEstateEval.Operations.Application.Contracts;
using RealEstateEval.Operations.Application.Rules;
using RealEstateEval.Operations.Domain;

namespace RealEstateEval.Operations.Application.Services;

/// <summary>
/// Key-envelope use cases: registration, field assignment confirmation, handoffs, court-access
/// records, and the receipt-fee report. Persistence goes through
/// <see cref="IKeyEnvelopeRepository"/>, so this file holds workflow only - no EF
/// (solid-scorecard finding 1). Handoffs live in <c>KeyEnvelopesService.Handoffs.cs</c>,
/// DTO projection with linked properties in <c>KeyEnvelopesService.LinkedProperties.cs</c>.
/// </summary>
public sealed partial class KeyEnvelopesService : IKeyEnvelopesService
{
    private const int MaxListRows = 500;
    private static readonly JsonSerializerOptions JsonOpts = JsonDefaults.CamelCaseInsensitive;

    private readonly IKeyEnvelopeRepository _repo;
    private readonly ICaseStudyLookup _caseStudy;
    private readonly IKeyReceiptFeeChargeService _keyFees;
    private readonly IKeyAttachmentLookup _attachments;
    private readonly IPropertyAccessHoldService _holds;
    private readonly IKeyEnvelopePeopleResolver _people;
    private readonly INotificationService _notifications;
    private readonly INotificationRecipientResolver _recipients;
    private readonly TimeProvider _time;

    [ActivatorUtilitiesConstructor]
    public KeyEnvelopesService(
        IKeyEnvelopeRepository repo,
        ICaseStudyLookup caseStudy,
        IKeyReceiptFeeChargeService keyFees,
        IKeyAttachmentLookup attachments,
        IPropertyAccessHoldService holds,
        IKeyEnvelopePeopleResolver people,
        INotificationService notifications,
        INotificationRecipientResolver recipients,
        TimeProvider? time = null)
    {
        _time = time ?? TimeProvider.System;

        _repo = repo;
        _caseStudy = caseStudy;
        _keyFees = keyFees;
        _attachments = attachments;
        _holds = holds;
        _people = people;
        _notifications = notifications;
        _recipients = recipients;
    }

    public async Task<IReadOnlyList<KeyEnvelopeDto>> ListAsync(
        CancellationToken cancellationToken = default)
    {
        var rows = await _repo.ListRecentAsync(MaxListRows, cancellationToken);
        return await MapManyAsync(rows, cancellationToken);
    }

    public async Task<KeyEnvelopeDto?> GetAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var row = await _repo.GetWithDetailsAsync(id, cancellationToken);
        if (row is null) return null;
        var linked = await LoadLinkedAsync(row.RequestNumber, cancellationToken);
        var dto = KeyEnvelopeMapper.ToDto(row, linked);
        return await _people.WithResolvedPeopleAsync(dto, cancellationToken);
    }

    public Task<IReadOnlyList<KeyEnvelopeLinkedPropertyDto>> ListLinkedPropertiesAsync(
        string requestNumber,
        CancellationToken cancellationToken = default)
        => LoadLinkedAsync(requestNumber.Trim(), cancellationToken);

    public async Task<bool> DeleteAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var envelope = await _repo.FindWithChildrenAsync(id, cancellationToken);
        if (envelope is null) return false;

 // The fee charge is intentionally independent of the envelope FK,
 // so remove it explicitly. Assignments, handoffs, and timeline entries
 // are deleted through the envelope cascade configuration.
        await _keyFees.DeleteForEnvelopeAsync(id, cancellationToken);

        await _repo.RemoveAsync(envelope, cancellationToken);
        await _repo.SaveAndDetachAsync(cancellationToken);
        return true;
    }

    public async Task<(KeyEnvelopeDto? Envelope, string? Error)> CreateAsync(
        CreateKeyEnvelopeRequest request,
        string actorUserId,
        string actorDisplayName,
        CancellationToken cancellationToken = default)
    {
        actorDisplayName = await _people.ResolveActorDisplayNameAsync(
            actorUserId,
            actorDisplayName,
            cancellationToken);
        var requestNumber = request.RequestNumber.Trim();
        var court = request.Court.Trim();
        var circuit = request.Circuit.Trim();
        var scenario = KeyEnvelopeLifecycleRules.NormalizeScenario(request.ReceiveScenario);
        var validationError = KeyEnvelopeRegistrationRules.ValidateRegistration(request, scenario);
        if (validationError is not null) return (null, validationError);

        foreach (var (attachmentId, missingError) in
                 KeyEnvelopeRegistrationRules.AttachmentsToVerify(request))
        {
            if (!await AttachmentExistsAsync(attachmentId, cancellationToken))
                return (null, missingError);
        }

        Guid? operationsTaskId = null;
        if (request.OperationsTaskId is { } linkedTaskId && linkedTaskId != Guid.Empty)
        {
            var linkError = await ValidateCourtVisitTaskLinkAsync(linkedTaskId, cancellationToken);
            if (linkError is not null) return (null, linkError);
            operationsTaskId = linkedTaskId;
        }

        var now = _time.UtcNow();
        var entity = KeyEnvelope.Create(
            Guid.NewGuid(),
            requestNumber,
            court,
            circuit,
            request.KeysCountLabeled,
            request.KeysCountActual,
            scenario,
            actorUserId,
            actorDisplayName.Trim(),
            now,
            KeyEnvelopeRegistrationRules.EmptyToNull(request.ReceiptAttachmentId),
            KeyEnvelopeRegistrationRules.EmptyToNull(request.PhotoAttachmentId),
            KeyEnvelopeRegistrationRules.EmptyToNull(request.ThirdPartyLetterAttachmentId),
            Texts.NullIfBlank(request.ContactPhones),
            Texts.NullIfBlank(request.Notes),
            operationsTaskId);

 // Numbering session (bit lines 2 and 5): The envelope reference number is assigned at registration and displayed.
        var (referenceNumber, referenceError) =
            await _repo.AllocateReferenceNumberAsync(now, cancellationToken);
        if (referenceError is not null) return (null, referenceError);
        entity.ReferenceNumber = referenceNumber;

        foreach (var item in request.Assignments ?? [])
        {
            var deed = item.DeedNumber.Trim();
            if (deed.Length == 0) continue;
            entity.AddPendingAssignment(
                Guid.NewGuid(),
                deed,
                item.PropertyId,
                Texts.NullIfBlank(item.Notes),
                now);
        }

        AddTimelineOnCreate(
            entity,
            KeyEnvelopeTimelineEvents.Created,
            KeyEnvelopeLifecycleRules.ScenarioCreatedSummary(scenario),
            actorUserId,
            actorDisplayName,
            now);

        if (scenario == KeyReceiveScenarios.Court)
        {
 // Receipt revenue is billed to Enfaz by finance, not owed to a party at a configured rate,
 // so registration marks the entitlement and stops there. Stamping an amount from the
 // pricing table produced a figure nobody had agreed to bill.
            entity.MarkCourtRevenueEntitlement(now);
            AddTimelineOnCreate(
                entity,
                KeyEnvelopeTimelineEvents.RevenueEntitlement,
                "استحقاق إيراد استلام المفاتيح — المبلغ تُدخله المالية عند فوترة إنفاذ",
                actorUserId,
                actorDisplayName,
                now);
        }

        await _repo.AddAsync(entity, cancellationToken);
        await SaveAndDetachAsync(cancellationToken);
        return (await GetAsync(entity.Id, cancellationToken), null);
    }

    public async Task<(KeyEnvelopeDto? Envelope, string? Error)> AddAssignmentAsync(
        Guid envelopeId,
        AddKeyEnvelopeAssignmentRequest request,
        string actorUserId,
        string actorDisplayName,
        CancellationToken cancellationToken = default)
    {
        var entity = await LoadTrackedAsync(envelopeId, cancellationToken);
        if (entity is null) return (null, "الظرف غير موجود");

        var deed = request.DeedNumber.Trim();
        if (deed.Length == 0) return (null, "رقم الصك مطلوب");

        if (KeyEnvelopeRegistrationRules.IsDeedAlreadyAssigned(entity, deed))
            return (null, "الصك مُسند مسبقاً في هذا الظرف");

        var now = _time.UtcNow();
        entity.AddPendingAssignment(
            Guid.NewGuid(),
            deed,
            request.PropertyId,
            Texts.NullIfBlank(request.Notes),
            now);
        await AddTimelineAsync(
            entity.Id,
            KeyEnvelopeTimelineEvents.AssignmentAdded,
            $"إسناد مبدئي للصك {deed}",
            actorUserId,
            actorDisplayName,
            now,
            cancellationToken);

        await SaveAndDetachAsync(cancellationToken);

        if (request.PropertyId is Guid assignedPropertyId)
        {
            await NotifyCaseSpecialistForPropertyAsync(
                assignedPropertyId,
                "إسناد مفتاح لعقارك",
                $"سُجّل إسناد مبدئي لمفتاح الصك {deed} — بانتظار التأكيد الميداني.",
                $"key-assignment-added:{envelopeId}:{deed}",
                cancellationToken);
        }

        return (await GetAsync(envelopeId, cancellationToken), null);
    }

    public async Task<(KeyEnvelopeDto? Envelope, string? Error)> ConfirmAssignmentAsync(
        Guid envelopeId,
        Guid assignmentId,
        ConfirmKeyAssignmentRequest request,
        string actorUserId,
        string actorDisplayName,
        CancellationToken cancellationToken = default)
    {
        actorDisplayName = await _people.ResolveActorDisplayNameAsync(
            actorUserId,
            actorDisplayName,
            cancellationToken);
        var entity = await LoadTrackedAsync(envelopeId, cancellationToken);
        if (entity is null) return (null, "الظرف غير موجود");

        var assignment = entity.Assignments.FirstOrDefault(a => a.Id == assignmentId);
        if (assignment is null) return (null, "الإسناد غير موجود");

        var status = request.Status.Trim().ToLowerInvariant();
        if (!KeyAssignmentStatuses.IsConfirmResult(status))
            return (null, "حالة الإسناد غير صالحة — اختر نتيجة المطابقة الميدانية");

        var now = _time.UtcNow();
        var deedNumber = assignment.DeedNumber;
        var unmatchedPropertyId = assignment.PropertyId;
        entity.ConfirmAssignmentField(
            assignment,
            status,
            Texts.NullIfBlank(request.Notes),
            actorUserId,
            actorDisplayName.Trim(),
            now);
        await AddTimelineAsync(
            entity.Id,
            KeyEnvelopeTimelineEvents.AssignmentConfirmed,
            $"تأكيد ميداني للصك {deedNumber}: {KeyEnvelopeLifecycleRules.AssignmentResultTimelineLabel(status)}",
            actorUserId,
            actorDisplayName,
            now,
            cancellationToken);

        await SaveAndDetachAsync(cancellationToken);

        if (KeyAssignmentStatuses.IsUnmatchedOutcome(status) && unmatchedPropertyId is Guid unmatchedPid)
        {
            await _holds.EnsureKeyUnmatchedFailureAsync(
                unmatchedPid,
                deedNumber,
                actorDisplayName,
                cancellationToken);
        }
        else if (unmatchedPropertyId is Guid matchedPropertyId)
        {
            await NotifyCaseSpecialistForPropertyAsync(
                matchedPropertyId,
                "تأكيد مفتاح العقار",
                $"تم تأكيد مطابقة مفتاح الصك {deedNumber} ميدانياً.",
                $"key-assignment-confirmed:{envelopeId}:{deedNumber}",
                cancellationToken);
        }

        return (await GetAsync(envelopeId, cancellationToken), null);
    }

    private Task SaveAndDetachAsync(CancellationToken cancellationToken) =>
        _repo.SaveAndDetachAsync(cancellationToken);

    private Task<KeyEnvelope?> LoadTrackedAsync(
        Guid id,
        CancellationToken cancellationToken) =>
        _repo.FindWithAssignmentsAsync(id, cancellationToken);

    private Task<KeyEnvelope?> LoadEnvelopeOnlyAsync(
        Guid id,
        CancellationToken cancellationToken) =>
        _repo.FindAsync(id, cancellationToken);

    private Task AddTimelineAsync(
        Guid envelopeId,
        string eventType,
        string summary,
        string actorUserId,
        string actorDisplayName,
        DateTime at,
        CancellationToken cancellationToken) =>
        _repo.AddTimelineEntryAsync(
            new KeyEnvelopeTimelineEntry
            {
                Id = Guid.NewGuid(),
                EnvelopeId = envelopeId,
                EventType = eventType,
                Summary = summary,
                ActorUserId = actorUserId,
                ActorName = actorDisplayName.Trim(),
                CreatedAtUtc = at,
            },
            cancellationToken);

    private static void AddTimelineOnCreate(
        KeyEnvelope entity,
        string eventType,
        string summary,
        string actorUserId,
        string actorDisplayName,
        DateTime at) =>
        entity.Timeline.Add(new KeyEnvelopeTimelineEntry
        {
            Id = Guid.NewGuid(),
            EnvelopeId = entity.Id,
            EventType = eventType,
            Summary = summary,
            ActorUserId = actorUserId,
            ActorName = actorDisplayName.Trim(),
            CreatedAtUtc = at,
        });

    private Task<bool> AttachmentExistsAsync(
        Guid id,
        CancellationToken cancellationToken) =>
        _attachments.ExistsAsync(id, cancellationToken);

 /// <summary>
 /// Resolves the case specialist for a property's case-study parent task and
 /// notifies them — the specialist is the one waiting on the key to unblock
 /// field work, but had no visibility into key-envelope changes before this.
 /// </summary>
    private async Task NotifyCaseSpecialistForPropertyAsync(
        Guid propertyId,
        string title,
        string body,
        string sourceEvent,
        CancellationToken cancellationToken)
    {
        var specialistAssigneeId = await _caseStudy.GetCaseSpecialistAssigneeAsync(
            propertyId,
            cancellationToken);
        if (string.IsNullOrWhiteSpace(specialistAssigneeId)) return;

        var userId = await _recipients.ResolveUserIdForDistributionAssigneeAsync(
            specialistAssigneeId,
            cancellationToken);
        if (string.IsNullOrWhiteSpace(userId)) return;

        await _notifications.CreateForUserAsync(
            userId,
            new CreateUserNotificationRequest
            {
                Title = title,
                Body = body,
                Tone = "info",
                Href = "/keys",
                Category = "workflow",
                EntityType = "property",
                EntityId = propertyId.ToString(),
                SourceEvent = sourceEvent,
            },
            cancellationToken);
    }
}

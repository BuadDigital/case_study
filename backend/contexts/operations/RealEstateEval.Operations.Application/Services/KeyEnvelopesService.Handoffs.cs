using RealEstateEval.Application;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Operations.Application.Contracts;
using RealEstateEval.Operations.Application.Rules;
using RealEstateEval.Operations.Domain;

namespace RealEstateEval.Operations.Application.Services;

public sealed partial class KeyEnvelopesService
{
    public async Task<(KeyEnvelopeDto? Envelope, string? Error)> CreateHandoffAsync(
        Guid envelopeId,
        CreateKeyEnvelopeHandoffRequest request,
        string actorUserId,
        string actorDisplayName,
        CancellationToken cancellationToken = default)
    {
        actorDisplayName = await _people.ResolveActorDisplayNameAsync(
            actorUserId,
            actorDisplayName,
            cancellationToken);
        var entity = await LoadEnvelopeOnlyAsync(envelopeId, cancellationToken);
        if (entity is null) return (null, "الظرف غير موجود");

        var kind = request.Kind.Trim().ToLowerInvariant();
        if (!KeyEnvelopeRegistrationRules.IsKnownHandoffKind(kind))
            return (null, "نوع المناولة غير صالح");

        var fromParty = await _people.ResolvePartyLabelAsync(
            request.FromParty,
            actorUserId,
            cancellationToken);
        var toParty = await _people.ResolvePartyLabelAsync(
            request.ToParty,
            request.ToUserId,
            cancellationToken);
        if (fromParty.Length == 0 || toParty.Length == 0)
            return (null, "من وإلى مطلوبان");

 // HTML parity: internal / return_court / receive_back need no letter.
 // External delivery requires proof file (or explicit letter fields).
        if (KeyEnvelopeRegistrationRules.NeedsDeliveryLetter(kind))
        {
            if (!KeyEnvelopeRegistrationRules.HasAttachment(request.LetterAttachmentId))
                return (null, "ملف إثبات التسليم مطلوب");
            if (!await AttachmentExistsAsync(request.LetterAttachmentId!.Value, cancellationToken))
                return (null, "ملف إثبات التسليم غير موجود");
        }

        var now = _time.UtcNow();
        var handoff = new KeyEnvelopeHandoff
        {
            Id = Guid.NewGuid(),
            EnvelopeId = entity.Id,
            Kind = kind,
            FromParty = fromParty,
            ToParty = toParty,
            ToUserId = Texts.NullIfBlank(request.ToUserId),
            LetterNumber = Texts.NullIfBlank(request.LetterNumber),
            LetterAttachmentId = KeyEnvelopeRegistrationRules.EmptyToNull(request.LetterAttachmentId),
            Notes = Texts.NullIfBlank(request.Notes),
            Status = KeyEnvelopeRegistrationRules.InitialHandoffStatus(kind),
            CreatedByUserId = actorUserId,
            CreatedByName = actorDisplayName.Trim(),
            CreatedAtUtc = now,
        };

        if (kind != KeyHandoffKinds.Internal)
        {
            KeyEnvelopeLifecycleRules.ApplyHandoffStatus(entity, kind);
            handoff.ConfirmedAtUtc = now;
        }

        await _repo.AddHandoffAsync(handoff, cancellationToken);
        entity.Touch(now);
        await AddTimelineAsync(
            entity.Id,
            KeyEnvelopeTimelineEvents.HandoffCreated,
            KeyEnvelopeLifecycleRules.HandoffSummary(kind, fromParty, toParty),
            actorUserId,
            actorDisplayName,
            now,
            cancellationToken);

        await SaveAndDetachAsync(cancellationToken);

        var toUserId = Texts.NullIfBlank(request.ToUserId);
        if (toUserId is not null)
        {
            await _notifications.CreateForUserAsync(
                toUserId,
                new CreateUserNotificationRequest
                {
                    Title = "تسليم ظرف مفاتيح",
                    Body = $"سُلّم إليك ظرف المفاتيح {entity.RequestNumber} من {fromParty}.",
                    Tone = "info",
                    Href = "/keys",
                    Category = "workflow",
                    EntityType = "property",
                    EntityId = entity.Id.ToString(),
                    SourceEvent = $"key-handoff-created:{handoff.Id}",
                },
                cancellationToken);
        }

        return (await GetAsync(envelopeId, cancellationToken), null);
    }

    public async Task<(KeyEnvelopeDto? Envelope, string? Error)> ConfirmHandoffAsync(
        Guid envelopeId,
        Guid handoffId,
        string actorUserId,
        string actorDisplayName,
        CancellationToken cancellationToken = default)
    {
        actorDisplayName = await _people.ResolveActorDisplayNameAsync(
            actorUserId,
            actorDisplayName,
            cancellationToken);
        var entity = await LoadEnvelopeOnlyAsync(envelopeId, cancellationToken);
        if (entity is null) return (null, "الظرف غير موجود");

        var handoff = await _repo.FindHandoffAsync(envelopeId, handoffId, cancellationToken);
        if (handoff is null) return (null, "المناولة غير موجودة");
        var confirmError = KeyEnvelopeRegistrationRules.ValidateHandoffConfirmation(handoff);
        if (confirmError is not null) return (null, confirmError);

        var now = _time.UtcNow();
        handoff.Status = KeyHandoffStatuses.Confirmed;
        handoff.ConfirmedByUserId = actorUserId;
        handoff.ConfirmedByName = actorDisplayName.Trim();
        handoff.ConfirmedAtUtc = now;
        KeyEnvelopeLifecycleRules.ApplyHandoffStatus(entity, handoff.Kind);
        entity.Touch(now);
        await AddTimelineAsync(
            entity.Id,
            KeyEnvelopeTimelineEvents.HandoffConfirmed,
            $"تأكيد استلام الظرف من {handoff.ToParty}",
            actorUserId,
            actorDisplayName,
            now,
            cancellationToken);
        await AddTimelineAsync(
            entity.Id,
            KeyEnvelopeTimelineEvents.StatusChanged,
            $"حالة الظرف → {entity.Status}",
            actorUserId,
            actorDisplayName,
            now,
            cancellationToken);

        await SaveAndDetachAsync(cancellationToken);

        var createdByUserId = Texts.NullIfBlank(handoff.CreatedByUserId);
        if (createdByUserId is not null)
        {
            await _notifications.CreateForUserAsync(
                createdByUserId,
                new CreateUserNotificationRequest
                {
                    Title = "تأكيد استلام ظرف مفاتيح",
                    Body = $"أكّد {actorDisplayName.Trim()} استلام ظرف المفاتيح {entity.RequestNumber}.",
                    Tone = "success",
                    Href = "/keys",
                    Category = "workflow",
                    EntityType = "property",
                    EntityId = entity.Id.ToString(),
                    SourceEvent = $"key-handoff-confirmed:{handoff.Id}",
                },
                cancellationToken);
        }

        return (await GetAsync(envelopeId, cancellationToken), null);
    }
}

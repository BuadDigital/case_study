using RealEstateEval.Application;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Operations.Application.Contracts;
using RealEstateEval.Operations.Application.Rules;
using RealEstateEval.Operations.Domain;

namespace RealEstateEval.Operations.Application.Services;

public sealed partial class KeyEnvelopesService
{
    /// <summary>Records a move of the key envelope (internal, external, receive-back, return to court).</summary>
    /// <remarks>
    /// How it works: 1) resolves the actor's name and loads the envelope; 2) validates the kind and
    /// resolves the from / to party labels (both required); 3) external needs a proof letter that
    /// exists; 4) decides whether the actor is the receiver (receive-back with no ToUserId or ToUserId
    /// == actor); 5) builds the handoff with <see cref="KeyEnvelopeRegistrationRules.InitialHandoffStatus"/>;
    /// 6) when it is not pending, custody moves now (<c>ApplyConfirmedHandoff</c>) and the receiver
    /// self-confirms; 7) saves with a timeline line; 8) notifies ToUserId only while a confirmation is owed.
    /// Edge cases: a receive-back recorded by someone else (e.g. the inspector)
    /// stays pending until the reviewer confirms, and the holder does not change until then; a
    /// self-recorded receive-back stores the actor as ToUserId so the reviewer holder has an id.
    /// </remarks>
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
        // A receive-back the reviewer records himself is his own confirmation (he is the receiver).
        var toUserId = Texts.NullIfBlank(request.ToUserId);
        var actorIsReceiver = kind == KeyHandoffKinds.ReceiveBack
            && (toUserId is null || string.Equals(toUserId, actorUserId, StringComparison.Ordinal));
        var handoff = new KeyEnvelopeHandoff
        {
            Id = Guid.NewGuid(),
            EnvelopeId = entity.Id,
            Kind = kind,
            FromParty = fromParty,
            ToParty = toParty,
            ToUserId = toUserId ?? (actorIsReceiver ? actorUserId : null),
            LetterNumber = Texts.NullIfBlank(request.LetterNumber),
            LetterAttachmentId = KeyEnvelopeRegistrationRules.EmptyToNull(request.LetterAttachmentId),
            Notes = Texts.NullIfBlank(request.Notes),
            Status = KeyEnvelopeRegistrationRules.InitialHandoffStatus(kind, actorIsReceiver),
            CreatedByUserId = actorUserId,
            CreatedByName = actorDisplayName.Trim(),
            CreatedAtUtc = now,
        };

        if (handoff.Status != KeyHandoffStatuses.PendingConfirm)
        {
            // Custody moves now: the letter (external / court) or the reviewer's own receipt is the confirmation.
            entity.ApplyConfirmedHandoff(handoff, now);
            handoff.ConfirmedAtUtc = now;
            if (actorIsReceiver)
            {
                handoff.ConfirmedByUserId = actorUserId;
                handoff.ConfirmedByName = actorDisplayName.Trim();
            }
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

        // Notify the receiver only when a confirmation is still owed; a receipt already confirmed needs no request.
        if (toUserId is not null && handoff.Status == KeyHandoffStatuses.PendingConfirm)
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

    /// <summary>The receiver confirms a pending handoff; only then does the envelope change hands.</summary>
    /// <remarks>
    /// How it works: 1) loads the envelope and the handoff; 2) <see cref="KeyEnvelopeRegistrationRules.ValidateHandoffConfirmation"/>
    /// allows only pending internal / receive-back handoffs; 3) marks it confirmed by the actor; 4) for
    /// an internal handoff with no ToUserId, the confirming actor becomes ToUserId; 5) moves status and
    /// holder together (<c>ApplyConfirmedHandoff</c>); 6) writes two timeline lines, saves, and notifies
    /// the handoff's creator.
    /// Edge cases: receive-back now goes through this too (it used to be internal
    /// only); step 4 keeps an internal_user holder from ending up without a user id.
    /// </remarks>
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
        // The receiver confirmed: custody status and holder move together.
        if (handoff.Kind == KeyHandoffKinds.Internal && string.IsNullOrWhiteSpace(handoff.ToUserId))
            handoff.ToUserId = actorUserId;
        entity.ApplyConfirmedHandoff(handoff, now);
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

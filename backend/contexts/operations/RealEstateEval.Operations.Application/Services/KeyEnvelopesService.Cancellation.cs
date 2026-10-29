using RealEstateEval.Application;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Operations.Domain;

namespace RealEstateEval.Operations.Application.Services;

/// <summary>«إلغاء المعاملة» seen from the keys: the envelope keeps the key and records the cancelled property.</summary>
public sealed partial class KeyEnvelopesService
{
    /// <summary>
    /// Marks (or clears) every assignment of the deeds as belonging to a cancelled property, with a
    /// line in each envelope's timeline, and tells whoever holds the keys.
    /// </summary>
    /// <remarks>
    /// How it works: 1) loads every envelope holding an assignment of the deeds; 2) stamps (or clears)
    /// PropertyCancelledAtUtc on those assignments that are not already in that state; 3) one timeline
    /// line per changed assignment; 4) saves, then notifies the envelope holder and anyone holding one of
    /// those keys (with_user) — they have keys to bring back.
    /// Edge cases: the link between key and property is never removed (decision 2026-10-29); a marked
    /// pending assignment counts as settled, so the envelope can reach «ready for court return»; a key
    /// still with a user keeps the envelope from that state until it comes back. Idempotent.
    /// </remarks>
    public async Task<int> SetPropertiesCancelledAsync(
        IReadOnlyList<Guid> propertyIds,
        bool cancelled,
        string actorUserId,
        string actorDisplayName,
        CancellationToken cancellationToken = default)
    {
        var ids = propertyIds.Distinct().ToList();
        var envelopes = await _repo.FindWithAssignmentsByPropertyIdsAsync(ids, cancellationToken);
        if (envelopes.Count == 0) return 0;

        var now = _time.UtcNow();
        var changed = 0;
        var holders = new HashSet<string>(StringComparer.Ordinal);
        foreach (var envelope in envelopes)
        {
            foreach (var assignment in envelope.Assignments)
            {
                if (assignment.PropertyId is not Guid pid || !ids.Contains(pid)) continue;
                if ((assignment.PropertyCancelledAtUtc is not null) == cancelled) continue;

                assignment.PropertyCancelledAtUtc = cancelled ? now : null;
                changed++;
                if (!string.IsNullOrWhiteSpace(assignment.KeyHolderUserId))
                    holders.Add(assignment.KeyHolderUserId.Trim());
                await AddTimelineAsync(
                    envelope.Id,
                    cancelled ? KeyEnvelopeTimelineEvents.PropertyCancelled : KeyEnvelopeTimelineEvents.PropertyReactivated,
                    cancelled
                        ? $"أُلغيت معاملة الصك {assignment.DeedNumber} — المفتاح يخص عقاراً ملغى"
                        : $"أُعيد تفعيل معاملة الصك {assignment.DeedNumber}",
                    actorUserId,
                    actorDisplayName,
                    now,
                    cancellationToken);
            }

            if (!string.IsNullOrWhiteSpace(envelope.HolderUserId))
                holders.Add(envelope.HolderUserId.Trim());
        }

        if (changed == 0) return 0;
        await SaveAndDetachAsync(cancellationToken);

        if (cancelled && holders.Count > 0)
        {
            try
            {
                await _notifications.CreateForUsersAsync(
                    holders.ToList(),
                    new CreateUserNotificationRequest
                    {
                        Title = "مفتاح لعقار ملغى",
                        Body = "أُلغيت معاملة عقار مفتاحه في ظرف بعهدتك — أرجِع المفتاح إلى الظرف.",
                        Tone = "warn",
                        Href = "/keys",
                        Category = "workflow",
                        EntityType = "property",
                        EntityId = ids[0].ToString(),
                        SourceEvent = $"key-property-cancelled:{string.Join(",", ids.Order())}:{now.Ticks}",
                    },
                    cancellationToken);
            }
            catch
            {
                // The envelope record is saved; a missed notice does not undo it.
            }
        }

        return changed;
    }
}

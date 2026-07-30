using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Infrastructure.Services;

public sealed class KeyEnvelopePeopleResolver : IKeyEnvelopePeopleResolver
{
    private readonly ApplicationDbContext _db;

    public KeyEnvelopePeopleResolver(ApplicationDbContext db)
    {
        _db = db;
    }

    public async Task<string> ResolveActorDisplayNameAsync(
        string actorUserId,
        string actorDisplayName,
        CancellationToken cancellationToken = default)
    {
        var trimmed = actorDisplayName?.Trim() ?? "";
        if (LooksLikePersonName(trimmed, actorUserId))
            return trimmed;

        if (string.IsNullOrWhiteSpace(actorUserId) || actorUserId == "unknown")
            return trimmed;

        var name = await _db.Users.AsNoTracking()
            .Where(u => u.Id == actorUserId)
            .Select(u => u.DisplayName)
            .FirstOrDefaultAsync(cancellationToken);
        return string.IsNullOrWhiteSpace(name) ? trimmed : name.Trim();
    }

    public async Task<string> ResolvePartyLabelAsync(
        string? label,
        string? userId,
        CancellationToken cancellationToken = default)
    {
        var trimmed = label?.Trim() ?? "";
        if (LooksLikePersonName(trimmed, userId))
            return trimmed;

        var lookupId = !string.IsNullOrWhiteSpace(userId) ? userId.Trim()
            : Guid.TryParse(trimmed, out _) ? trimmed
            : null;
        if (string.IsNullOrWhiteSpace(lookupId))
            return trimmed;

        var name = await _db.Users.AsNoTracking()
            .Where(u => u.Id == lookupId)
            .Select(u => u.DisplayName)
            .FirstOrDefaultAsync(cancellationToken);
        return string.IsNullOrWhiteSpace(name) ? trimmed : name.Trim();
    }

    public async Task<KeyEnvelopeDto> WithResolvedPeopleAsync(
        KeyEnvelopeDto dto,
        CancellationToken cancellationToken = default)
    {
        var list = await WithResolvedPeopleAsync([dto], cancellationToken);
        return list[0]!;
    }

    public async Task<IReadOnlyList<KeyEnvelopeDto>> WithResolvedPeopleAsync(
        IReadOnlyList<KeyEnvelopeDto> rows,
        CancellationToken cancellationToken = default)
    {
        if (rows.Count == 0) return rows;

        var ids = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var row in rows)
        {
            CollectUserIdCandidate(ids, row.CreatedByUserId, row.CreatedByName);
            foreach (var h in row.Handoffs)
            {
                CollectUserIdCandidate(ids, h.ToUserId, h.ToParty);
                CollectUserIdCandidate(ids, null, h.FromParty);
                CollectUserIdCandidate(ids, null, h.CreatedByName);
                CollectUserIdCandidate(ids, null, h.ConfirmedByName);
            }
            foreach (var t in row.Timeline)
                CollectUserIdCandidate(ids, null, t.ActorName);
            foreach (var a in row.Assignments)
                CollectUserIdCandidate(ids, null, a.ConfirmedByName);
        }

        if (ids.Count == 0) return rows;

        var names = await _db.Users.AsNoTracking()
            .Where(u => ids.Contains(u.Id))
            .Select(u => new { u.Id, u.DisplayName })
            .ToDictionaryAsync(
                x => x.Id,
                x => x.DisplayName,
                StringComparer.OrdinalIgnoreCase,
                cancellationToken);

        string Fix(string? value, string? userId = null)
        {
            if (LooksLikePersonName(value ?? "", userId))
                return value!.Trim();
            var key = !string.IsNullOrWhiteSpace(userId) ? userId.Trim()
                : Guid.TryParse(value?.Trim(), out _) ? value!.Trim()
                : null;
            if (key is not null
                && names.TryGetValue(key, out var display)
                && !string.IsNullOrWhiteSpace(display))
                return display.Trim();
            return value?.Trim() ?? "";
        }

        return rows.Select(row => new KeyEnvelopeDto
        {
            Id = row.Id,
            RequestNumber = row.RequestNumber,
            Court = row.Court,
            Circuit = row.Circuit,
            KeysCountLabeled = row.KeysCountLabeled,
            KeysCountActual = row.KeysCountActual,
            CountMismatch = row.CountMismatch,
            ReceiptAttachmentId = row.ReceiptAttachmentId,
            PhotoAttachmentId = row.PhotoAttachmentId,
            ThirdPartyLetterAttachmentId = row.ThirdPartyLetterAttachmentId,
            ContactPhones = row.ContactPhones,
            Notes = row.Notes,
            ReceiveScenario = row.ReceiveScenario,
            Status = row.Status,
            FeeGenerated = row.FeeGenerated,
            FeeAmountSar = row.FeeAmountSar,
            RevenueEntitlementAtUtc = row.RevenueEntitlementAtUtc,
            CreatedByUserId = row.CreatedByUserId,
            CreatedByName = Fix(row.CreatedByName, row.CreatedByUserId),
            CreatedAtUtc = row.CreatedAtUtc,
            UpdatedAtUtc = row.UpdatedAtUtc,
            LinkedProperties = row.LinkedProperties,
            Handoffs = row.Handoffs.Select(h => new KeyEnvelopeHandoffDto
            {
                Id = h.Id,
                Kind = h.Kind,
                FromParty = Fix(h.FromParty),
                ToParty = Fix(h.ToParty, h.ToUserId),
                ToUserId = h.ToUserId,
                LetterNumber = h.LetterNumber,
                LetterAttachmentId = h.LetterAttachmentId,
                Notes = h.Notes,
                Status = h.Status,
                ConfirmedByName = string.IsNullOrWhiteSpace(h.ConfirmedByName)
                    ? h.ConfirmedByName
                    : Fix(h.ConfirmedByName),
                ConfirmedAtUtc = h.ConfirmedAtUtc,
                CreatedByName = Fix(h.CreatedByName),
                CreatedAtUtc = h.CreatedAtUtc,
            }).ToList(),
            Timeline = row.Timeline.Select(t => new KeyEnvelopeTimelineEntryDto
            {
                Id = t.Id,
                EventType = t.EventType,
                Summary = t.Summary,
                ActorName = Fix(t.ActorName),
                CreatedAtUtc = t.CreatedAtUtc,
            }).ToList(),
            Assignments = row.Assignments.Select(a => new KeyEnvelopeAssignmentDto
            {
                Id = a.Id,
                DeedNumber = a.DeedNumber,
                PropertyId = a.PropertyId,
                Status = a.Status,
                Notes = a.Notes,
                ConfirmedByName = string.IsNullOrWhiteSpace(a.ConfirmedByName)
                    ? a.ConfirmedByName
                    : Fix(a.ConfirmedByName),
                ConfirmedAtUtc = a.ConfirmedAtUtc,
            }).ToList(),
        }).ToList();
    }

    private static bool LooksLikePersonName(string value, string? userId)
    {
        if (string.IsNullOrWhiteSpace(value)) return false;
        if (!string.IsNullOrWhiteSpace(userId)
            && string.Equals(value, userId.Trim(), StringComparison.OrdinalIgnoreCase))
            return false;
        return !Guid.TryParse(value, out _);
    }

    private static void CollectUserIdCandidate(
        HashSet<string> ids,
        string? userId,
        string? label)
    {
        if (!string.IsNullOrWhiteSpace(userId))
            ids.Add(userId.Trim());
        if (!string.IsNullOrWhiteSpace(label) && Guid.TryParse(label.Trim(), out _))
            ids.Add(label.Trim());
    }
}

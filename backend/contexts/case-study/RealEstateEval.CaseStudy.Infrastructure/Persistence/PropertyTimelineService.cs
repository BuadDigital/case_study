using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Failures.Application.Abstractions;

namespace RealEstateEval.CaseStudy.Infrastructure.Persistence;

/// <summary>
/// The property's timeline: one stored row per business milestone (see <c>PropertyTimelineService.Projection</c>
/// for how legacy technical rows are folded away on read, and <c>.Bootstrap</c> for properties that predate it).
/// </summary>
public sealed partial class PropertyTimelineService : IPropertyTimelineService
{
    private const int MaxTimelineRows = 500;

    private readonly CaseStudyDbContext _caseStudy;
    private readonly IFailureLookup _failureLookup;
    private readonly TimeProvider _time;

    [ActivatorUtilitiesConstructor]
    public PropertyTimelineService(
        CaseStudyDbContext caseStudy,
        IFailureLookup failureLookup,
        TimeProvider? time = null)
    {
        _time = time ?? TimeProvider.System;

        _caseStudy = caseStudy;
        _failureLookup = failureLookup;
    }

    public async Task<IReadOnlyList<PropertyTimelineEventDto>> GetForPropertyAsync(
        string poNumber,
        Guid propertyId,
        CancellationToken cancellationToken = default)
    {
        var po = poNumber.Trim();
        // Newest first only to apply the cap to the NEWEST rows; the projection re-sorts oldest first.
        var existing = await _caseStudy.PropertyTimelineEntries
            .AsNoTracking()
            .Where(e => e.PoNumber == po && e.PropertyId == propertyId)
            .OrderByDescending(e => e.OccurredAtUtc)
            .ThenBy(e => e.EventKey)
            .Take(MaxTimelineRows)
            .ToListAsync(cancellationToken);

        if (existing.Count == 0)
        {
            var bootstrapped = await BootstrapAsync(po, propertyId, cancellationToken);
            if (bootstrapped.Count > 0)
            {
                _caseStudy.PropertyTimelineEntries.AddRange(bootstrapped);
                await _caseStudy.SaveChangesAsync(cancellationToken);
                existing = bootstrapped;
            }
        }

        return Project(existing);
    }

    public async Task RecordAsync(
        string poNumber,
        Guid propertyId,
        string eventKey,
        string title,
        string? detail,
        string tone,
        DateTime occurredAtUtc,
        CancellationToken cancellationToken = default)
    {
        var po = poNumber.Trim();
        var key = eventKey.Trim();
        if (string.IsNullOrEmpty(po) || string.IsNullOrEmpty(key)) return;

        var exists = await _caseStudy.PropertyTimelineEntries.AnyAsync(
            e => e.PoNumber == po && e.PropertyId == propertyId && e.EventKey == key,
            cancellationToken);
        if (exists) return;

        var now = _time.UtcNow();
        _caseStudy.PropertyTimelineEntries.Add(new PropertyTimelineEntry
        {
            Id = Guid.NewGuid(),
            PoNumber = po,
            PropertyId = propertyId,
            EventKey = key,
            Title = title.Trim(),
            Detail = string.IsNullOrWhiteSpace(detail) ? null : detail.Trim(),
            Tone = NormalizeTone(tone),
            OccurredAtUtc = occurredAtUtc,
            RecordedAtUtc = now,
        });
        await _caseStudy.SaveChangesAsync(cancellationToken);
    }

    public async Task RecordManyAsync(
        IReadOnlyList<PropertyTimelineRecordRequest> events,
        CancellationToken cancellationToken = default)
    {
        if (events.Count == 0) return;

        var normalized = events
            .Select(e => new
            {
                Po = e.PoNumber.Trim(),
                e.PropertyId,
                Key = e.EventKey.Trim(),
                e.Title,
                e.Detail,
                e.Tone,
                e.OccurredAtUtc,
            })
            .Where(e => !string.IsNullOrEmpty(e.Po) && !string.IsNullOrEmpty(e.Key))
            .ToList();
        if (normalized.Count == 0) return;

        var poNumbers = normalized.Select(e => e.Po).Distinct().ToList();
        var propertyIds = normalized.Select(e => e.PropertyId).Distinct().ToList();
        var existingKeys = await _caseStudy.PropertyTimelineEntries
            .AsNoTracking()
            .Where(e => poNumbers.Contains(e.PoNumber) && propertyIds.Contains(e.PropertyId))
            .Select(e => new { e.PoNumber, e.PropertyId, e.EventKey })
            .ToListAsync(cancellationToken);
        var existing = existingKeys
            .Select(e => (e.PoNumber, e.PropertyId, e.EventKey))
            .ToHashSet();

        var now = _time.UtcNow();
        foreach (var entry in normalized)
        {
            if (existing.Contains((entry.Po, entry.PropertyId, entry.Key)))
                continue;

            _caseStudy.PropertyTimelineEntries.Add(new PropertyTimelineEntry
            {
                Id = Guid.NewGuid(),
                PoNumber = entry.Po,
                PropertyId = entry.PropertyId,
                EventKey = entry.Key,
                Title = entry.Title.Trim(),
                Detail = string.IsNullOrWhiteSpace(entry.Detail) ? null : entry.Detail.Trim(),
                Tone = NormalizeTone(entry.Tone),
                OccurredAtUtc = entry.OccurredAtUtc,
                RecordedAtUtc = now,
            });
            existing.Add((entry.Po, entry.PropertyId, entry.Key));
        }

        await _caseStudy.SaveChangesAsync(cancellationToken);
    }

    private static string NormalizeTone(string tone) => PropertyTimelineTones.Normalize(tone);
}

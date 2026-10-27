using System.Globalization;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;
using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Infrastructure.Persistence;

/// <summary>
/// Reads of the transaction above the deeds. A party actor sees only the
/// deeds whose work orders he may read; staff see them all.
/// </summary>
public sealed class TransactionQueryService : ITransactionQuery
{
    private readonly CaseStudyDbContext _db;
    private readonly IWorkOrderVisibilityFilter _visibility;
    private readonly IPropertyTimelineService _timeline;

    public TransactionQueryService(
        CaseStudyDbContext db,
        IWorkOrderVisibilityFilter visibility,
        IPropertyTimelineService timeline)
    {
        _db = db;
        _visibility = visibility;
        _timeline = timeline;
    }

    /// <summary>The transaction detail of the transaction a deed belongs to.</summary>
    /// <remarks>
    /// How it works: reads the deed's TransactionId and hands it to <see cref="GetAsync"/>.
    /// Edge cases: an unknown deed returns null; visibility is applied by GetAsync.
    /// </remarks>
    public async Task<TransactionDetailDto?> GetByPropertyAsync(
        Guid propertyId,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default)
    {
        var transactionId = await _db.WorkOrderProperties.AsNoTracking()
            .Where(p => p.Id == propertyId)
            .Select(p => (Guid?)p.TransactionId)
            .FirstOrDefaultAsync(cancellationToken);
        return transactionId is { } id ? await GetAsync(id, actor, cancellationToken) : null;
    }

    /// <summary>The transaction with its numbers, link, holder deed and the deeds the actor may see.</summary>
    /// <remarks>
    /// How it works: 1) loads the transaction with its deeds and work orders (no tracking); 2) keeps
    /// the deeds whose PO the actor may see, ordered by work-order date then deed number; 3) finds the
    /// holder deed (TransactionStudyRules.Holder) and its case-study parent task; 4) returns the
    /// numbers, PRC / PRV derived from the PR root, link kind and reason, the live deed count and
    /// the deeds.
    /// Edge cases: a party actor who sees none of the deeds gets null (not an empty transaction);
    /// removed deeds stay in the list flagged IsRemoved but are not counted; the holder task is null
    /// until the holder deed is distributed; PRC / PRV are null while only TMP exists.
    /// </remarks>
    public async Task<TransactionDetailDto?> GetAsync(
        Guid transactionId,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default)
    {
        var transaction = await LoadAsync(transactionId, cancellationToken);
        if (transaction is null) return null;

        var visiblePos = await _visibility.ResolveVisiblePoNumbersAsync(actor, cancellationToken);
        var deeds = transaction.Properties
            .Where(p => p.WorkOrder is not null)
            .Where(p => visiblePos is null || visiblePos.Contains(p.WorkOrder!.PoNumber))
            .OrderBy(p => p.WorkOrder!.CreatedAtUtc)
            .ThenBy(p => p.DeedNumber, StringComparer.Ordinal)
            .Select(ToDeedDto)
            .ToList();
        if (visiblePos is not null && deeds.Count == 0) return null;

        var holder = TransactionStudyRules.Holder(transaction);
        var holderTaskId = holder is null
            ? null
            : await StudyHolder.ParentTaskIdForPropertyAsync(_db, holder.Id, cancellationToken);

        return new TransactionDetailDto
        {
            StudyHolderPropertyId = holder?.Id,
            StudyHolderTaskId = holderTaskId,
            Id = transaction.Id,
            DraftNumber = transaction.DraftNumber,
            ReferenceNumber = transaction.ReferenceNumber,
            DisplayNumber = transaction.DisplayNumber,
            ConfirmedAtUtc = transaction.ConfirmedAtUtc?.ToString("o"),
            CaseStudyReportNumber = ReferenceNumbering.CaseStudyReportNumber(transaction.ReferenceNumber),
            ValuationReportNumber = ReferenceNumbering.ValuationReportNumber(transaction.ReferenceNumber),
            LinkKind = transaction.LinkKind,
            LinkKindLabelAr = TransactionLinkKinds.LabelAr(transaction.LinkKind),
            LinkReason = transaction.LinkReason,
            DeedCount = transaction.Properties.Count(p => !p.IsRemoved),
            Deeds = deeds,
        };
    }

    /// <summary>One timeline for the transaction: every visible deed's events merged in time order.</summary>
    /// <remarks>
    /// How it works: gets the detail (so visibility applies), reads each deed's timeline, prefixes
    /// every event id with the deed id and tags it with the deed (registry number, else deed number),
    /// then sorts all events by time and id.
    /// Edge cases: null when the actor may not see the transaction; the id prefix keeps two deeds'
    /// events with the same key distinct.
    /// </remarks>
    public async Task<IReadOnlyList<PropertyTimelineEventDto>?> GetTimelineAsync(
        Guid transactionId,
        PermissionsDto? actor,
        CancellationToken cancellationToken = default)
    {
        var detail = await GetAsync(transactionId, actor, cancellationToken);
        if (detail is null) return null;

        var merged = new List<(DateTime Sort, PropertyTimelineEventDto Event)>();
        foreach (var deed in detail.Deeds)
        {
            var events = await _timeline.GetForPropertyAsync(deed.PoNumber, deed.PropertyId, cancellationToken);
            var label = string.IsNullOrWhiteSpace(deed.RealEstateRegNumber) ? deed.DeedNumber : deed.RealEstateRegNumber!;
            foreach (var e in events)
            {
                e.Id = $"{deed.PropertyId:D}:{e.Id}";
                e.PropertyId = deed.PropertyId;
                e.DeedLabel = label;
                merged.Add((SortKey(e.At), e));
            }
        }

        return merged
            .OrderBy(x => x.Sort)
            .ThenBy(x => x.Event.Id, StringComparer.Ordinal)
            .Select(x => x.Event)
            .ToList();
    }

    private Task<Transaction?> LoadAsync(Guid transactionId, CancellationToken cancellationToken) =>
        _db.Transactions.AsNoTracking()
            .Include(t => t.Properties)
            .ThenInclude(p => p.WorkOrder)
            .FirstOrDefaultAsync(t => t.Id == transactionId, cancellationToken);

    private static TransactionDeedDto ToDeedDto(WorkOrderProperty p) => new()
    {
        PropertyId = p.Id,
        PoNumber = p.WorkOrder!.PoNumber,
        IdentifierType = PropertyIdentifierTypeLabels.ToApiValue(p.IdentifierType),
        DeedNumber = p.DeedNumber,
        DeedDate = p.DeedDate,
        RealEstateRegNumber = p.RealEstateRegNumber,
        RealEstateRegDate = p.RealEstateRegDate,
        DeedKindLabelAr = DeedKindLabels.LabelAr(p.DeedKind),
        City = p.City,
        District = p.District,
        Area = p.Area,
        IsRemoved = p.IsRemoved,
        CreatedAtUtc = p.WorkOrder.CreatedAtUtc.ToString("O"),
    };

    /// <summary>Events carry either a date (yyyy-MM-dd) or an instant (round-trip); both sort as UTC.</summary>
    /// <remarks>
    /// How it works: parses invariant, assuming and adjusting to UTC. Edge cases: an unparseable
    /// value sorts first (DateTime.MinValue) instead of throwing.
    /// </remarks>
    private static DateTime SortKey(string at) =>
        DateTime.TryParse(at, CultureInfo.InvariantCulture, DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal, out var parsed)
            ? parsed
            : DateTime.MinValue;
}

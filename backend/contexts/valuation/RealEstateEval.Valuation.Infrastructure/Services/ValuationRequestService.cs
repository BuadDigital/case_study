using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Shared.Contracts;

namespace RealEstateEval.Infrastructure.Services;

public sealed class ValuationRequestService : IValuationRequestService
{
    private const int MaxListRows = 500;
    private readonly ValuationDbContext _db;
    private readonly IValuationEventPublisher _events;
    private readonly IPropertyPoNumberLookup _poNumbers;
    private readonly TimeProvider _time;

    public ValuationRequestService(
        ValuationDbContext db,
        IValuationEventPublisher events,
        IPropertyPoNumberLookup poNumbers,
        TimeProvider? time = null)
    {
        _time = time ?? TimeProvider.System;

        _db = db;
        _events = events;
        _poNumbers = poNumbers;
    }

    public async Task<IReadOnlyList<ValuationRequestDto>> ListAsync(
        CancellationToken cancellationToken = default)
    {
        var rows = await _db.ValuationRequests.AsNoTracking()
            .OrderByDescending(x => x.RequestDate)
            .Take(MaxListRows)
            .ToListAsync(cancellationToken);
        return rows.Select(ToDto).ToList();
    }

    public async Task<ValuationRequestDto?> GetAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var row = await _db.ValuationRequests.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        return row is null ? null : ToDto(row);
    }

    public async Task<ValuationRequestDto?> GetOpenByPropertyAsync(
        string propertyId,
        CancellationToken cancellationToken = default)
    {
        var key = propertyId?.Trim() ?? "";
        if (key.Length == 0) return null;

        var row = await _db.ValuationRequests.AsNoTracking()
            .Where(x => x.PropertyId == key && x.Status != ValuationRequestStatus.Done)
            .OrderByDescending(x => x.UpdatedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);
        return row is null ? null : ToDto(row);
    }

    public async Task<(ValuationRequestDto? Result, string? Error)> CreateAsync(
        SaveValuationRequestRequest request,
        CancellationToken cancellationToken = default)
    {
 // Taken before anything is staged so a lost race can hand the context back exactly
 // as the caller passed it in — otherwise their next save replays the failed insert.
        var checkpoint = ChangeTrackerCheckpoint.Capture(_db);
        var displayId = string.IsNullOrWhiteSpace(request.DisplayId)
            ? await NextDisplayIdAsync(cancellationToken)
            : request.DisplayId.Trim();
        var row = ValuationRequest.Create(
            Guid.NewGuid(),
            displayId,
            request.PropId,
            request.Area,
            request.Type,
            request.Appraiser,
            request.Date,
            _time.UtcNow(),
            ValuationRequestStatuses.Parse(request.Status));
        _db.ValuationRequests.Add(row);

        var poNumber = await _poNumbers.ResolveForPropertyAsync(row.PropertyId, cancellationToken);
        await _events.PublishAsync(
            IntegrationEventTypes.ValuationRequestCreated,
            new ValuationRequestCreatedPayload(
                row.Id.ToString(),
                row.PropertyId,
                poNumber),
            cancellationToken);

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (ConflictError(ex) is { } error)
        {
            checkpoint.Rollback();
            return (null, error);
        }

        return (ToDto(row), null);
    }

    public async Task<(ValuationRequestDto? Result, string? Error)> SubmitReportAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var row = await _db.ValuationRequests.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (row is null) return (null, "not_found");
        if (row.SubmitReport(_time.UtcNow()) == ValuationRequestTransition.AlreadySubmitted)
            return (null, "already_submitted");

        await _events.PublishAsync(
            IntegrationEventTypes.ValuationReportSubmitted,
            new ValuationReportSubmittedPayload(
                row.Id,
                row.PropertyId,
                row.DisplayId,
                row.Appraiser),
            cancellationToken);

        await _db.SaveChangesAsync(cancellationToken);
        return (ToDto(row), null);
    }

    public async Task<(ValuationRequestDto? Result, string? Error)> RecordImpedimentAsync(
        Guid id,
        ValuationImpedimentRequest request,
        CancellationToken cancellationToken = default)
    {
        var row = await _db.ValuationRequests.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (row is null) return (null, "not_found");
 // The reason is checked before the transition so a missing reason leaves the row untouched.
        if (string.IsNullOrWhiteSpace(request.Reason) && row.Status == ValuationRequestStatus.Progress)
            return (null, "reason_required");

        switch (row.RecordImpediment(_time.UtcNow()))
        {
            case ValuationRequestTransition.AlreadySubmitted:
                return (null, "already_submitted");
            case ValuationRequestTransition.AlreadyImpeded:
                return (null, "already_impeded");
        }

        await _db.SaveChangesAsync(cancellationToken);
        return (ToDto(row), null);
    }

 /// <summary>
 /// Business errors for the unique indexes this insert can violate; anything else stays
 /// an exception so it is not silently swallowed.
 /// </summary>
    private static string? ConflictError(DbUpdateException exception) =>
        PostgresErrors.ViolatedUniqueIndex(exception) switch
        {
            DatabaseIndexNames.ValuationRequestOpenPerProperty => "valuation_already_open",
            DatabaseIndexNames.ValuationRequestDisplayId => "duplicate_display_id",
            _ => null,
        };

 /// <summary>
 /// Draws the running number from a PostgreSQL sequence. The previous COUNT(*) handed the
 /// same number to concurrent callers and reused numbers after a delete.
 /// </summary>
    private async Task<string> NextDisplayIdAsync(CancellationToken cancellationToken)
    {
        if (!_db.Database.IsRelational())
        {
 // InMemory provider (tests) has no sequences; row count is enough there.
            var used = await _db.ValuationRequests.CountAsync(cancellationToken);
            return $"VR-{DatabaseSequences.ValuationRequestDisplayIdStart + used}";
        }

        var next = await _db.Database
            .SqlQueryRaw<long>(DatabaseSequences.NextValuationRequestDisplayIdSql)
            .SingleAsync(cancellationToken);
        return $"VR-{next}";
    }

    private static ValuationRequestDto ToDto(ValuationRequest row) => new()
    {
        Id = row.Id,
        DisplayId = row.DisplayId,
        PropId = row.PropertyId,
        Area = row.Area,
        Type = row.PropertyType,
        Appraiser = row.Appraiser,
        Status = row.Status.ToDbValue(),
        Date = row.RequestDate,
    };
}

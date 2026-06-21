using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Shared.Contracts;

namespace RealEstateEval.Infrastructure.Services;

public sealed class ValuationRequestService : IValuationRequestService
{
    private readonly ApplicationDbContext _db;
    private readonly IIntegrationEventPublisher _events;

    public ValuationRequestService(
        ApplicationDbContext db,
        IIntegrationEventPublisher events)
    {
        _db = db;
        _events = events;
    }

    public async Task<IReadOnlyList<ValuationRequestDto>> ListAsync(
        CancellationToken cancellationToken = default)
    {
        var rows = await _db.ValuationRequests.AsNoTracking()
            .OrderByDescending(x => x.RequestDate)
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

    public async Task<ValuationRequestDto> CreateAsync(
        SaveValuationRequestRequest request,
        CancellationToken cancellationToken = default)
    {
        var displayId = string.IsNullOrWhiteSpace(request.DisplayId)
            ? await NextDisplayIdAsync(cancellationToken)
            : request.DisplayId.Trim();
        var row = new ValuationRequest
        {
            Id = Guid.NewGuid(),
            DisplayId = displayId,
            PropertyId = request.PropId.Trim(),
            Area = request.Area.Trim(),
            PropertyType = request.Type.Trim(),
            Appraiser = request.Appraiser.Trim(),
            Status = request.Status.Trim(),
            RequestDate = request.Date.Trim(),
            UpdatedAtUtc = DateTime.UtcNow,
        };
        _db.ValuationRequests.Add(row);

        var poNumber = await ResolvePoNumberAsync(row.PropertyId, cancellationToken);
        await _events.PublishAsync(
            IntegrationEventTypes.ValuationRequestCreated,
            new ValuationRequestCreatedPayload(
                row.Id.ToString(),
                row.PropertyId,
                poNumber),
            cancellationToken);

        await _db.SaveChangesAsync(cancellationToken);
        return ToDto(row);
    }

    public async Task<ValuationRequestDto?> UpdateAsync(
        Guid id,
        SaveValuationRequestRequest request,
        CancellationToken cancellationToken = default)
    {
        var row = await _db.ValuationRequests.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (row is null) return null;

        if (!string.IsNullOrWhiteSpace(request.DisplayId))
            row.DisplayId = request.DisplayId.Trim();
        row.PropertyId = request.PropId.Trim();
        row.Area = request.Area.Trim();
        row.PropertyType = request.Type.Trim();
        row.Appraiser = request.Appraiser.Trim();
        row.Status = request.Status.Trim();
        row.RequestDate = request.Date.Trim();
        row.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        return ToDto(row);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var row = await _db.ValuationRequests.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (row is null) return false;
        _db.ValuationRequests.Remove(row);
        await _db.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<(ValuationRequestDto? Result, string? Error)> SubmitReportAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var row = await _db.ValuationRequests.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (row is null) return (null, "not_found");
        if (string.Equals(row.Status, "done", StringComparison.OrdinalIgnoreCase))
            return (null, "already_submitted");

        row.Status = "done";
        row.UpdatedAtUtc = DateTime.UtcNow;

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

    private async Task<string> NextDisplayIdAsync(CancellationToken cancellationToken)
    {
        var max = await _db.ValuationRequests.CountAsync(cancellationToken);
        return $"VR-{441 + max}";
    }

    private async Task<string> ResolvePoNumberAsync(string propertyId, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(propertyId, out var pid))
            return "";

        var poNumber = await _db.WorkOrderProperties.AsNoTracking()
            .Where(p => p.Id == pid)
            .Select(p => p.WorkOrder!.PoNumber)
            .FirstOrDefaultAsync(cancellationToken);

        return poNumber ?? "";
    }

    private static ValuationRequestDto ToDto(ValuationRequest row) => new()
    {
        Id = row.Id,
        DisplayId = row.DisplayId,
        PropId = row.PropertyId,
        Area = row.Area,
        Type = row.PropertyType,
        Appraiser = row.Appraiser,
        Status = row.Status,
        Date = row.RequestDate,
    };
}

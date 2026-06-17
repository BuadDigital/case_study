using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Shared.Contracts;

namespace RealEstateEval.Valuation.Api.Controllers;

[ApiController]
[Route("api/valuation-requests")]
[Authorize]
public class ValuationRequestsController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly IIntegrationEventPublisher _events;

    public ValuationRequestsController(
        ApplicationDbContext db,
        IIntegrationEventPublisher events)
    {
        _db = db;
        _events = events;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ValuationRequestDto>>> List(CancellationToken ct)
    {
        var rows = await _db.ValuationRequests.AsNoTracking()
            .OrderByDescending(x => x.RequestDate)
            .ToListAsync(ct);
        return Ok(rows.Select(ToDto).ToList());
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ValuationRequestDto>> Get(Guid id, CancellationToken ct)
    {
        var row = await _db.ValuationRequests.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        return row is null ? NotFound() : Ok(ToDto(row));
    }

    [HttpPost]
    public async Task<ActionResult<ValuationRequestDto>> Create(
        [FromBody] SaveValuationRequestRequest request,
        CancellationToken ct)
    {
        var displayId = string.IsNullOrWhiteSpace(request.DisplayId)
            ? await NextDisplayId(ct)
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

        var poNumber = await ResolvePoNumberAsync(row.PropertyId, ct);
        await _events.PublishAsync(
            IntegrationEventTypes.ValuationRequestCreated,
            new ValuationRequestCreatedPayload(
                row.Id.ToString(),
                row.PropertyId,
                poNumber),
            ct);

        await _db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(Get), new { id = row.Id }, ToDto(row));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ValuationRequestDto>> Update(
        Guid id,
        [FromBody] SaveValuationRequestRequest request,
        CancellationToken ct)
    {
        var row = await _db.ValuationRequests.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (row is null) return NotFound();
        if (!string.IsNullOrWhiteSpace(request.DisplayId))
            row.DisplayId = request.DisplayId.Trim();
        row.PropertyId = request.PropId.Trim();
        row.Area = request.Area.Trim();
        row.PropertyType = request.Type.Trim();
        row.Appraiser = request.Appraiser.Trim();
        row.Status = request.Status.Trim();
        row.RequestDate = request.Date.Trim();
        row.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok(ToDto(row));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var row = await _db.ValuationRequests.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (row is null) return NotFound();
        _db.ValuationRequests.Remove(row);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/submit-report")]
    public async Task<ActionResult<ValuationRequestDto>> SubmitReport(Guid id, CancellationToken ct)
    {
        var row = await _db.ValuationRequests.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (row is null) return NotFound();
        if (string.Equals(row.Status, "done", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { error = "report already submitted" });

        row.Status = "done";
        row.UpdatedAtUtc = DateTime.UtcNow;

        await _events.PublishAsync(
            IntegrationEventTypes.ValuationReportSubmitted,
            new ValuationReportSubmittedPayload(
                row.Id,
                row.PropertyId,
                row.DisplayId,
                row.Appraiser),
            ct);

        await _db.SaveChangesAsync(ct);
        return Ok(ToDto(row));
    }

    private async Task<string> NextDisplayId(CancellationToken ct)
    {
        var max = await _db.ValuationRequests.CountAsync(ct);
        return $"VR-{441 + max}";
    }

    private async Task<string> ResolvePoNumberAsync(string propertyId, CancellationToken ct)
    {
        if (!Guid.TryParse(propertyId, out var pid))
            return "";

        var poNumber = await _db.WorkOrderProperties.AsNoTracking()
            .Where(p => p.Id == pid)
            .Select(p => p.WorkOrder!.PoNumber)
            .FirstOrDefaultAsync(ct);

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

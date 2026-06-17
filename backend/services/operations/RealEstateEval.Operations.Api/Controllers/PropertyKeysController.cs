using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Operations.Api.Controllers;

[ApiController]
[Route("api/property-keys")]
[Authorize]
public class PropertyKeysController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public PropertyKeysController(ApplicationDbContext db) => _db = db;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<PropertyKeyRecordDto>>> List(
        [FromQuery] bool? hasKey,
        CancellationToken ct)
    {
        var query = _db.PropertyKeyRecords.AsNoTracking().AsQueryable();
        if (hasKey is true)
            query = query.Where(x => x.HasKey);
        else if (hasKey is false)
            query = query.Where(x => !x.HasKey);

        var rows = await query.OrderBy(x => x.PoNumber).ThenBy(x => x.PropertyId).ToListAsync(ct);
        return Ok(rows.Select(ToDto).ToList());
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<PropertyKeyRecordDto>> Get(Guid id, CancellationToken ct)
    {
        var row = await _db.PropertyKeyRecords.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        return row is null ? NotFound() : Ok(ToDto(row));
    }

    [HttpPatch("{id:guid}")]
    public async Task<ActionResult<PropertyKeyRecordDto>> Patch(
        Guid id,
        [FromBody] UpdatePropertyKeyRequest request,
        CancellationToken ct)
    {
        var row = await _db.PropertyKeyRecords.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (row is null) return NotFound();
        if (request.Key is not null) row.HasKey = request.Key.Value;
        if (!string.IsNullOrWhiteSpace(request.Status))
            row.WorkflowStatus = request.Status.Trim();
        row.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok(ToDto(row));
    }

    private static PropertyKeyRecordDto ToDto(PropertyKeyRecord row) => new()
    {
        Id = row.Id,
        IdProp = row.PropertyId,
        Po = row.PoNumber,
        Area = row.Area,
        Type = row.PropertyType,
        Key = row.HasKey,
        Specialist = row.Specialist,
        Status = row.WorkflowStatus,
    };
}

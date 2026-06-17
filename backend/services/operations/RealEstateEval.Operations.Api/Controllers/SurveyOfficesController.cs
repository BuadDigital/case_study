using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Caching;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Operations.Api.Controllers;

[ApiController]
[Route("api/survey-offices")]
[Authorize]
public class SurveyOfficesController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly ApiResponseCache _cache;

    public SurveyOfficesController(ApplicationDbContext db, ApiResponseCache cache)
    {
        _db = db;
        _cache = cache;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<SurveyOfficeDto>>> List(CancellationToken ct)
    {
        var list = await _cache.GetOrCreateAsync(
            CacheKeys.SurveyOfficesList,
            CacheDurations.SurveyOffices,
            async cancellationToken =>
            {
                var rows = await _db.SurveyOffices.AsNoTracking()
                    .OrderBy(x => x.SortOrder).ThenBy(x => x.Name)
                    .ToListAsync(cancellationToken);
                return (IReadOnlyList<SurveyOfficeDto>)rows.Select(ToDto).ToList();
            },
            ct);
        return Ok(list);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<SurveyOfficeDto>> Get(Guid id, CancellationToken ct)
    {
        var row = await _db.SurveyOffices.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        return row is null ? NotFound() : Ok(ToDto(row));
    }

    [HttpPost]
    public async Task<ActionResult<SurveyOfficeDto>> Create(
        [FromBody] SaveSurveyOfficeRequest request,
        CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var row = new SurveyOffice
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            ActiveCount = request.Active,
            DoneMonth = request.DoneMonth,
            AvgDaysLabel = request.AvgDays.Trim(),
            ContractLabel = request.Contract.Trim(),
            StatusBusy = request.StatusBusy,
            SortOrder = request.SortOrder,
            UpdatedAtUtc = now,
        };
        _db.SurveyOffices.Add(row);
        await _db.SaveChangesAsync(ct);
        await _cache.RemoveAsync(CacheKeys.SurveyOfficesList, ct);
        return CreatedAtAction(nameof(Get), new { id = row.Id }, ToDto(row));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<SurveyOfficeDto>> Update(
        Guid id,
        [FromBody] SaveSurveyOfficeRequest request,
        CancellationToken ct)
    {
        var row = await _db.SurveyOffices.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (row is null) return NotFound();
        row.Name = request.Name.Trim();
        row.ActiveCount = request.Active;
        row.DoneMonth = request.DoneMonth;
        row.AvgDaysLabel = request.AvgDays.Trim();
        row.ContractLabel = request.Contract.Trim();
        row.StatusBusy = request.StatusBusy;
        if (request.SortOrder > 0) row.SortOrder = request.SortOrder;
        row.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        await _cache.RemoveAsync(CacheKeys.SurveyOfficesList, ct);
        return Ok(ToDto(row));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var row = await _db.SurveyOffices.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (row is null) return NotFound();
        _db.SurveyOffices.Remove(row);
        await _db.SaveChangesAsync(ct);
        await _cache.RemoveAsync(CacheKeys.SurveyOfficesList, ct);
        return NoContent();
    }

    private static SurveyOfficeDto ToDto(SurveyOffice row) => new()
    {
        Id = row.Id,
        Name = row.Name,
        Active = row.ActiveCount,
        DoneMonth = row.DoneMonth,
        AvgDays = row.AvgDaysLabel,
        Contract = row.ContractLabel,
        StatusBusy = row.StatusBusy,
        SortOrder = row.SortOrder,
    };
}

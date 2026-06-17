using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Valuation.Api.Controllers;

[ApiController]
[Route("api/evaluator-recalls")]
[Authorize]
public class EvaluatorRecallsController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public EvaluatorRecallsController(ApplicationDbContext db) => _db = db;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<EvaluatorRecallDto>>> List(
        [FromQuery] string? status,
        CancellationToken ct)
    {
        var query = _db.EvaluatorRecallRecords.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(x => x.Status == status.Trim());

        var rows = await query.OrderByDescending(x => x.RequestedAtUtc).ToListAsync(ct);
        return Ok(rows.Select(ToDto).ToList());
    }

    [HttpGet("{taskId}")]
    public async Task<ActionResult<EvaluatorRecallDto>> Get(
        string taskId,
        CancellationToken ct)
    {
        var row = await _db.EvaluatorRecallRecords.AsNoTracking()
            .FirstOrDefaultAsync(x => x.TaskId == taskId, ct);
        return row is null ? NotFound() : Ok(ToDto(row));
    }

    [HttpPost]
    public async Task<ActionResult<EvaluatorRecallDto>> Request(
        [FromBody] CreateEvaluatorRecallRequest request,
        CancellationToken ct)
    {
        var taskId = request.TaskId.Trim();
        var existing = await _db.EvaluatorRecallRecords
            .FirstOrDefaultAsync(x => x.TaskId == taskId, ct);
        if (existing?.Status == "pending")
            return Ok(ToDto(existing));

        var now = DateTime.UtcNow;
        if (existing is null)
        {
            existing = new EvaluatorRecallRecord
            {
                Id = Guid.NewGuid(),
                TaskId = taskId,
                PoNumber = request.PoNumber.Trim(),
                PropertyId = request.PropertyId.Trim(),
                Status = "pending",
                Reason = request.Reason?.Trim() ?? "",
                SpecialistNote = "",
                RequestedAtUtc = now,
            };
            _db.EvaluatorRecallRecords.Add(existing);
        }
        else
        {
            existing.PoNumber = request.PoNumber.Trim();
            existing.PropertyId = request.PropertyId.Trim();
            existing.Status = "pending";
            existing.Reason = request.Reason?.Trim() ?? "";
            existing.SpecialistNote = "";
            existing.RequestedAtUtc = now;
            existing.ResolvedAtUtc = null;
        }

        await _db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(Get), new { taskId }, ToDto(existing));
    }

    [HttpPatch("{taskId}/approve")]
    public async Task<ActionResult<EvaluatorRecallDto>> Approve(
        string taskId,
        CancellationToken ct)
    {
        var row = await _db.EvaluatorRecallRecords
            .FirstOrDefaultAsync(x => x.TaskId == taskId, ct);
        if (row is null) return NotFound();
        if (row.Status != "pending") return Ok(ToDto(row));

        row.Status = "approved";
        row.ResolvedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok(ToDto(row));
    }

    [HttpPatch("{taskId}/reject")]
    public async Task<ActionResult<EvaluatorRecallDto>> Reject(
        string taskId,
        [FromBody] RejectEvaluatorRecallRequest request,
        CancellationToken ct)
    {
        var row = await _db.EvaluatorRecallRecords
            .FirstOrDefaultAsync(x => x.TaskId == taskId, ct);
        if (row is null) return NotFound();
        if (row.Status != "pending") return Ok(ToDto(row));

        row.Status = "rejected";
        row.SpecialistNote = request.SpecialistNote?.Trim() ?? "";
        row.ResolvedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok(ToDto(row));
    }

    private static EvaluatorRecallDto ToDto(EvaluatorRecallRecord row) => new()
    {
        Id = row.Id,
        TaskId = row.TaskId,
        PoNumber = row.PoNumber,
        PropertyId = row.PropertyId,
        Status = row.Status,
        Reason = row.Reason,
        SpecialistNote = row.SpecialistNote,
        RequestedAtUtc = row.RequestedAtUtc,
        ResolvedAtUtc = row.ResolvedAtUtc,
    };
}

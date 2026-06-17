using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.CaseStudy.Api.Controllers;

[ApiController]
[Route("api/po-intake-draft")]
[Authorize]
public class PoIntakeDraftController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public PoIntakeDraftController(ApplicationDbContext db) => _db = db;

    [HttpGet("mine")]
    public async Task<ActionResult<PoIntakeDraftDto>> GetMine(CancellationToken ct)
    {
        var userId = CurrentUserId();
        if (userId is null) return Unauthorized();

        var row = await _db.PoIntakeDrafts.AsNoTracking()
            .FirstOrDefaultAsync(x => x.UserId == userId, ct);
        if (row is null) return NotFound();

        return Ok(Deserialize(row.DraftJson, row.UpdatedAtUtc));
    }

    [HttpPut]
    public async Task<ActionResult<PoIntakeDraftDto>> Save(
        [FromBody] PoIntakeDraftDto request,
        CancellationToken ct)
    {
        var userId = CurrentUserId();
        if (userId is null) return Unauthorized();

        var payload = JsonSerializer.Serialize(request);
        var row = await _db.PoIntakeDrafts
            .FirstOrDefaultAsync(x => x.UserId == userId, ct);
        var now = DateTime.UtcNow;

        if (row is null)
        {
            row = new PoIntakeDraft
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                DraftJson = payload,
                UpdatedAtUtc = now,
            };
            _db.PoIntakeDrafts.Add(row);
        }
        else
        {
            row.DraftJson = payload;
            row.UpdatedAtUtc = now;
        }

        await _db.SaveChangesAsync(ct);
        return Ok(Deserialize(row.DraftJson, row.UpdatedAtUtc));
    }

    [HttpDelete("mine")]
    public async Task<IActionResult> DeleteMine(CancellationToken ct)
    {
        var userId = CurrentUserId();
        if (userId is null) return Unauthorized();

        await _db.PoIntakeDrafts
            .Where(x => x.UserId == userId)
            .ExecuteDeleteAsync(ct);
        return NoContent();
    }

    private string? CurrentUserId() =>
        User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? User.FindFirstValue("sub");

    private static PoIntakeDraftDto Deserialize(string json, DateTime updatedAtUtc)
    {
        try
        {
            var dto = JsonSerializer.Deserialize<PoIntakeDraftDto>(json);
            if (dto is null)
                return EmptyDraft(updatedAtUtc);
            return new PoIntakeDraftDto
            {
                Step = dto.Step,
                PoNumber = dto.PoNumber ?? "",
                AssignmentType = dto.AssignmentType ?? "",
                PromulgationDate = dto.PromulgationDate ?? "",
                AssignmentSpecialist = dto.AssignmentSpecialist ?? "",
                AssignmentSpecialistEmail = dto.AssignmentSpecialistEmail ?? "",
                ExpectedPropertyCount = dto.ExpectedPropertyCount > 0
                    ? dto.ExpectedPropertyCount
                    : 1,
                UpdatedAtUtc = updatedAtUtc,
            };
        }
        catch
        {
            return EmptyDraft(updatedAtUtc);
        }
    }

    private static PoIntakeDraftDto EmptyDraft(DateTime updatedAtUtc) => new()
    {
        Step = 1,
        ExpectedPropertyCount = 1,
        UpdatedAtUtc = updatedAtUtc,
    };
}

using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.CaseStudy.Api.Controllers;

[ApiController]
[Route("api/internal-delegation-letters")]
[Authorize]
public class InternalDelegationLettersController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public InternalDelegationLettersController(ApplicationDbContext db) => _db = db;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<InternalDelegationLetterDto>>> Get(
        [FromQuery] string poNumber,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(poNumber))
            return BadRequest(new { error = "poNumber is required" });

        var row = await _db.InternalDelegationLetterSets.AsNoTracking()
            .FirstOrDefaultAsync(x => x.PoNumber == poNumber.Trim(), ct);
        return Ok(row is null ? [] : Deserialize(row.LettersJson));
    }

    [HttpPut]
    public async Task<ActionResult<IReadOnlyList<InternalDelegationLetterDto>>> Save(
        [FromBody] SaveInternalDelegationLettersRequest request,
        CancellationToken ct)
    {
        var po = request.PoNumber.Trim();
        if (string.IsNullOrEmpty(po))
            return BadRequest(new { error = "poNumber is required" });

        var payload = JsonSerializer.Serialize(request.Letters ?? []);
        var row = await _db.InternalDelegationLetterSets
            .FirstOrDefaultAsync(x => x.PoNumber == po, ct);
        var now = DateTime.UtcNow;

        if (row is null)
        {
            row = new InternalDelegationLetterSet
            {
                Id = Guid.NewGuid(),
                PoNumber = po,
                LettersJson = payload,
                UpdatedAtUtc = now,
            };
            _db.InternalDelegationLetterSets.Add(row);
        }
        else
        {
            row.LettersJson = payload;
            row.UpdatedAtUtc = now;
        }

        await _db.SaveChangesAsync(ct);
        return Ok(Deserialize(row.LettersJson));
    }

    private static IReadOnlyList<InternalDelegationLetterDto> Deserialize(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<List<InternalDelegationLetterDto>>(json) ?? [];
        }
        catch
        {
            return [];
        }
    }
}

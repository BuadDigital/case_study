using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.CaseStudy.Api.Controllers;

[ApiController]
[Route("api/suspended-transactions")]
[Authorize]
public class SuspendedTransactionsController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public SuspendedTransactionsController(ApplicationDbContext db) => _db = db;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<SuspendedTransactionDto>>> List(
        CancellationToken ct)
    {
        var rows = await _db.PropertyFailures.AsNoTracking()
            .Where(x => x.Status == "suspended")
            .OrderByDescending(x => x.UpdatedAtUtc)
            .ToListAsync(ct);

        var dtos = rows.Select(x => new SuspendedTransactionDto
        {
            Id = x.Id,
            PoNumber = x.PoNumber,
            PropertyId = x.PropertyId,
            FailureId = x.Id.ToString(),
            DeedNumber = x.DeedNumber,
            Title = x.Title,
            InternalNote = x.InternalNote,
            RaisedByRole = x.RaisedByRole,
            Specialist = x.Specialist,
            SupervisorNote = x.FinalNote,
            SuspendedAt = x.UpdatedAtUtc,
            SuspendedBy = x.RaisedByRole,
        }).ToList();

        return Ok(dtos);
    }
}

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Operations.Application.Abstractions;

namespace RealEstateEval.Operations.Api.Controllers;

/// <summary>
/// Authenticated side-effects used by Case Study billing. Operator queue keeps existing policies.
/// </summary>
[ApiController]
[Route("api/operations-task-dispatch")]
[Authorize]
public sealed class OperationsTaskDispatchController(IOperationsTaskService tasks) : ControllerBase
{
    [HttpPost("backfill-visit-charges")]
    public async Task<ActionResult<object>> BackfillVisitCharges(CancellationToken cancellationToken)
    {
        var count = await tasks.BackfillMissingCourtVisitChargesAsync(cancellationToken);
        return Ok(new { count });
    }
}

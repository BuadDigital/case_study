using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web;
using RealEstateEval.Shared.Web.Authorization;
using RealEstateEval.Platform.Application.Abstractions;
using RealEstateEval.Platform.Application.Contracts;

namespace RealEstateEval.Platform.Api.Controllers;

[ApiController]
[Route("api/field-sync-status")]
[Authorize]
public sealed class FieldSyncStatusController(IFieldSyncStatusService status) : ControllerBase
{
    [HttpPut]
    public async Task<IActionResult> Upsert(
        [FromBody] UpsertFieldSyncStatusRequest request,
        CancellationToken ct)
    {
        var userId = ActorClaims.Id(User);
        if (string.IsNullOrWhiteSpace(userId)) return Unauthorized();
        await status.UpsertAsync(userId, request, ct);
        return NoContent();
    }

    [HttpDelete]
    public async Task<IActionResult> Clear(CancellationToken ct)
    {
        var userId = ActorClaims.Id(User);
        if (string.IsNullOrWhiteSpace(userId)) return Unauthorized();
        await status.ClearAsync(userId, ct);
        return NoContent();
    }

 /// <summary>Supervisor board: pending offline work older than two hours.</summary>
    [HttpGet("stale")]
    [Authorize(Policy = CapabilityPolicyNames.ManageOperations)]
    public async Task<ActionResult<IReadOnlyList<FieldSyncStatusDto>>> ListStale(
        CancellationToken ct)
        => Ok(await status.ListStaleAsync(ct));
}

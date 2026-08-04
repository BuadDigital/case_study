using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web;

namespace RealEstateEval.Platform.Api.Controllers;

[ApiController]
[Route("api/push")]
[Authorize]
public sealed class PushSubscriptionsController : ControllerBase
{
    private readonly IPushSubscriptionService _push;

    public PushSubscriptionsController(IPushSubscriptionService push)
    {
        _push = push;
    }

    [HttpGet("config")]
    [AllowAnonymous]
    public async Task<ActionResult<PushConfigDto>> Config(CancellationToken ct) =>
        Ok(await _push.GetConfigAsync(ct));

    [HttpGet("subscriptions")]
    public async Task<ActionResult<IReadOnlyList<PushSubscriptionDto>>> List(CancellationToken ct)
    {
        var userId = CurrentUserId();
        if (userId is null) return Unauthorized();
        return Ok(await _push.ListForUserAsync(userId, ct));
    }

    [HttpPost("subscriptions")]
    public async Task<ActionResult<PushSubscriptionDto>> Upsert(
        [FromBody] RegisterPushSubscriptionRequest request,
        CancellationToken ct)
    {
        var userId = CurrentUserId();
        if (userId is null) return Unauthorized();
        try
        {
            return Ok(await _push.UpsertAsync(userId, request, ct));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpDelete("subscriptions")]
    public async Task<IActionResult> Delete(
        [FromBody] DeletePushSubscriptionRequest request,
        CancellationToken ct)
    {
        var userId = CurrentUserId();
        if (userId is null) return Unauthorized();
        if (string.IsNullOrWhiteSpace(request.Endpoint)) return BadRequest("endpoint required");
        return await _push.DeleteAsync(userId, request.Endpoint, ct) ? NoContent() : NotFound();
    }

    [HttpGet("preferences")]
    public async Task<ActionResult<PushPreferenceDto>> GetPreference(CancellationToken ct)
    {
        var userId = CurrentUserId();
        if (userId is null) return Unauthorized();
        return Ok(await _push.GetPreferenceAsync(userId, ct));
    }

    [HttpPut("preferences")]
    public async Task<ActionResult<PushPreferenceDto>> SetPreference(
        [FromBody] SetPushPreferenceRequest request,
        CancellationToken ct)
    {
        var userId = CurrentUserId();
        if (userId is null) return Unauthorized();
        return Ok(await _push.SetPreferenceAsync(userId, request.PushEnabled, ct));
    }

    private string? CurrentUserId()
    {
        var id = ActorClaims.Id(User);
        return id is "unknown" or "" ? null : id;
    }
}

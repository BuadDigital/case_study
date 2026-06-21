using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web.Authorization;

namespace RealEstateEval.CaseStudy.Api.Controllers;

[ApiController]
[Route("api/po-intake-draft")]
[Authorize]
public class PoIntakeDraftController : ControllerBase
{
    private readonly IPoIntakeDraftService _drafts;

    public PoIntakeDraftController(IPoIntakeDraftService drafts) => _drafts = drafts;

    [HttpGet("mine")]
    public async Task<ActionResult<PoIntakeDraftDto>> GetMine(CancellationToken ct)
    {
        var userId = CurrentUserId();
        if (userId is null) return Unauthorized();

        var dto = await _drafts.GetForUserAsync(userId, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPut]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<ActionResult<PoIntakeDraftDto>> Save(
        [FromBody] PoIntakeDraftDto request,
        CancellationToken ct)
    {
        var userId = CurrentUserId();
        if (userId is null) return Unauthorized();

        return Ok(await _drafts.SaveForUserAsync(userId, request, ct));
    }

    [HttpDelete("mine")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<IActionResult> DeleteMine(CancellationToken ct)
    {
        var userId = CurrentUserId();
        if (userId is null) return Unauthorized();

        await _drafts.DeleteForUserAsync(userId, ct);
        return NoContent();
    }

    private string? CurrentUserId() =>
        User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);
}

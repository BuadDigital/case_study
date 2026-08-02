using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web;
using RealEstateEval.Shared.Web.Authorization;

namespace RealEstateEval.Platform.Api.Controllers;

[ApiController]
[Route("api/organization-settings")]
[Authorize]
public sealed class OrganizationSettingsController(IOrganizationSettingsService settings) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<OrganizationSettingsDto>> Get(CancellationToken ct)
        => Ok(await settings.GetAsync(ct));

    [HttpPut]
    [Authorize(Policy = CapabilityPolicyNames.ManageSystemConfig)]
    public async Task<ActionResult<OrganizationSettingsDto>> Save(
        [FromBody] SaveOrganizationSettingsRequest request,
        CancellationToken ct)
    {
        try
        {
            return Ok(await settings.SaveAsync(request, ActorClaims.Id(User), ct));
        }
        catch (ArgumentOutOfRangeException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}

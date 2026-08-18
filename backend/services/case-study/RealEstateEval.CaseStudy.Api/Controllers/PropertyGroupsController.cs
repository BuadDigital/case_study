using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web;
using RealEstateEval.Shared.Web.Authorization;

namespace RealEstateEval.CaseStudy.Api.Controllers;

/// <summary>
/// grouped-property linking: system suggests, a human confirms (audited),
/// reversible with a reason. Work orders stay administratively independent.
/// </summary>
[ApiController]
[Route("api/property-groups")]
[Authorize]
public class PropertyGroupsController : ControllerBase
{
    private readonly IPropertyGroupService _groups;

    public PropertyGroupsController(IPropertyGroupService groups) => _groups = groups;

    [HttpGet("by-property/{propertyId:guid}")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<ActionResult<PropertyGroupDto?>> GetForProperty(
        Guid propertyId,
        CancellationToken ct)
        => Ok(await _groups.GetForPropertyAsync(propertyId, ct));

    [HttpGet("by-property/{propertyId:guid}/suggestions")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<ActionResult<IReadOnlyList<PropertyGroupSuggestionDto>>> Suggest(
        Guid propertyId,
        CancellationToken ct)
        => Ok(await _groups.SuggestAsync(propertyId, ct));

    [HttpPost("by-property/{propertyId:guid}/link")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<ActionResult<PropertyGroupDto>> ConfirmLink(
        Guid propertyId,
        [FromBody] ConfirmPropertyGroupLinkRequest request,
        CancellationToken ct)
    {
        var (result, error) = await _groups.ConfirmLinkAsync(
            propertyId, request.TargetPropertyId, ActorClaims.Id(User), ct);
        if (error is not null) return this.BadRequestProblem(error);
        return Ok(result);
    }

    [HttpPost("by-property/{propertyId:guid}/unlink")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<ActionResult<PropertyGroupDto>> Unlink(
        Guid propertyId,
        [FromBody] UnlinkPropertyGroupRequest request,
        CancellationToken ct)
    {
        var (result, error) = await _groups.UnlinkAsync(
            propertyId, request.Reason, ActorClaims.Id(User), ct);
        if (error is not null) return this.BadRequestProblem(error);
        return Ok(result);
    }
}

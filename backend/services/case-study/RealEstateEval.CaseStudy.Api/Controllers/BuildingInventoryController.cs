using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Shared.Web;
using RealEstateEval.Shared.Web.Authorization;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Abstractions;

namespace RealEstateEval.CaseStudy.Api.Controllers;

[ApiController]
[Route("api/work-orders/{poNumber}/properties/{propertyId:guid}/building-inventory")]
[Authorize]
public class BuildingInventoryController : ControllerBase
{
    private readonly IBuildingInventoryService _inventory;
    private readonly IPermissionService _permissions;

    public BuildingInventoryController(
        IBuildingInventoryService inventory,
        IPermissionService permissions)
    {
        _inventory = inventory;
        _permissions = permissions;
    }

    [HttpGet]
    [Authorize(Policy = CapabilityPolicyNames.ReadInspectionContext)]
    public async Task<ActionResult<BuildingInventoryDto>> Get(
        string poNumber,
        Guid propertyId,
        CancellationToken cancellationToken)
    {
        var row = await _inventory.GetAsync(poNumber, propertyId, cancellationToken);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpPut]
    [Authorize(Policy = CapabilityPolicyNames.SubmitPartyWork)]
    public async Task<ActionResult<BuildingInventoryDto>> Save(
        string poNumber,
        Guid propertyId,
        [FromBody] SaveBuildingInventoryRequest request,
        CancellationToken cancellationToken)
    {
        var (result, errors) = await _inventory.SaveAsync(
            poNumber,
            propertyId,
            request,
            cancellationToken,
            await ResolveActorAsync(cancellationToken));
        if (errors is not null)
            return this.FieldErrorsProblem(errors);
        return Ok(result);
    }

    /// <summary>Identity comes from the token, never the body — it stamps who wrote each line.</summary>
    private async Task<PartySubmissionActor> ResolveActorAsync(CancellationToken ct)
    {
        var userId = ActorClaims.Id(User);
        var permissions = string.IsNullOrWhiteSpace(userId) || userId == "unknown"
            ? null
            : await _permissions.GetForUserIdAsync(userId, ct);

        return new PartySubmissionActor
        {
            UserId = userId == "unknown" ? "" : userId,
            DisplayName = ActorClaims.DisplayName(User),
            PrototypeRole = permissions?.PrototypeRole,
            DistributionAssigneeId = permissions?.DistributionAssigneeId,
        };
    }
}

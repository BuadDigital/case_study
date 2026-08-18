using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web;
using RealEstateEval.Shared.Web.Authorization;

namespace RealEstateEval.CaseStudy.Api.Controllers;

[ApiController]
[Route("api/work-orders/{poNumber}/properties/{propertyId:guid}/building-inventory")]
[Authorize]
public class BuildingInventoryController : ControllerBase
{
    private readonly IBuildingInventoryService _inventory;

    public BuildingInventoryController(IBuildingInventoryService inventory)
    {
        _inventory = inventory;
    }

    [HttpGet]
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
            cancellationToken);
        if (errors is not null)
            return this.FieldErrorsProblem(errors);
        return Ok(result);
    }
}

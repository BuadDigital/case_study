using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web;
using RealEstateEval.Shared.Web.Authorization;

namespace RealEstateEval.Platform.Api.Controllers;

[ApiController]
[Route("api/valuation-lists")]
[Authorize]
public class ValuationListsController(IValuationListsService catalog) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ValuationListsDto>> Get(CancellationToken ct)
        => Ok(await catalog.GetAsync(ct));

    [HttpPut]
    [Authorize(Policy = CapabilityPolicyNames.ManageSystemConfig)]
    public async Task<ActionResult<ValuationListsDto>> Save(
        [FromBody] SaveValuationListsRequest request,
        CancellationToken ct)
        => Ok(await catalog.SaveAsync(request, ActorClaims.Id(User), ct));

    /// <summary>Called by the case-study service when an inspection carrying a usage is saved.</summary>
    [HttpPost("property-usages/record")]
    [Authorize(Policy = CapabilityPolicyNames.RecordPropertyUsage)]
    public async Task<IActionResult> RecordPropertyUsage(
        [FromBody] RecordPropertyUsageRequest request,
        CancellationToken ct)
    {
        await catalog.RecordPropertyUsageAsync(request.NameAr ?? "", ActorClaims.Id(User), ct);
        return NoContent();
    }

    [HttpPost("property-usages/{key}/review")]
    [Authorize(Policy = CapabilityPolicyNames.ReviewPropertyUsage)]
    public async Task<ActionResult<ValuationListsDto>> ReviewPropertyUsage(
        string key,
        [FromBody] ReviewPropertyUsageRequest request,
        CancellationToken ct)
    {
        try
        {
            return Ok(await catalog.ReviewPropertyUsageAsync(key, request, ActorClaims.Id(User), ct));
        }
        catch (InvalidOperationException ex)
        {
            return this.BadRequestProblem(ex.Message);
        }
    }
}

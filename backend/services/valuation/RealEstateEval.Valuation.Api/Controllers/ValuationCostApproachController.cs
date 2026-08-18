using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web;
using RealEstateEval.Shared.Web.Authorization;

namespace RealEstateEval.Valuation.Api.Controllers;

/// <summary>Contractor cost approach — land imported from market .</summary>
[ApiController]
[Route("api/valuation-requests/{valuationRequestId:guid}/cost-approach")]
[Authorize]
public class ValuationCostApproachController : ControllerBase
{
    private readonly IValuationCostApproachService _cost;

    public ValuationCostApproachController(IValuationCostApproachService cost) => _cost = cost;

    [HttpGet]
    [Authorize(Policy = CapabilityPolicyNames.ReadValuationQueue)]
    public async Task<ActionResult<ValuationCostApproachDto>> Get(
        Guid valuationRequestId,
        CancellationToken ct)
    {
        var dto = await _cost.GetAsync(valuationRequestId, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPut]
    [Authorize(Policy = CapabilityPolicyNames.SubmitValuationReport)]
    public async Task<ActionResult<ValuationCostApproachDto>> Save(
        Guid valuationRequestId,
        [FromBody] SaveValuationCostApproachRequest request,
        CancellationToken ct)
    {
        var (result, errors) = await _cost.SaveAsync(valuationRequestId, request, ct);
        if (errors is not null)
            return this.FieldErrorsProblem(errors);
        return Ok(result);
    }
}

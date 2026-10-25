using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Shared.Web;
using RealEstateEval.Shared.Web.Authorization;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Application.Contracts;

namespace RealEstateEval.Valuation.Api.Controllers;

/// <summary>D17 — income approach (direct capitalisation); same read/write policies as the cost approach.</summary>
[ApiController]
[Route("api/valuation-requests/{valuationRequestId:guid}/income-approach")]
[Authorize]
public class ValuationIncomeApproachController : ControllerBase
{
    private readonly IValuationIncomeApproachService _income;

    public ValuationIncomeApproachController(IValuationIncomeApproachService income) => _income = income;

    [HttpGet]
    [Authorize(Policy = CapabilityPolicyNames.ReadValuationReport)]
    public async Task<ActionResult<ValuationIncomeApproachDto>> Get(
        Guid valuationRequestId,
        CancellationToken ct)
    {
        var dto = await _income.GetAsync(valuationRequestId, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPut]
    [Authorize(Policy = CapabilityPolicyNames.SubmitValuationReport)]
    [RequireAssignedAppraiser]
    public async Task<ActionResult<ValuationIncomeApproachDto>> Save(
        Guid valuationRequestId,
        [FromBody] SaveValuationIncomeApproachRequest request,
        CancellationToken ct)
    {
        var (result, errors) = await _income.SaveAsync(valuationRequestId, request, ct);
        if (errors is not null)
            return this.FieldErrorsProblem(errors);
        return Ok(result);
    }
}

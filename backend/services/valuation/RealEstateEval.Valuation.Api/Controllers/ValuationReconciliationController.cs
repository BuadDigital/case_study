using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web;
using RealEstateEval.Shared.Web.Authorization;

namespace RealEstateEval.Valuation.Api.Controllers;

/// <summary>Reconciliation + round-once final opinion.</summary>
[ApiController]
[Route("api/valuation-requests/{valuationRequestId:guid}/reconciliation")]
[Authorize]
public class ValuationReconciliationController : ControllerBase
{
    private readonly IValuationReconciliationService _reconciliation;

    public ValuationReconciliationController(IValuationReconciliationService reconciliation) =>
        _reconciliation = reconciliation;

    [HttpGet]
    [Authorize(Policy = CapabilityPolicyNames.ReadValuationQueue)]
    public async Task<ActionResult<ValuationReconciliationDto>> Get(
        Guid valuationRequestId,
        CancellationToken ct)
    {
        var dto = await _reconciliation.GetAsync(valuationRequestId, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPut]
    [Authorize(Policy = CapabilityPolicyNames.SubmitValuationReport)]
    public async Task<ActionResult<ValuationReconciliationDto>> Save(
        Guid valuationRequestId,
        [FromBody] SaveValuationReconciliationRequest request,
        CancellationToken ct)
    {
        var (result, errors) = await _reconciliation.SaveAsync(
            valuationRequestId, request, ActorClaims.Id(User), ct);
        if (errors is not null)
            return this.FieldErrorsProblem(errors);
        return Ok(result);
    }
}

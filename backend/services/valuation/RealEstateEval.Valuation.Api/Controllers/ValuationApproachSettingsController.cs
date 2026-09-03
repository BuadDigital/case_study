using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web;
using RealEstateEval.Shared.Web.Authorization;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Application.Abstractions;

namespace RealEstateEval.Valuation.Api.Controllers;

/// <summary>Screen 1 — applied approaches (Q-2/Q-3) + cost basis/unit + adjustments unlock.</summary>
[ApiController]
[Route("api/valuation-requests/{valuationRequestId:guid}/approach-settings")]
[Authorize]
public class ValuationApproachSettingsController : ControllerBase
{
    private readonly IValuationApproachSettingsService _settings;

    public ValuationApproachSettingsController(IValuationApproachSettingsService settings) =>
        _settings = settings;

    [HttpGet]
    [Authorize(Policy = CapabilityPolicyNames.ReadValuationQueue)]
    public async Task<ActionResult<ValuationApproachSettingsDto>> Get(
        Guid valuationRequestId,
        CancellationToken ct)
    {
        var dto = await _settings.GetAsync(valuationRequestId, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPut]
    [Authorize(Policy = CapabilityPolicyNames.SubmitValuationReport)]
    public async Task<ActionResult<ValuationApproachSettingsDto>> Save(
        Guid valuationRequestId,
        [FromBody] SaveValuationApproachSettingsRequest request,
        CancellationToken ct)
    {
        var (result, errors) = await _settings.SaveAsync(valuationRequestId, request, ct);
        if (errors is not null)
            return this.FieldErrorsProblem(errors);
        return Ok(result);
    }
}

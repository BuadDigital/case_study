using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web;
using RealEstateEval.Shared.Web.Authorization;

namespace RealEstateEval.Valuation.Api.Controllers;

/// <summary>شاشة 1 — الأساليب المطبَّقة (ق-2/ق-3) + أساس ووحدة التكلفة + صلاحية التسويات.</summary>
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

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web.Authorization;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Application.Abstractions;

namespace RealEstateEval.Valuation.Api.Controllers;

/// <summary>Valuation report field payload (legacy template codes ⟵ Ejada field_key). Not printed as extra sections.</summary>
[ApiController]
[Route("api/valuation-requests/{valuationRequestId:guid}/valuation-report-fields")]
[Route("api/valuation-requests/{valuationRequestId:guid}/mikyas-injection")]
[Authorize]
public class ValuationReportFieldInjectionController : ControllerBase
{
    private readonly IValuationReportFieldInjectionService _injection;

    public ValuationReportFieldInjectionController(IValuationReportFieldInjectionService injection) =>
        _injection = injection;

    [HttpGet]
    [Authorize(Policy = CapabilityPolicyNames.ReadValuationQueue)]
    public async Task<ActionResult<ValuationReportFieldPayloadDto>> Get(
        Guid valuationRequestId,
        CancellationToken ct)
    {
        var dto = await _injection.GetPayloadAsync(valuationRequestId, ct);
        return dto is null ? NotFound() : Ok(dto);
    }
}

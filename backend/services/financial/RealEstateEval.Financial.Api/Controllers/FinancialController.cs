using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web.Authorization;

namespace RealEstateEval.Financial.Api.Controllers;

[ApiController]
[Route("api/financial/v1")]
[Authorize]
public class FinancialController : ControllerBase
{
    private readonly IFinancialReportService _financial;
    private readonly IPartyFeePricingService _pricing;

    public FinancialController(
        IFinancialReportService financial,
        IPartyFeePricingService pricing)
    {
        _financial = financial;
        _pricing = pricing;
    }

    [HttpGet("summary")]
    public async Task<ActionResult<FinancialSummaryDto>> Summary(CancellationToken ct)
        => Ok(await _financial.GetSummaryAsync(ct));

    [HttpPut("summary")]
    [Authorize(Policy = CapabilityPolicyNames.ManageFinancial)]
    public async Task<ActionResult<FinancialSummaryDto>> Save(
        [FromBody] FinancialSummaryDto request,
        CancellationToken ct)
        => Ok(await _financial.SaveSummaryAsync(request, ct));

    [HttpGet("party-fee-pricing")]
    public async Task<ActionResult<PartyFeePricingDto>> GetPartyFeePricing(CancellationToken ct)
        => Ok(await _pricing.GetAsync(ct));

    [HttpPut("party-fee-pricing")]
    [Authorize(Policy = CapabilityPolicyNames.ManageFinancial)]
    public async Task<ActionResult<PartyFeePricingDto>> SavePartyFeePricing(
        [FromBody] PartyFeePricingDto request,
        CancellationToken ct)
        => Ok(await _pricing.SaveAsync(request, ct));
}

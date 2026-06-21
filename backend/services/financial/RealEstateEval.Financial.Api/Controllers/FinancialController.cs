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

    public FinancialController(IFinancialReportService financial) => _financial = financial;

    [HttpGet("summary")]
    public async Task<ActionResult<FinancialSummaryDto>> Summary(CancellationToken ct)
        => Ok(await _financial.GetSummaryAsync(ct));

    [HttpPut("summary")]
    [Authorize(Policy = CapabilityPolicyNames.ManageFinancial)]
    public async Task<ActionResult<FinancialSummaryDto>> Save(
        [FromBody] FinancialSummaryDto request,
        CancellationToken ct)
        => Ok(await _financial.SaveSummaryAsync(request, ct));
}

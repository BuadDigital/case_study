using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web.Authorization;

namespace RealEstateEval.CaseStudy.Api.Controllers;

[ApiController]
[Route("api/enfaz-billing")]
[Authorize]
public class EnfazBillingController : ControllerBase
{
    private readonly IPoEnfazBillingService _billing;

    public EnfazBillingController(IPoEnfazBillingService billing) => _billing = billing;

    [HttpGet("ready-pos-summary")]
    public async Task<ActionResult<IReadOnlyList<EnfazReadyPoSummaryDto>>> ListReadyPosSummary(
        CancellationToken ct) =>
        Ok(await _billing.ListReadyPoSummariesAsync(ct));

    [HttpGet("{poNumber}")]
    public async Task<ActionResult<PoEnfazBillingDto>> GetPo(string poNumber, CancellationToken ct)
    {
        var dto = await _billing.GetPoBillingAsync(poNumber, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPut("{poNumber}")]
    [Authorize(Policy = CapabilityPolicyNames.ManageFinancial)]
    public async Task<ActionResult<PoEnfazBillingDto>> SavePo(
        string poNumber,
        [FromBody] SavePoEnfazBillingRequest request,
        CancellationToken ct)
    {
        var dto = await _billing.SavePoBillingAsync(poNumber, request, ct);
        return dto is null ? BadRequest(new { error = "تعذر حفظ أتعاب إنفاذ." }) : Ok(dto);
    }

    [HttpGet("tracking")]
    public async Task<ActionResult<IReadOnlyList<EnfazTrackingRowDto>>> Tracking(
        CancellationToken ct) =>
        Ok(await _billing.ListTrackingAsync(ct));

    [HttpPost("{poNumber}/issue-invoice")]
    [Authorize(Policy = CapabilityPolicyNames.ManageFinancial)]
    public async Task<ActionResult<PoEnfazBillingDto>> IssueInvoice(
        string poNumber,
        CancellationToken ct)
    {
        var dto = await _billing.IssueInvoiceAsync(poNumber, ct);
        return dto is null
            ? BadRequest(new { error = "تعذر إصدار الفاتورة — تحقق من اكتمال أمر العمل وتعبئة الأتعاب." })
            : Ok(dto);
    }

    [HttpGet("{poNumber}/properties/{propertyId:guid}")]
    public async Task<ActionResult<PropertyEnfazRevenueDto>> GetPropertyRevenue(
        string poNumber,
        Guid propertyId,
        CancellationToken ct) =>
        Ok(await _billing.GetPropertyRevenueAsync(poNumber, propertyId, ct)
            ?? new PropertyEnfazRevenueDto());
}

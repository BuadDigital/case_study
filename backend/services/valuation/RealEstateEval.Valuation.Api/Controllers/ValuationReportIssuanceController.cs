using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Shared.Web;
using RealEstateEval.Shared.Web.Authorization;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Application.Contracts;

namespace RealEstateEval.Valuation.Api.Controllers;

/// <summary>
/// ق-6: الإصدار ثنائي المرحلة + شهادة الإيداع — نسخة الإيداع المجمّدة ثم النسخة النهائية.
/// </summary>
[ApiController]
[Route("api/valuation-requests/{valuationRequestId:guid}/report-issuance")]
[Authorize]
public class ValuationReportIssuanceController : ControllerBase
{
    private readonly IValuationReportIssuanceService _issuance;

    public ValuationReportIssuanceController(IValuationReportIssuanceService issuance) =>
        _issuance = issuance;

    [HttpGet]
    [Authorize(Policy = CapabilityPolicyNames.ReadValuationQueue)]
    public async Task<ActionResult<ValuationReportIssuanceStateDto>> GetState(
        Guid valuationRequestId,
        CancellationToken ct)
    {
        var state = await _issuance.GetStateAsync(valuationRequestId, ct);
        return state is null ? NotFound() : Ok(state);
    }

    [HttpPost("deposit")]
    [Authorize(Policy = CapabilityPolicyNames.SubmitValuationReport)]
    public async Task<ActionResult<ValuationReportIssuanceStateDto>> IssueDeposit(
        Guid valuationRequestId,
        CancellationToken ct)
    {
        var (result, errors) = await _issuance.IssueDepositAsync(
            valuationRequestId,
            ActorClaims.Id(User),
            ct);
        if (errors is not null)
            return this.FieldErrorsProblem(errors);
        return Ok(result);
    }

    [HttpPost("certificate")]
    [Authorize(Policy = CapabilityPolicyNames.SubmitValuationReport)]
    public async Task<ActionResult<ValuationReportIssuanceStateDto>> RegisterCertificate(
        Guid valuationRequestId,
        [FromBody] RegisterDepositCertificateRequest request,
        CancellationToken ct)
    {
        var (result, errors) = await _issuance.RegisterCertificateAsync(
            valuationRequestId,
            request,
            ActorClaims.Id(User),
            ct);
        if (errors is not null)
            return this.FieldErrorsProblem(errors);
        return Ok(result);
    }

    [HttpGet("deposit-pdf")]
    [Authorize(Policy = CapabilityPolicyNames.ReadValuationQueue)]
    public async Task<IActionResult> DepositPdf(Guid valuationRequestId, CancellationToken ct)
    {
        var pdf = await _issuance.GetDepositPdfAsync(valuationRequestId, ct);
        return pdf is null or { Length: 0 }
            ? NotFound()
            : File(pdf, "application/pdf", $"valuation-deposit-{valuationRequestId}.pdf");
    }

    [HttpGet("final-pdf")]
    [Authorize(Policy = CapabilityPolicyNames.ReadValuationQueue)]
    public async Task<IActionResult> FinalPdf(Guid valuationRequestId, CancellationToken ct)
    {
        var pdf = await _issuance.GetFinalPdfAsync(valuationRequestId, ct);
        return pdf is null or { Length: 0 }
            ? NotFound()
            : File(pdf, "application/pdf", $"valuation-final-{valuationRequestId}.pdf");
    }
}

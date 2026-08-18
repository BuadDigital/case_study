using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web.Authorization;

namespace RealEstateEval.Valuation.Api.Controllers;

/// <summary>Native valuation report document preview.</summary>
[ApiController]
[Route("api/valuation-requests/{valuationRequestId:guid}/report-document")]
[Authorize]
public class ValuationReportDocumentController : ControllerBase
{
    private readonly IValuationReportDocumentService _reports;

    public ValuationReportDocumentController(IValuationReportDocumentService reports) =>
        _reports = reports;

    [HttpGet]
    [Authorize(Policy = CapabilityPolicyNames.ReadValuationQueue)]
    public async Task<ActionResult<ValuationReportDocumentDto>> GetPreview(
        Guid valuationRequestId,
        CancellationToken ct)
    {
        var dto = await _reports.GetPreviewAsync(valuationRequestId, ct);
        return dto is null ? NotFound() : Ok(dto);
    }
}

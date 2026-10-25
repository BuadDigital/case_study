using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web;

namespace RealEstateEval.Valuation.Api.Controllers;

/// <summary>
/// Authenticated lookup/create used by Case Study appraisal dispatch. Not the
/// operator queue (those routes keep ReadValuationQueue / ManageValuationRequests).
/// </summary>
[ApiController]
[Route("api/valuation-request-dispatch")]
[Authorize]
[RequireUpstreamDispatch]
public sealed class ValuationRequestDispatchController(
    IValuationRequestService service,
    IValuationRequestFolding folding) : ControllerBase
{
    /// <summary>Phase 5: the merged deeds' open requests fold into the holder deed's request.</summary>
    [HttpPost("fold")]
    public async Task<ActionResult<FoldValuationRequestsResultDto>> Fold(
        [FromBody] FoldValuationRequestsRequest request,
        CancellationToken cancellationToken) =>
        Ok(await folding.FoldAsync(request, cancellationToken));

    /// <summary>Phase 5: a deed taken out of a transaction gets its own request back.</summary>
    [HttpPost("unfold")]
    public async Task<ActionResult<FoldValuationRequestsResultDto>> Unfold(
        [FromBody] UnfoldValuationRequestRequest request,
        CancellationToken cancellationToken) =>
        Ok(await folding.UnfoldAsync(request, cancellationToken));

    [HttpGet("open-by-property/{propertyId}")]
    public async Task<ActionResult<ValuationRequestDto>> GetOpenByProperty(
        string propertyId,
        CancellationToken cancellationToken)
    {
        var dto = await service.GetOpenByPropertyAsync(propertyId, cancellationToken);
        return this.OkOrEmpty(dto);
    }

    /// <summary>Case study checks the final report is ready before the Enfaz handover.</summary>
    [HttpGet("final-report-status-by-property/{propertyId}")]
    public async Task<ActionResult<PropertyFinalReportStatusDto>> GetFinalReportStatusByProperty(
        string propertyId,
        CancellationToken cancellationToken) =>
        Ok(new PropertyFinalReportStatusDto
        {
            FinalReportStatus = await service.GetFinalReportStatusByPropertyAsync(propertyId, cancellationToken),
        });

    [HttpPost]
    public async Task<ActionResult<ValuationRequestDto>> Create(
        [FromBody] SaveValuationRequestRequest request,
        CancellationToken cancellationToken)
    {
        var (dto, error) = await service.CreateAsync(request, cancellationToken);
        return error switch
        {
            "property_id_required" => this.BadRequestProblem("معرّف العقار مطلوب"),
            "valuation_already_open" => this.ConflictProblem(
                "an open valuation request already exists for this property"),
            "duplicate_display_id" => this.ConflictProblem("display id already in use"),
            _ => dto is null ? this.BadRequestProblem("تعذّر إنشاء طلب التقييم") : Ok(dto),
        };
    }
}

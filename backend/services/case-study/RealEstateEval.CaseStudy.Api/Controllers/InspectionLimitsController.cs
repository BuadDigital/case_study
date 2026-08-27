using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web;
using RealEstateEval.Shared.Web.Authorization;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Abstractions;

namespace RealEstateEval.CaseStudy.Api.Controllers;

/// <summary>حدود المعاينة (القرار 24 + ق-7) — يعبّئها المعاين، ويعتمد المكتبيةَ المقيّمُ المعتمد.</summary>
[ApiController]
[Route("api/work-orders/{poNumber}/properties/{propertyId:guid}/inspection-limits")]
[Authorize]
public class InspectionLimitsController : ControllerBase
{
    private readonly IInspectionLimitsService _limits;

    public InspectionLimitsController(IInspectionLimitsService limits) => _limits = limits;

    [HttpGet]
    public async Task<ActionResult<InspectionLimitsDto>> Get(
        string poNumber,
        Guid propertyId,
        CancellationToken ct)
    {
        var dto = await _limits.GetAsync(poNumber, propertyId, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPut]
    [Authorize(Policy = CapabilityPolicyNames.SubmitPartyWork)]
    public async Task<ActionResult<InspectionLimitsDto>> Save(
        string poNumber,
        Guid propertyId,
        [FromBody] SaveInspectionLimitsRequest request,
        CancellationToken ct)
    {
        var (result, errors) = await _limits.SaveAsync(poNumber, propertyId, request, ct);
        if (errors is not null)
            return this.FieldErrorsProblem(errors);
        return Ok(result);
    }

 /// <summary>ق-7 — «من يمنح لمن» تفصيلاً معلّق؛ حالياً صلاحية إصدار التقرير.</summary>
    [HttpPost("approve-remote")]
    [Authorize(Policy = CapabilityPolicyNames.SubmitValuationReport)]
    public async Task<ActionResult<InspectionLimitsDto>> ApproveRemote(
        string poNumber,
        Guid propertyId,
        CancellationToken ct)
    {
        var (result, error) = await _limits.ApproveRemoteAsync(
            poNumber, propertyId, ActorClaims.Id(User), ct);
        if (error is not null)
            return this.BadRequestProblem(error);
        return Ok(result);
    }
}

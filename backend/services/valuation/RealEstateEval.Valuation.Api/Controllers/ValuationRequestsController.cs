using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web.Authorization;

namespace RealEstateEval.Valuation.Api.Controllers;

[ApiController]
[Route("api/valuation-requests")]
[Authorize]
public class ValuationRequestsController : ControllerBase
{
    private readonly IValuationRequestService _service;

    public ValuationRequestsController(IValuationRequestService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ValuationRequestDto>>> List(CancellationToken ct)
        => Ok(await _service.ListAsync(ct));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ValuationRequestDto>> Get(Guid id, CancellationToken ct)
    {
        var dto = await _service.GetAsync(id, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPost]
    [Authorize(Policy = CapabilityPolicyNames.ManageValuationRequests)]
    public async Task<ActionResult<ValuationRequestDto>> Create(
        [FromBody] SaveValuationRequestRequest request,
        CancellationToken ct)
    {
        var dto = await _service.CreateAsync(request, ct);
        return CreatedAtAction(nameof(Get), new { id = dto.Id }, dto);
    }

    [HttpPost("{id:guid}/submit-report")]
    [Authorize(Policy = CapabilityPolicyNames.SubmitValuationReport)]
    public async Task<ActionResult<ValuationRequestDto>> SubmitReport(Guid id, CancellationToken ct)
    {
        var (result, error) = await _service.SubmitReportAsync(id, ct);
        return error switch
        {
            "not_found" => NotFound(),
            "already_submitted" => BadRequest(new { error = "report already submitted" }),
            _ => Ok(result),
        };
    }

    [HttpPost("{id:guid}/impediment")]
    [Authorize(Policy = CapabilityPolicyNames.SubmitValuationReport)]
    public async Task<ActionResult<ValuationRequestDto>> RecordImpediment(
        Guid id,
        [FromBody] ValuationImpedimentRequest request,
        CancellationToken ct)
    {
        var (result, error) = await _service.RecordImpedimentAsync(id, request, ct);
        return error switch
        {
            "not_found" => NotFound(),
            "already_submitted" => BadRequest(new { error = "report already submitted" }),
            "already_impeded" => BadRequest(new { error = "impediment already recorded" }),
            "reason_required" => BadRequest(new { error = "reason is required" }),
            _ => Ok(result),
        };
    }
}

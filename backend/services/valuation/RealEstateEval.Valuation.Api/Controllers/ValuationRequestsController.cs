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

    [HttpPut("{id:guid}")]
    [Authorize(Policy = CapabilityPolicyNames.ManageValuationRequests)]
    public async Task<ActionResult<ValuationRequestDto>> Update(
        Guid id,
        [FromBody] SaveValuationRequestRequest request,
        CancellationToken ct)
    {
        var dto = await _service.UpdateAsync(id, request, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = CapabilityPolicyNames.ManageValuationRequests)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
        => await _service.DeleteAsync(id, ct) ? NoContent() : NotFound();

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
}

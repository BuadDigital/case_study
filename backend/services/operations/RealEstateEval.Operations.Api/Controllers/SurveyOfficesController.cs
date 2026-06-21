using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web.Authorization;

namespace RealEstateEval.Operations.Api.Controllers;

[ApiController]
[Route("api/survey-offices")]
[Authorize]
public class SurveyOfficesController : ControllerBase
{
    private readonly ISurveyOfficesService _offices;

    public SurveyOfficesController(ISurveyOfficesService offices) => _offices = offices;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<SurveyOfficeDto>>> List(CancellationToken ct)
        => Ok(await _offices.ListAsync(ct));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<SurveyOfficeDto>> Get(Guid id, CancellationToken ct)
    {
        var dto = await _offices.GetAsync(id, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPost]
    [Authorize(Policy = CapabilityPolicyNames.ManageOperations)]
    public async Task<ActionResult<SurveyOfficeDto>> Create(
        [FromBody] SaveSurveyOfficeRequest request,
        CancellationToken ct)
    {
        var dto = await _offices.CreateAsync(request, ct);
        return CreatedAtAction(nameof(Get), new { id = dto.Id }, dto);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = CapabilityPolicyNames.ManageOperations)]
    public async Task<ActionResult<SurveyOfficeDto>> Update(
        Guid id,
        [FromBody] SaveSurveyOfficeRequest request,
        CancellationToken ct)
    {
        var dto = await _offices.UpdateAsync(id, request, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = CapabilityPolicyNames.ManageOperations)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
        => await _offices.DeleteAsync(id, ct) ? NoContent() : NotFound();
}

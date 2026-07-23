using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;

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
}

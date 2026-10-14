using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Platform.Application.Contracts;
using RealEstateEval.Platform.Application.Abstractions;

namespace RealEstateEval.Platform.Api.Controllers;

[ApiController]
[Route("api/field-dictionary")]
[Authorize]
public class FieldDictionaryController : ControllerBase
{
    private readonly IFieldDictionaryService _service;

    public FieldDictionaryController(IFieldDictionaryService service) => _service = service;

    [HttpGet]
    public async Task<ActionResult<FieldDictionaryStateDto>> Get(CancellationToken ct)
        => Ok(await _service.GetAsync(ct));
}

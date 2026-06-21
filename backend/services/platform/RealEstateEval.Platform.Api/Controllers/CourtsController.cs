using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web.Authorization;

namespace RealEstateEval.Platform.Api.Controllers;

[ApiController]
[Route("api/courts")]
[Authorize]
public class CourtsController : ControllerBase
{
    private readonly ICourtsCatalogService _service;

    public CourtsController(ICourtsCatalogService service) => _service = service;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CourtCatalogEntryDto>>> List(
        CancellationToken cancellationToken)
        => Ok(await _service.ListAsync(cancellationToken));

    [HttpPut]
    [Authorize(Policy = CapabilityPolicyNames.ManageSystemConfig)]
    public async Task<ActionResult<IReadOnlyList<CourtCatalogEntryDto>>> ReplaceAll(
        [FromBody] SaveCourtsCatalogRequest request,
        CancellationToken cancellationToken)
        => Ok(await _service.ReplaceAllAsync(request, cancellationToken));
}

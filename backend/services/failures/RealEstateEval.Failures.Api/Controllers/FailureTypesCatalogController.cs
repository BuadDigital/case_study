using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web.Authorization;

namespace RealEstateEval.Failures.Api.Controllers;

[ApiController]
[Route("api/failure-types-catalog")]
[Authorize]
public class FailureTypesCatalogController : ControllerBase
{
    private readonly IFailureTypesCatalogService _catalog;

    public FailureTypesCatalogController(IFailureTypesCatalogService catalog) => _catalog = catalog;

    [HttpGet]
    public async Task<ActionResult<FailureTypesCatalogDto>> Get(CancellationToken ct)
        => Ok(await _catalog.GetAsync(ct));

    [HttpPut]
    [Authorize(Policy = CapabilityPolicyNames.ManageSystemConfig)]
    public async Task<ActionResult<FailureTypesCatalogDto>> Save(
        [FromBody] SaveFailureTypesCatalogRequest request,
        CancellationToken ct)
        => Ok(await _catalog.SaveAsync(request, ct));
}

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web;
using RealEstateEval.Shared.Web.Authorization;

namespace RealEstateEval.Platform.Api.Controllers;

/// <summary>factor definitions as admin reference data with a version log.</summary>
[ApiController]
[Route("api/difference-factor-catalog")]
[Authorize]
public class DifferenceFactorCatalogController : ControllerBase
{
    private readonly IDifferenceFactorCatalogService _catalog;

    public DifferenceFactorCatalogController(IDifferenceFactorCatalogService catalog) =>
        _catalog = catalog;

    [HttpGet]
    public async Task<ActionResult<DifferenceFactorCatalogDto>> Get(CancellationToken ct)
        => Ok(await _catalog.GetAsync(ct));

    [HttpPut]
    [Authorize(Policy = CapabilityPolicyNames.ManageSystemConfig)]
    public async Task<ActionResult<DifferenceFactorCatalogDto>> Save(
        [FromBody] SaveDifferenceFactorCatalogRequest request,
        CancellationToken ct)
    {
        var (result, error) = await _catalog.SaveAsync(request, ActorClaims.Id(User), ct);
        if (error is not null) return this.BadRequestProblem(error);
        return Ok(result);
    }
}

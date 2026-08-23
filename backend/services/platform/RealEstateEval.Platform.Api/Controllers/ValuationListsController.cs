using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web.Authorization;

namespace RealEstateEval.Platform.Api.Controllers;

[ApiController]
[Route("api/valuation-lists")]
[Authorize]
public class ValuationListsController(IValuationListsService catalog) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ValuationListsDto>> Get(CancellationToken ct)
        => Ok(await catalog.GetAsync(ct));

    [HttpPut]
    [Authorize(Policy = CapabilityPolicyNames.ManageSystemConfig)]
    public async Task<ActionResult<ValuationListsDto>> Save(
        [FromBody] SaveValuationListsRequest request,
        CancellationToken ct)
        => Ok(await catalog.SaveAsync(request, ct));
}

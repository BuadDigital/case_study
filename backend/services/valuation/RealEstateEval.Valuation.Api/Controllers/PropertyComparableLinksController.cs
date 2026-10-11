using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web;
using RealEstateEval.Shared.Web.Authorization;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Application.Contracts;

namespace RealEstateEval.Valuation.Api.Controllers;

[ApiController]
[Route("api/property-comparable-links")]
[Authorize]
public class PropertyComparableLinksController(IPropertyComparableLinkService links) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = CapabilityPolicyNames.ReadComparableBank)]
    public async Task<ActionResult<PropertyComparableLinkListDto>> List(
        [FromQuery] Guid propertyId,
        CancellationToken ct)
    {
        if (propertyId == Guid.Empty)
            return this.BadRequestProblem("معرّف العقار مطلوب");
        return Ok(await links.ListAsync(propertyId, ct));
    }
}

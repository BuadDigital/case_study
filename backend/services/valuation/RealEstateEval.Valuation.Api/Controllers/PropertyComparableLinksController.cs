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

    [HttpPost]
    [Authorize(Policy = CapabilityPolicyNames.WriteComparableBank)]
    public async Task<ActionResult<PropertyComparableLinkListDto>> Link(
        [FromBody] LinkPropertyComparableRequest request,
        CancellationToken ct)
    {
        var (result, errors) = await links.LinkAsync(request, ActorClaims.Id(User), ct);
        if (errors is not null)
            return this.FieldErrorsProblem(errors);
        return Ok(result);
    }

    [HttpPatch("{propertyId:guid}/{comparablePropertyId:guid}")]
    [Authorize(Policy = CapabilityPolicyNames.WriteComparableBank)]
    public async Task<ActionResult<PropertyComparableLinkItemDto>> PatchDescription(
        Guid propertyId,
        Guid comparablePropertyId,
        [FromBody] PatchPropertyComparableLinkRequest request,
        CancellationToken ct)
    {
        var (result, errors) = await links.PatchDescriptionAsync(
            propertyId, comparablePropertyId, request, ct);
        if (errors is not null)
            return this.FieldErrorsProblem(errors);
        return Ok(result);
    }

    [HttpDelete("{propertyId:guid}/{comparablePropertyId:guid}")]
    [Authorize(Policy = CapabilityPolicyNames.WriteComparableBank)]
    public async Task<IActionResult> Unlink(
        Guid propertyId,
        Guid comparablePropertyId,
        CancellationToken ct)
    {
        var (ok, error) = await links.UnlinkAsync(propertyId, comparablePropertyId, ct);
        if (!ok) return this.BadRequestProblem(error ?? "تعذر فك الربط.");
        return NoContent();
    }
}

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web;
using RealEstateEval.Shared.Web.Authorization;
using RealEstateEval.CaseStudy.Application.Abstractions;

namespace RealEstateEval.CaseStudy.Api.Controllers;

[ApiController]
[Route("api/work-orders/{poNumber}/properties/{propertyId:guid}/photo-marks")]
[Authorize]
public class PropertyPhotoMarksController : ControllerBase
{
    private readonly IPropertyPhotoMarksService _marks;
    private readonly IPermissionService _permissions;

    public PropertyPhotoMarksController(
        IPropertyPhotoMarksService marks,
        IPermissionService permissions)
    {
        _marks = marks;
        _permissions = permissions;
    }

    /// <summary>The specialist's marks are read with the property, in the work-order response.</summary>
    [HttpPut]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<ActionResult<PropertyPhotoMarksDto>> Save(
        string poNumber,
        Guid propertyId,
        [FromBody] PropertyPhotoMarksDto request,
        CancellationToken cancellationToken)
    {
        var actor = await PartySubmissionActors.ResolveAsync(User, _permissions, cancellationToken);
        var (result, errors) = await _marks.SaveAsync(poNumber, propertyId, request, actor, cancellationToken);
        if (errors is not null)
            return this.FieldErrorsProblem(errors);
        return Ok(result);
    }
}

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Rules;
using RealEstateEval.Shared.Web;
using RealEstateEval.Shared.Web.Authorization;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Application.Contracts;

namespace RealEstateEval.Valuation.Api.Controllers;

/// <summary>
/// «مستندات ذات قيمة» of the request's property and the appraiser's decision on each. The
/// document and its value stay between the case specialist and the appraiser (and the CDO);
/// only the appraiser decides the effect.
/// </summary>
[ApiController]
[Route("api/valuation-requests/{valuationRequestId:guid}/value-documents")]
[Authorize]
public class ValuationValueDocumentsController(
    IValuationValueDocumentService valueDocuments,
    IPermissionService permissions) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = CapabilityPolicyNames.ReadValuationQueue)]
    public async Task<ActionResult<ValuationValueDocumentsDto>> Get(
        Guid valuationRequestId,
        CancellationToken ct)
    {
        var actor = await permissions.GetForUserIdAsync(ActorClaims.Id(User), ct);
        if (!PoRoleMatrixRules.CanSeeValuedDocuments(actor?.PrototypeRole))
            return this.ForbiddenProblem("المستندات ذات القيمة متاحة للأخصائي والمقيّم فقط");

        var dto = await valueDocuments.GetAsync(valuationRequestId, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPut]
    [Authorize(Policy = CapabilityPolicyNames.SubmitValuationReport)]
    public async Task<ActionResult<ValuationValueDocumentsDto>> Save(
        Guid valuationRequestId,
        [FromBody] SaveValuationValueDocumentsRequest request,
        CancellationToken ct)
    {
        var actor = await permissions.GetForUserIdAsync(ActorClaims.Id(User), ct);
        if (!PoRoleMatrixRules.CanDecideValueDocumentEffect(actor?.PrototypeRole))
            return this.ForbiddenProblem("أثر المستند ذي القيمة يحدده المقيّم");

        var (result, errors) = await valueDocuments.SaveAsync(valuationRequestId, request, ct);
        if (errors is not null)
            return this.FieldErrorsProblem(errors);
        return Ok(result);
    }
}

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web;
using RealEstateEval.Shared.Web.Authorization;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Abstractions;

namespace RealEstateEval.CaseStudy.Api.Controllers;

/// <summary>
/// grouped-property linking: system suggests, a human confirms (audited),
/// reversible with a reason. Work orders stay administratively independent.
/// </summary>
[ApiController]
[Route("api/property-groups")]
[Authorize]
public class PropertyGroupsController : ControllerBase
{
    private readonly IPropertyGroupService _groups;
    private readonly IInspectionPrefillFromSibling _prefill;
    private readonly IPermissionService _permissions;

    public PropertyGroupsController(
        IPropertyGroupService groups,
        IInspectionPrefillFromSibling prefill,
        IPermissionService permissions)
    {
        _groups = groups;
        _prefill = prefill;
        _permissions = permissions;
    }

    /// <summary>
    /// The inspector opens the inspection of a deed in a group for the first time: start it
    /// from the sibling deed's inspection — site inputs and photos (copied, editable).
    /// </summary>
    [HttpPost("prefill-inspection/{taskId:guid}")]
    [Authorize(Policy = CapabilityPolicyNames.ReadCaseStudyWorkspace)]
    public async Task<ActionResult<InspectionPrefillResultDto>> PrefillInspection(
        Guid taskId,
        CancellationToken ct)
    {
        var actor = await _permissions.GetForUserIdAsync(ActorClaims.Id(User), ct);
        var (result, error) = await _prefill.PrefillAsync(taskId, actor, ct);
        if (error is not null) return this.BadRequestProblem(error);
        return Ok(result);
    }

    [HttpGet("by-property/{propertyId:guid}")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<ActionResult<PropertyGroupDto?>> GetForProperty(
        Guid propertyId,
        CancellationToken ct)
    {
 // “NoSet” should arrive as JSON null with status 200 not 204 — the TS client always reads the body,
 // The empty body is interpreted as a network error (HttpNoContentOutputFormatter converts null to 204).
        var group = await _groups.GetForPropertyAsync(propertyId, ct);
        return new JsonResult(group);
    }

    [HttpGet("by-property/{propertyId:guid}/suggestions")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<ActionResult<IReadOnlyList<PropertyGroupSuggestionDto>>> Suggest(
        Guid propertyId,
        CancellationToken ct)
        => Ok(await _groups.SuggestAsync(propertyId, ct));

    [HttpPost("by-property/{propertyId:guid}/link")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<ActionResult<PropertyGroupDto>> ConfirmLink(
        Guid propertyId,
        [FromBody] ConfirmPropertyGroupLinkRequest request,
        CancellationToken ct)
    {
        var (result, error) = await _groups.ConfirmLinkAsync(
            propertyId, request.TargetPropertyId, ActorClaims.Id(User), ct);
        if (error is not null) return this.BadRequestProblem(error);
        return Ok(result);
    }

    /// <summary>
    /// After the screen copied the sibling deed's files onto this deed, record their stored
    /// names — only into name slots that are still empty.
    /// </summary>
    [HttpPost("by-property/{propertyId:guid}/document-names")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<ActionResult<FillPropertyGroupDocumentNamesResultDto>> FillDocumentNames(
        Guid propertyId,
        [FromBody] FillPropertyGroupDocumentNamesRequest request,
        CancellationToken ct)
    {
        var (result, error) = await _groups.FillDocumentNamesAsync(
            propertyId, request, ActorClaims.Id(User), ct);
        if (error is not null) return this.BadRequestProblem(error);
        return Ok(result);
    }

    [HttpPost("by-property/{propertyId:guid}/unlink")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<ActionResult<PropertyGroupDto>> Unlink(
        Guid propertyId,
        [FromBody] UnlinkPropertyGroupRequest request,
        CancellationToken ct)
    {
        var (result, error) = await _groups.UnlinkAsync(
            propertyId, request.Reason, ActorClaims.Id(User), ct);
        if (error is not null) return this.BadRequestProblem(error);
        return Ok(result);
    }
}

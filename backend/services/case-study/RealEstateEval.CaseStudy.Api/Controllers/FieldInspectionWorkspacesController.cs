using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web;
using RealEstateEval.Shared.Web.Authorization;
using RealEstateEval.CaseStudy.Application.Abstractions;

namespace RealEstateEval.CaseStudy.Api.Controllers;

[ApiController]
[Route("api/field-inspection-workspaces")]
[Authorize]
public class FieldInspectionWorkspacesController : ControllerBase
{
    private readonly IFieldInspectionWorkspaceService _workspaces;
    private readonly IPermissionService _permissions;

    public FieldInspectionWorkspacesController(
        IFieldInspectionWorkspaceService workspaces,
        IPermissionService permissions)
    {
        _workspaces = workspaces;
        _permissions = permissions;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<FieldInspectionWorkspaceListItemDto>>> List(
        CancellationToken ct)
    {
        var actor = await _permissions.GetForUserIdAsync(ActorClaims.Id(User), ct);
        if (actor is null)
            return Forbid();

        return Ok(await _workspaces.ListAsync(actor, ct));
    }

    [HttpGet("summary")]
    [Authorize(Policy = CapabilityPolicyNames.ReadManagementReports)]
    public async Task<ActionResult<FieldInspectionWorkspaceSummaryDto>> Summary(CancellationToken ct)
    {
        var actor = await _permissions.GetForUserIdAsync(ActorClaims.Id(User), ct);
        if (actor is null)
            return Forbid();

        return Ok(await _workspaces.GetSummaryAsync(actor, ct));
    }
}

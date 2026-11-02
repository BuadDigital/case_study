using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.Shared.Web.Authorization;

namespace RealEstateEval.CaseStudy.Api.Controllers;

/// <summary>The inspector's «نسخ من معاملة سابقة»: the assigned inspector only, checked in the service.</summary>
[ApiController]
[Route("api/party-task-submissions/{taskId:guid}/prior-inspections")]
[Authorize(Policy = CapabilityPolicyNames.SubmitPartyWork)]
public class PriorInspectionsController : ControllerBase
{
    private readonly IPriorInspectionCopyService _copies;
    private readonly IPermissionService _permissions;

    public PriorInspectionsController(IPriorInspectionCopyService copies, IPermissionService permissions)
    {
        _copies = copies;
        _permissions = permissions;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<PriorInspectionOptionDto>>> List(
        Guid taskId,
        CancellationToken cancellationToken)
    {
        var actor = await PartySubmissionActors.ResolveAsync(User, _permissions, cancellationToken);
        return Ok(await _copies.ListAsync(taskId, actor, cancellationToken));
    }

    [HttpPost("{sourceTaskId:guid}/copy")]
    public async Task<ActionResult<PriorInspectionCopyDto>> Copy(
        Guid taskId,
        Guid sourceTaskId,
        CancellationToken cancellationToken)
    {
        var actor = await PartySubmissionActors.ResolveAsync(User, _permissions, cancellationToken);
        var copy = await _copies.CopyAsync(taskId, sourceTaskId, actor, cancellationToken);
        return copy is null ? NotFound() : Ok(copy);
    }
}

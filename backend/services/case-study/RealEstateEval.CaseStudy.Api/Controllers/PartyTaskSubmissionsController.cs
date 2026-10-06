using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web;
using RealEstateEval.Shared.Web.Authorization;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Abstractions;

namespace RealEstateEval.CaseStudy.Api.Controllers;

[ApiController]
[Route("api/party-task-submissions")]
[Authorize]
public class PartyTaskSubmissionsController : ControllerBase
{
    private readonly IPartyTaskSubmissionService _submissions;
    private readonly IPermissionService _permissions;

    public PartyTaskSubmissionsController(
        IPartyTaskSubmissionService submissions,
        IPermissionService permissions)
    {
        _submissions = submissions;
        _permissions = permissions;
    }

    [HttpGet]
    [Authorize(Policy = CapabilityPolicyNames.ReadCaseStudyWorkspace)]
    public async Task<ActionResult<IReadOnlyList<PartyTaskSubmissionDto>>> List(
        [FromQuery] string? workflowTaskIds,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(workflowTaskIds))
            return Ok(Array.Empty<PartyTaskSubmissionDto>());

        var ids = workflowTaskIds
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(s => Guid.TryParse(s, out var id) ? id : Guid.Empty)
            .Where(id => id != Guid.Empty)
            .ToList();

        return Ok(await _submissions.ListForTasksAsync(
            ids,
            await ResolveActorAsync(cancellationToken),
            cancellationToken));
    }

    [HttpGet("{taskId:guid}")]
    [Authorize(Policy = CapabilityPolicyNames.ReadCaseStudyWorkspace)]
    public async Task<ActionResult<PartyTaskSubmissionDto>> Get(
        Guid taskId,
        CancellationToken cancellationToken)
    {
        var dto = await _submissions.GetAsync(
            taskId,
            await ResolveActorAsync(cancellationToken),
            cancellationToken);
        if (dto is null) return NotFound();
        return Ok(dto);
    }

    [HttpPut("{taskId:guid}")]
    [Authorize(Policy = CapabilityPolicyNames.SubmitPartyWork)]
    public async Task<ActionResult<PartyTaskSubmissionDto>> SaveDraft(
        Guid taskId,
        [FromBody] SavePartyTaskSubmissionRequest request,
        CancellationToken cancellationToken)
    {
        var (result, errors) = await _submissions.SaveDraftAsync(
            taskId,
            request,
            await ResolveActorAsync(cancellationToken),
            cancellationToken);
        return ToActionResult(result, errors);
    }

    [HttpPost("{taskId:guid}/submit")]
    [Authorize(Policy = CapabilityPolicyNames.SubmitPartyWork)]
    public async Task<ActionResult<PartyTaskSubmissionDto>> Submit(
        Guid taskId,
        CancellationToken cancellationToken)
    {
        var (result, errors) = await _submissions.SubmitAsync(
            taskId,
            await ResolveActorAsync(cancellationToken),
            cancellationToken);
        return ToActionResult(result, errors);
    }

    [HttpPost("{taskId:guid}/reopen")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<ActionResult<PartyTaskSubmissionDto>> Reopen(
        Guid taskId,
        [FromBody] ReopenPartyTaskSubmissionRequest request,
        CancellationToken cancellationToken)
    {
        var (result, errors) = await _submissions.ReopenAsync(
            taskId,
            request,
            await ResolveActorAsync(cancellationToken),
            cancellationToken);
        return ToActionResult(result, errors);
    }

    /// <summary>Who returning the inspection package may affect (<c>?sections=components,area</c>).</summary>
    [HttpGet("{taskId:guid}/return-impact")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<ActionResult<ReturnImpactDto>> ReturnImpact(
        Guid taskId,
        [FromQuery] string? sections,
        CancellationToken cancellationToken)
    {
        var keys = (sections ?? "")
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        var (result, errors) = await _submissions.GetReturnImpactAsync(
            taskId,
            keys,
            await ResolveActorAsync(cancellationToken),
            cancellationToken);
        if (errors is null && result is null) return NotFound();
        return ToObjectResult(result, errors);
    }

    /// <summary>Returns the inspection for correction and applies the decision on the affected parties.</summary>
    [HttpPost("{taskId:guid}/return-inspection")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<ActionResult<ReturnInspectionResultDto>> ReturnInspection(
        Guid taskId,
        [FromBody] ReturnInspectionRequest request,
        CancellationToken cancellationToken)
    {
        var (result, errors) = await _submissions.ReturnInspectionAsync(
            taskId,
            request,
            await ResolveActorAsync(cancellationToken),
            cancellationToken);
        return ToObjectResult(result, errors);
    }

    [HttpPost("{taskId:guid}/accept")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<ActionResult<PartyTaskSubmissionDto>> Accept(
        Guid taskId,
        CancellationToken cancellationToken)
    {
        var (result, errors) = await _submissions.AcceptAsync(
            taskId,
            await ResolveActorAsync(cancellationToken),
            cancellationToken);
        return ToActionResult(result, errors);
    }

    private ActionResult<PartyTaskSubmissionDto> ToActionResult(
        PartyTaskSubmissionDto? result,
        Dictionary<string, string>? errors)
    {
        if (errors is not null)
        {
            if (errors.TryGetValue("_", out var msg)
                && msg.Contains("صلاحية", StringComparison.Ordinal))
            {
                return this.FieldErrorsProblem(errors, StatusCodes.Status403Forbidden, "Forbidden");
            }
            return this.FieldErrorsProblem(errors);
        }
        return Ok(result);
    }

    private ActionResult<T> ToObjectResult<T>(T? result, Dictionary<string, string>? errors)
        where T : class
    {
        if (errors is not null)
        {
            if (errors.TryGetValue("_", out var msg)
                && msg.Contains("صلاحية", StringComparison.Ordinal))
            {
                return this.FieldErrorsProblem(errors, StatusCodes.Status403Forbidden, "Forbidden");
            }
            return this.FieldErrorsProblem(errors);
        }
        return Ok(result);
    }

    private async Task<PartySubmissionActor> ResolveActorAsync(CancellationToken ct)
    {
        var userId = ActorClaims.Id(User);
        var permissions = string.IsNullOrWhiteSpace(userId) || userId == "unknown"
            ? null
            : await _permissions.GetForUserIdAsync(userId, ct);

        return new PartySubmissionActor
        {
            UserId = userId == "unknown" ? "" : userId,
            DisplayName = ActorClaims.DisplayName(User),
            PrototypeRole = permissions?.PrototypeRole,
            DistributionAssigneeId = permissions?.DistributionAssigneeId,
        };
    }
}

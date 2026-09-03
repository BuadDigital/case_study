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

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web.Authorization;

namespace RealEstateEval.CaseStudy.Api.Controllers;

[ApiController]
[Route("api/party-task-submissions")]
[Authorize]
public class PartyTaskSubmissionsController : ControllerBase
{
    private readonly IPartyTaskSubmissionService _submissions;

    public PartyTaskSubmissionsController(IPartyTaskSubmissionService submissions)
    {
        _submissions = submissions;
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

        return Ok(await _submissions.ListForTasksAsync(ids, cancellationToken));
    }

    [HttpGet("{taskId:guid}")]
    public async Task<ActionResult<PartyTaskSubmissionDto>> Get(
        Guid taskId,
        CancellationToken cancellationToken)
    {
        var dto = await _submissions.GetAsync(taskId, cancellationToken);
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
        var (result, errors) = await _submissions.SaveDraftAsync(taskId, request, cancellationToken);
        if (errors is not null) return BadRequest(new { errors });
        return Ok(result);
    }

    [HttpPost("{taskId:guid}/submit")]
    [Authorize(Policy = CapabilityPolicyNames.SubmitPartyWork)]
    public async Task<ActionResult<PartyTaskSubmissionDto>> Submit(
        Guid taskId,
        CancellationToken cancellationToken)
    {
        var (result, errors) = await _submissions.SubmitAsync(taskId, cancellationToken);
        if (errors is not null) return BadRequest(new { errors });
        return Ok(result);
    }

    [HttpPost("{taskId:guid}/reopen")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<ActionResult<PartyTaskSubmissionDto>> Reopen(
        Guid taskId,
        [FromBody] ReopenPartyTaskSubmissionRequest request,
        CancellationToken cancellationToken)
    {
        var (result, errors) = await _submissions.ReopenAsync(taskId, request, cancellationToken);
        if (errors is not null) return BadRequest(new { errors });
        return Ok(result);
    }
}

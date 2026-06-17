using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;

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
    public async Task<ActionResult<PartyTaskSubmissionDto>> Submit(
        Guid taskId,
        CancellationToken cancellationToken)
    {
        var (result, errors) = await _submissions.SubmitAsync(taskId, cancellationToken);
        if (errors is not null) return BadRequest(new { errors });
        return Ok(result);
    }

    [HttpPost("{taskId:guid}/reopen")]
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

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web.Authorization;

namespace RealEstateEval.Valuation.Api.Controllers;

[ApiController]
[Route("api/evaluator-recalls")]
[Authorize]
public class EvaluatorRecallsController : ControllerBase
{
    private readonly IEvaluatorRecallsService _recalls;

    public EvaluatorRecallsController(IEvaluatorRecallsService recalls) => _recalls = recalls;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<EvaluatorRecallDto>>> List(
        [FromQuery] string? status,
        CancellationToken ct)
        => Ok(await _recalls.ListAsync(status, ct));

    [HttpGet("{taskId}")]
    public async Task<ActionResult<EvaluatorRecallDto>> Get(string taskId, CancellationToken ct)
    {
        var dto = await _recalls.GetAsync(taskId, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPost]
    [Authorize(Policy = CapabilityPolicyNames.SubmitValuationReport)]
    public async Task<ActionResult<EvaluatorRecallDto>> SubmitRequest(
        [FromBody] CreateEvaluatorRecallRequest request,
        CancellationToken ct)
    {
        var dto = await _recalls.RequestAsync(request, ct);
        return CreatedAtAction(nameof(Get), new { taskId = dto.TaskId }, dto);
    }

    [HttpPatch("{taskId}/approve")]
    [Authorize(Policy = CapabilityPolicyNames.ManageValuationRequests)]
    public async Task<ActionResult<EvaluatorRecallDto>> Approve(string taskId, CancellationToken ct)
    {
        var dto = await _recalls.ApproveAsync(taskId, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPatch("{taskId}/reject")]
    [Authorize(Policy = CapabilityPolicyNames.ManageValuationRequests)]
    public async Task<ActionResult<EvaluatorRecallDto>> Reject(
        string taskId,
        [FromBody] RejectEvaluatorRecallRequest request,
        CancellationToken ct)
    {
        var dto = await _recalls.RejectAsync(taskId, request, ct);
        return dto is null ? NotFound() : Ok(dto);
    }
}

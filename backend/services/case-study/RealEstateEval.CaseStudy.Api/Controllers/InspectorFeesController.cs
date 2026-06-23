using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;

namespace RealEstateEval.CaseStudy.Api.Controllers;

[ApiController]
[Route("api/inspector-fees")]
[Authorize]
public class InspectorFeesController : ControllerBase
{
    private readonly IInspectorFeeService _fees;

    public InspectorFeesController(IInspectorFeeService fees) => _fees = fees;

    [HttpGet]
    public async Task<ActionResult<InspectorFeesSummaryDto>> List(
        [FromQuery] string? assigneeId,
        [FromQuery] string? workflowTaskId,
        [FromQuery] bool submittedOnly = true,
        CancellationToken ct = default) =>
        Ok(await _fees.GetSummaryAsync(assigneeId, workflowTaskId, submittedOnly, ct));

    [HttpGet("summary")]
    public async Task<ActionResult<InspectorFeesSummaryDto>> Summary(
        [FromQuery] string? assigneeId,
        [FromQuery] string? workflowTaskId,
        [FromQuery] bool submittedOnly = true,
        CancellationToken ct = default) =>
        Ok(await _fees.GetSummaryAsync(assigneeId, workflowTaskId, submittedOnly, ct));

    [HttpGet("{workflowTaskId:guid}")]
    public async Task<ActionResult<InspectorFeeRowDto>> GetByTask(
        Guid workflowTaskId,
        CancellationToken ct)
    {
        var row = await _fees.GetByWorkflowTaskIdAsync(workflowTaskId, ct);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpPatch("{workflowTaskId:guid}")]
    public async Task<ActionResult<InspectorFeeRowDto>> Patch(
        Guid workflowTaskId,
        [FromBody] PatchInspectorFeeRequest request,
        CancellationToken ct)
    {
        var row = await _fees.PatchAsync(workflowTaskId, request, ct);
        return row is null ? NotFound() : Ok(row);
    }
}

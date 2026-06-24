using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Authorization;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web.Authorization;

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
        [FromQuery] string? taskKind = null,
        [FromQuery] string? billingStatus = null,
        CancellationToken ct = default) =>
        Ok(await _fees.GetSummaryAsync(
            assigneeId,
            workflowTaskId,
            submittedOnly,
            taskKind,
            billingStatus,
            ct));

    [HttpGet("summary")]
    public async Task<ActionResult<InspectorFeesSummaryDto>> Summary(
        [FromQuery] string? assigneeId,
        [FromQuery] string? workflowTaskId,
        [FromQuery] bool submittedOnly = true,
        [FromQuery] string? taskKind = null,
        [FromQuery] string? billingStatus = null,
        CancellationToken ct = default) =>
        Ok(await _fees.GetSummaryAsync(
            assigneeId,
            workflowTaskId,
            submittedOnly,
            taskKind,
            billingStatus,
            ct));

    [HttpGet("{workflowTaskId:guid}")]
    public async Task<ActionResult<InspectorFeeRowDto>> GetByTask(
        Guid workflowTaskId,
        CancellationToken ct)
    {
        var row = await _fees.GetByWorkflowTaskIdAsync(workflowTaskId, ct);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpPatch("{workflowTaskId:guid}")]
    [Authorize(Policy = CapabilityPolicyNames.ManageOperations)]
    public async Task<ActionResult<InspectorFeeRowDto>> Patch(
        Guid workflowTaskId,
        [FromBody] PatchInspectorFeeRequest request,
        CancellationToken ct)
    {
        var row = await _fees.PatchAsync(workflowTaskId, request, ct);
        return row is null
            ? BadRequest(new { error = "تعذر حفظ الأتعاب — تحقق من الحالة والحسم والاستبعاد." })
            : Ok(row);
    }

    [HttpPost("{workflowTaskId:guid}/transition")]
    public async Task<ActionResult<InspectorFeeRowDto>> Transition(
        Guid workflowTaskId,
        [FromBody] InspectorFeeTransitionRequest request,
        CancellationToken ct)
    {
        var action = request.Action.Trim().ToLowerInvariant();
        if (IsFinanceAction(action) && !User.HasClaim(PlatformCapabilities.ClaimType, PlatformCapabilities.ManageFinancial))
            return Forbid();
        if (IsSupervisorAction(action) && !User.HasClaim(PlatformCapabilities.ClaimType, PlatformCapabilities.ManageOperations))
            return Forbid();

        var userId = CurrentUserId();
        if (userId is null) return Unauthorized();

        var (row, error) = await _fees.TransitionAsync(workflowTaskId, request, userId, ct);
        if (error is not null)
            return BadRequest(new { error });
        return row is null ? NotFound() : Ok(row);
    }

    [HttpPost("batch-transition")]
    public async Task<ActionResult<BatchInspectorFeeTransitionResult>> BatchTransition(
        [FromBody] BatchInspectorFeeTransitionRequest request,
        CancellationToken ct)
    {
        var action = request.Action.Trim().ToLowerInvariant();
        if (IsFinanceAction(action) && !User.HasClaim(PlatformCapabilities.ClaimType, PlatformCapabilities.ManageFinancial))
            return Forbid();
        if (IsSupervisorAction(action) && !User.HasClaim(PlatformCapabilities.ClaimType, PlatformCapabilities.ManageOperations))
            return Forbid();

        var userId = CurrentUserId();
        if (userId is null) return Unauthorized();

        var result = await _fees.BatchTransitionAsync(request, userId, ct);
        return Ok(result);
    }

    private static bool IsFinanceAction(string action) =>
        action is "invoice" or "record-payment" or "return";

    private static bool IsSupervisorAction(string action) =>
        action is "submit-to-finance";

    private string? CurrentUserId() =>
        User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);
}

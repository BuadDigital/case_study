using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Authorization;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Shared.Web.Authorization;

namespace RealEstateEval.CaseStudy.Api.Controllers;

[ApiController]
[Route("api/inspector-fees")]
[Authorize]
public class InspectorFeesController : ControllerBase
{
    private readonly IInspectorFeeService _fees;
    private readonly ApplicationDbContext _db;

    public InspectorFeesController(IInspectorFeeService fees, ApplicationDbContext db)
    {
        _fees = fees;
        _db = db;
    }

    [HttpGet]
    public async Task<ActionResult<InspectorFeesSummaryDto>> List(
        [FromQuery] string? assigneeId,
        [FromQuery] string? workflowTaskId,
        [FromQuery] bool submittedOnly = true,
        [FromQuery] string? taskKind = null,
        [FromQuery] string? billingStatus = null,
        [FromQuery] string? returnTo = null,
        CancellationToken ct = default) =>
        Ok(await _fees.GetSummaryAsync(
            assigneeId,
            workflowTaskId,
            submittedOnly,
            taskKind,
            billingStatus,
            returnTo,
            ct));

    [HttpGet("summary")]
    public async Task<ActionResult<InspectorFeesSummaryDto>> Summary(
        [FromQuery] string? assigneeId,
        [FromQuery] string? workflowTaskId,
        [FromQuery] bool submittedOnly = true,
        [FromQuery] string? taskKind = null,
        [FromQuery] string? billingStatus = null,
        [FromQuery] string? returnTo = null,
        CancellationToken ct = default) =>
        Ok(await _fees.GetSummaryAsync(
            assigneeId,
            workflowTaskId,
            submittedOnly,
            taskKind,
            billingStatus,
            returnTo,
            ct));

    [HttpGet("{workflowTaskId:guid}/transitions")]
    public async Task<ActionResult<IReadOnlyList<InspectorFeeAuditEntryDto>>> ListTransitions(
        Guid workflowTaskId,
        CancellationToken ct) =>
        Ok(await _fees.ListTransitionsAsync(workflowTaskId, ct));

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
        var ctx = await BuildActorContextAsync(ct);
        if (ctx.UserId is null) return Unauthorized();
        if (!IsAuthorizedForAction(action, ctx))
            return Forbid();

        var (row, error) = await _fees.TransitionAsync(
            workflowTaskId,
            request,
            ctx.UserId,
            ctx.AssigneeId,
            ctx.IsOperationsManager,
            ctx.IsFinancialOfficer,
            ct);
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
        var ctx = await BuildActorContextAsync(ct);
        if (ctx.UserId is null) return Unauthorized();
        if (!IsAuthorizedForAction(action, ctx))
            return Forbid();

        var result = await _fees.BatchTransitionAsync(
            request,
            ctx.UserId,
            ctx.AssigneeId,
            ctx.IsOperationsManager,
            ctx.IsFinancialOfficer,
            ct);
        return Ok(result);
    }

    [HttpPost("disbursement-batch")]
    public async Task<ActionResult<CreateDisbursementBatchResult>> CreateDisbursementBatch(
        [FromBody] CreateDisbursementBatchRequest request,
        CancellationToken ct)
    {
        var ctx = await BuildActorContextAsync(ct);
        if (ctx.UserId is null) return Unauthorized();
        if (string.IsNullOrWhiteSpace(ctx.AssigneeId))
            return Forbid();

        var result = await _fees.CreateDisbursementBatchAsync(
            request,
            ctx.UserId,
            ctx.AssigneeId,
            ct);
        return Ok(result);
    }

    private static bool IsAuthorizedForAction(string action, ActorContext ctx)
    {
        return action switch
        {
            InspectorFeeActions.SubmitToSupervisor
                or InspectorFeeActions.CreateDisbursementRequest =>
                !string.IsNullOrWhiteSpace(ctx.AssigneeId),

            InspectorFeeActions.ApproveToFinance
                or InspectorFeeActions.ResendToFinance
                or InspectorFeeActions.ReturnToOffice => ctx.IsOperationsManager,

            InspectorFeeActions.Disburse
                or InspectorFeeActions.ReturnToSupervisor
                or InspectorFeeActions.InquiryToOffice => ctx.IsFinancialOfficer,

            _ => false,
        };
    }

    private async Task<ActorContext> BuildActorContextAsync(CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);
        var isOperationsManager = User.HasClaim(
            PlatformCapabilities.ClaimType,
            PlatformCapabilities.ManageOperations);
        var isFinancialOfficer = User.HasClaim(
            PlatformCapabilities.ClaimType,
            PlatformCapabilities.ManageFinancial);

        string? assigneeId = null;
        if (!string.IsNullOrWhiteSpace(userId))
        {
            assigneeId = await _db.UserProfiles.AsNoTracking()
                .Where(p => p.UserId == userId)
                .Select(p => p.DistributionAssigneeId)
                .FirstOrDefaultAsync(ct);
        }

        return new ActorContext(userId, assigneeId, isOperationsManager, isFinancialOfficer);
    }

    private sealed record ActorContext(
        string? UserId,
        string? AssigneeId,
        bool IsOperationsManager,
        bool IsFinancialOfficer);
}
